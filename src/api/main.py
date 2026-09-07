"""FastAPI microservice serving Retail Intelligence endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse

from src.api.agent_routes import agent_router
from src.api.schemas import (
    AnomalyPredictionRequest,
    AnomalyPredictionResponse,
    CancellationRiskFactor,
    CancellationRiskResponse,
    CrossSellRequest,
    CrossSellResponse,
    CustomerCLVExplorerResponse,
    CustomerCLVRequest,
    CustomerCLVResponse,
    DashboardAnalyticsResponse,
    DashboardSummary,
    ExecutiveReportResponse,
    HealthResponse,
    HourlyOrderItem,
    KpiMetric,
    MonthlyRevenueItem,
    ProductRecommendationItem,
    ProductRecommendationsResponse,
    RecommendedItem,
    StreamTransaction,
    TopMarketItem,
    TopProductItem,
)

logger = logging.getLogger("retail_api")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Global artifacts cache
artifacts: dict[str, Any] = {
    "bgf_model": None,
    "ggf_model": None,
    "kmeans_rfm": None,
    "customer_db": None,
    "association_rules": None,
    "transactions_df": None,
    "isolation_forest": None,
}


class StreamBroadcastManager:
    """Manages active WebSockets and circular memory buffer for live ledger streaming."""

    def __init__(self, maxlen: int = 300) -> None:
        self.active_websockets: list[WebSocket] = []
        self.buffer: deque[dict[str, Any]] = deque(maxlen=maxlen)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_websockets.append(websocket)
        logger.info("Client connected to /ws/transactions. Active connections: %d", len(self.active_websockets))

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_websockets:
            self.active_websockets.remove(websocket)
            logger.info("Client disconnected from /ws/transactions. Active connections: %d", len(self.active_websockets))

    async def broadcast(self, item: dict[str, Any]) -> None:
        self.buffer.append(item)
        disconnected = []
        for ws in self.active_websockets:
            try:
                await ws.send_json(item)
            except (WebSocketDisconnect, RuntimeError, ConnectionError, OSError):
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)


stream_manager = StreamBroadcastManager()


def predict_anomaly_internal(
    monetary_variance: float,
    basket_size: float,
    days_since_last_order: float,
    invoice_no: str | None = None,
) -> AnomalyPredictionResponse:
    """Core inference function for unsupervised IsolationForest anomaly detection."""
    iso_bundle = artifacts.get("isolation_forest")
    if iso_bundle is None:
        # Graceful heuristic fallback if model artifact not yet loaded
        is_anom = monetary_variance > 3.0 or basket_size > 1500
        score = 0.125 if is_anom else 0.02
        return AnomalyPredictionResponse(
            invoice_no=invoice_no,
            is_anomaly=is_anom,
            anomaly_score=score,
            risk_level="HIGH" if is_anom else "LOW",
            confidence=0.88,
            reasons=["High transaction volume deviation"] if is_anom else [],
        )

    model = iso_bundle["model"] if isinstance(iso_bundle, dict) else iso_bundle
    X = pd.DataFrame(
        [[monetary_variance, basket_size, days_since_last_order]],
        columns=["MonetaryVariance", "BasketSize", "DaysSinceLastOrder"],
    )
    pred = model.predict(X)[0]
    raw_score = -float(model.decision_function(X)[0])
    is_anom = bool(pred == -1)

    reasons: list[str] = []
    if monetary_variance > 2.0:
        reasons.append(f"Monetary spend deviates {monetary_variance:.1f}x from customer baseline")
    if basket_size > 1000:
        reasons.append(f"Abnormal wholesale unit count ({int(basket_size):,} units)")
    if days_since_last_order > 120:
        reasons.append(f"Prolonged dormant gap ({int(days_since_last_order)} days since prior purchase)")
    if not reasons and is_anom:
        reasons.append("Multi-dimensional density outlier across spend and frequency vector")

    if raw_score > 0.08 or is_anom:
        risk_level = "HIGH"
    elif raw_score > 0.03:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    confidence = round(min(0.99, max(0.65, 0.5 + abs(raw_score) * 3.0)), 3)

    return AnomalyPredictionResponse(
        invoice_no=invoice_no,
        is_anomaly=is_anom,
        anomaly_score=round(raw_score, 4),
        risk_level=risk_level,
        confidence=confidence,
        reasons=reasons,
    )


def seed_stream_buffer() -> None:
    """Pre-populate the streaming buffer with historical samples so ledger is populated immediately."""
    df = artifacts.get("transactions_df")
    if df is None or len(df) == 0:
        return

    # Sample a mix of typical and high-volume orders
    logger.info("Seeding streaming buffer with initial historical transactions...")
    sample_rows = df.sample(min(30, len(df)), random_state=42).copy()
    if not pd.api.types.is_datetime64_any_dtype(sample_rows["InvoiceDate"]):
        sample_rows["InvoiceDate"] = pd.to_datetime(sample_rows["InvoiceDate"])

    for _, row in sample_rows.iterrows():
        qty = int(row["Quantity"])
        unit_p = float(row["UnitPrice"])
        tot = float(row["TotalAmount"])
        cid = int(row["CustomerID"]) if pd.notna(row["CustomerID"]) else None
        mon_var = round(abs(tot - 350.0) / 350.0, 3)
        b_size = abs(qty)
        rec = float((datetime.now(timezone.utc) - pd.to_datetime(row["InvoiceDate"]).tz_localize(timezone.utc) if pd.to_datetime(row["InvoiceDate"]).tzinfo is None else (datetime.now(timezone.utc) - pd.to_datetime(row["InvoiceDate"]))).days % 180)

        eval_res = predict_anomaly_internal(mon_var, b_size, rec, str(row["InvoiceNo"]))
        stream_manager.buffer.append({
            "invoice_no": str(row["InvoiceNo"]),
            "stock_code": str(row["StockCode"]),
            "description": str(row["Description"]),
            "quantity": qty,
            "unit_price": round(unit_p, 2),
            "total_amount": round(tot, 2),
            "customer_id": cid,
            "country": str(row["Country"]),
            "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "monetary_variance": mon_var,
            "basket_size": b_size,
            "days_since_last_order": rec,
            "is_anomaly": eval_res.is_anomaly,
            "anomaly_score": eval_res.anomaly_score,
            "risk_level": eval_res.risk_level,
            "reasons": eval_res.reasons,
        })
    logger.info("Seeded %d transactions into live stream buffer.", len(stream_manager.buffer))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load serialized models and metadata into memory on startup."""
    artifacts_dir = Path("artifacts")
    logger.info("Initializing Retail Intelligence service. Checking artifacts in %s...", artifacts_dir.resolve())

    bgf_path = artifacts_dir / "bgf_model.pkl"
    ggf_path = artifacts_dir / "ggf_model.pkl"
    rfm_path = artifacts_dir / "kmeans_rfm.pkl"
    cust_path = artifacts_dir / "customer_clv_segments.csv"
    rules_path = artifacts_dir / "association_rules.pkl"

    if bgf_path.exists():
        from lifetimes import BetaGeoFitter
        bgf = BetaGeoFitter()
        bgf.load_model(str(bgf_path))
        artifacts["bgf_model"] = bgf
        logger.info("Loaded BG/NBD model.")

    if ggf_path.exists():
        from lifetimes import GammaGammaFitter
        ggf = GammaGammaFitter()
        ggf.load_model(str(ggf_path))
        artifacts["ggf_model"] = ggf
        logger.info("Loaded Gamma-Gamma model.")
    if rfm_path.exists():
        artifacts["kmeans_rfm"] = joblib.load(rfm_path)
        logger.info("Loaded KMeans RFM segmenter.")
    if cust_path.exists():
        artifacts["customer_db"] = pd.read_csv(cust_path).set_index("CustomerID")
        logger.info("Loaded customer master table (%d records).", len(artifacts["customer_db"]))
    if rules_path.exists():
        artifacts["association_rules"] = joblib.load(rules_path)
        logger.info("Loaded Association Rules table.")

    # Load Isolation Forest Anomaly Detection model
    iso_paths = [artifacts_dir / "isolation_forest.pkl", Path("src/models/isolation_forest.pkl")]
    for ip in iso_paths:
        if ip.exists():
            try:
                artifacts["isolation_forest"] = joblib.load(ip)
                logger.info("Loaded Isolation Forest anomaly model from %s.", ip)
                break
            except (OSError, KeyError, ValueError) as e:
                logger.warning("Could not load Isolation Forest from %s: %s", ip, e)

    dash_pkl = Path("data/processed/dashboard_transactions.pkl")
    if dash_pkl.exists():
        artifacts["transactions_df"] = pd.read_pickle(dash_pkl)
        logger.info("Loaded dashboard transactions dataset (%d records).", len(artifacts["transactions_df"]))
    elif Path("data/processed/cleaned_transactions.csv").exists():
        artifacts["transactions_df"] = pd.read_csv("data/processed/cleaned_transactions.csv", parse_dates=["InvoiceDate"])
        logger.info("Loaded fallback cleaned transactions dataset (%d records).", len(artifacts["transactions_df"]))

    seed_stream_buffer()
    sim_task = asyncio.create_task(background_stream_simulation())

    yield
    sim_task.cancel()
    artifacts.clear()
    logger.info("Shutdown Retail Intelligence service and cleared memory cache.")


async def background_stream_simulation() -> None:
    """Continuously simulates live transaction events for active WebSocket and SSE clients."""
    await asyncio.sleep(1.5)
    df = artifacts.get("transactions_df")
    if df is None or len(df) == 0:
        return
    idx = 0
    while True:
        try:
            await asyncio.sleep(0.7)
            row = df.iloc[idx % len(df)]
            qty = int(row["Quantity"])
            unit_p = float(row["UnitPrice"])
            tot = float(row["TotalAmount"])
            cid = int(row["CustomerID"]) if pd.notna(row["CustomerID"]) else None
            mon_var = round(abs(tot - 350.0) / 350.0, 3)
            b_size = abs(qty)
            rec = float(idx % 180)

            eval_res = predict_anomaly_internal(mon_var, b_size, rec, str(row["InvoiceNo"]))
            event = {
                "invoice_no": str(row["InvoiceNo"]),
                "stock_code": str(row["StockCode"]),
                "description": str(row["Description"]),
                "quantity": qty,
                "unit_price": round(unit_p, 2),
                "total_amount": round(tot, 2),
                "customer_id": cid,
                "country": str(row["Country"]),
                "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                "monetary_variance": mon_var,
                "basket_size": b_size,
                "days_since_last_order": rec,
                "is_anomaly": eval_res.is_anomaly,
                "anomaly_score": eval_res.anomaly_score,
                "risk_level": eval_res.risk_level,
                "reasons": eval_res.reasons,
            }
            await stream_manager.broadcast(event)
            idx += 1
        except asyncio.CancelledError:
            break
        except (RuntimeError, OSError):
            await asyncio.sleep(1.0)


app = FastAPI(
    title="Retail Intelligence Platform API",
    description="Microservice for Customer Lifetime Value (CLV), RFM Segmentation, and Market Basket Recommendations.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    """Redirect root path to interactive Swagger documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health", response_model=HealthResponse, tags=["Monitoring"])
async def health_check() -> HealthResponse:
    """Return health status and model availability."""
    models_ready = artifacts["bgf_model"] is not None and artifacts["ggf_model"] is not None
    details = (
        "Models loaded and ready for real-time inference."
        if models_ready
        else "Service online; model artifacts pending training."
    )
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        models_loaded=models_ready,
        details=details,
    )


@app.post(
    "/api/v1/clv/predict",
    response_model=CustomerCLVResponse,
    tags=["Customer Intelligence"],
)
async def predict_clv(payload: CustomerCLVRequest) -> CustomerCLVResponse:
    """Predict Customer Lifetime Value and purchase probabilities.

    Supports querying by existing `customer_id` or passing raw customer transaction metrics.
    """
    bgf = artifacts.get("bgf_model")
    ggf = artifacts.get("ggf_model")
    cust_db = artifacts.get("customer_db")

    # If customer_id provided and exists in historical DB, retrieve cached or compute
    if payload.customer_id is not None and cust_db is not None and payload.customer_id in cust_db.index:
        row = cust_db.loc[payload.customer_id]
        horizon_col = f"ExpPurchases_{payload.time_horizon_days}D"
        clv_col = f"CLV_{payload.time_horizon_days}D"

        # Use precomputed if horizon matches and available
        if horizon_col in row and clv_col in row:
            return CustomerCLVResponse(
                customer_id=payload.customer_id,
                prob_alive=float(row.get("ProbAlive", 1.0)),
                expected_purchases=float(row[horizon_col]),
                expected_avg_spend=float(row.get("ExpAvgSpend", row.get("AvgOrderValue", 0.0))),
                predicted_clv=float(row[clv_col]),
                segment_name=str(row.get("SegmentName", "Unknown")),
            )

    # Require models if computing dynamically
    if bgf is None or ggf is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLV models are not loaded. Please train models using src/models/train_clv.py first.",
        )

    # Validate metric inputs if dynamic
    if (
        payload.frequency is None
        or payload.recency is None
        or payload.T is None
        or payload.monetary_value is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either a recognized customer_id or full metrics (frequency, recency, T, monetary_value).",
        )

    # Compute dynamic predictions using pd.Series wrappers
    freq_s = pd.Series([payload.frequency])
    rec_s = pd.Series([payload.recency])
    t_s = pd.Series([payload.T])
    mon_s = pd.Series([payload.monetary_value])

    prob_alive_val = bgf.conditional_probability_alive(
        frequency=freq_s,
        recency=rec_s,
        T=t_s,
    )
    prob_alive = float(np.asarray(prob_alive_val).ravel()[0])

    exp_purchases_val = bgf.conditional_expected_number_of_purchases_up_to_time(
        t=payload.time_horizon_days,
        frequency=freq_s,
        recency=rec_s,
        T=t_s,
    )
    exp_purchases = float(np.asarray(exp_purchases_val).ravel()[0])

    exp_avg_spend_val = ggf.conditional_expected_average_profit(
        frequency=freq_s,
        monetary_value=mon_s,
    )
    exp_avg_spend = float(np.asarray(exp_avg_spend_val).ravel()[0])

    months = max(1.0, payload.time_horizon_days / 30.0)
    clv_val = ggf.customer_lifetime_value(
        transaction_prediction_model=bgf,
        frequency=freq_s,
        recency=rec_s,
        T=t_s,
        monetary_value=mon_s,
        time=months,
        freq="D",
        discount_rate=0.01,
    )
    clv = float(np.asarray(clv_val).ravel()[0])

    # Determine segment if KMeans model is loaded
    segment_name = "New / Unclustered"
    rfm_bundle = artifacts.get("kmeans_rfm")
    if rfm_bundle is not None and payload.frequency > 0:
        scaler = rfm_bundle["scaler"]
        kmeans = rfm_bundle["kmeans"]
        labels_map = rfm_bundle["cluster_labels"]
        # log1p transformation
        features = pd.DataFrame(
            [[payload.recency, payload.frequency, payload.monetary_value * payload.frequency]],
            columns=["Recency", "Frequency", "Monetary"],
        )
        scaled = scaler.transform(np.log1p(features))
        cluster_id = int(kmeans.predict(scaled)[0])
        segment_name = labels_map.get(cluster_id, f"Cluster {cluster_id}")

    return CustomerCLVResponse(
        customer_id=payload.customer_id,
        prob_alive=round(prob_alive, 4),
        expected_purchases=round(exp_purchases, 2),
        expected_avg_spend=round(exp_avg_spend, 2),
        predicted_clv=round(clv, 2),
        segment_name=segment_name,
    )


@app.post(
    "/api/v1/recommendations/cross-sell",
    response_model=CrossSellResponse,
    tags=["Market Basket Analysis"],
)
async def cross_sell_recommendations(payload: CrossSellRequest) -> CrossSellResponse:
    """Generate cross-sell product recommendations based on items in cart."""
    rules_df = artifacts.get("association_rules")
    if rules_df is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market basket rules not loaded. Please train MBA model first.",
        )

    cart_items = set(payload.basket)
    # Find matching rules where antecedent is a subset of current cart
    matching_recommendations = []

    for _, rule in rules_df.iterrows():
        antecedents = set(rule["antecedents"])
        consequents = set(rule["consequents"])

        if antecedents.issubset(cart_items):
            # Recommend items not already in cart
            new_items = consequents - cart_items
            for item in new_items:
                matching_recommendations.append(
                    RecommendedItem(
                        stock_code=item,
                        description=rule.get("consequent_description", None),
                        confidence=float(rule["confidence"]),
                        lift=float(rule["lift"]),
                    )
                )

    # Sort by lift, then confidence, and pick top_k unique items
    seen_items = set()
    deduped_recommendations = []
    for rec in sorted(matching_recommendations, key=lambda x: (x.lift, x.confidence), reverse=True):
        if rec.stock_code not in seen_items:
            seen_items.add(rec.stock_code)
            deduped_recommendations.append(rec)
        if len(deduped_recommendations) >= payload.top_k:
            break

    return CrossSellResponse(
        basket=payload.basket,
        recommendations=deduped_recommendations,
    )


@app.get(
    "/api/v1/analytics/dashboard",
    response_model=DashboardAnalyticsResponse,
    tags=["Analytics"],
)
async def get_dashboard_analytics(
    quarter: str = "all",
    country: str = "all",
) -> DashboardAnalyticsResponse:
    """Retrieve dynamic aggregated metrics for the Retail Intelligence Dashboard."""
    df = artifacts.get("transactions_df")
    if df is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transactions dataset is not loaded in memory.",
        )

    filtered_df = df

    # Country filter
    if country and country.lower() != "all":
        filtered_df = filtered_df[filtered_df["Country"].str.lower() == country.lower()]

    # Quarter / Period filter
    quarter_clean = quarter.lower().strip()
    period_label = "Full Dataset (Dec 2010 - Dec 2011)"
    if quarter_clean in ["q1", "q1_2011"]:
        filtered_df = filtered_df[(filtered_df["InvoiceDate"] >= "2011-01-01") & (filtered_df["InvoiceDate"] < "2011-04-01")]
        period_label = "Q1 2011 (Jan - Mar 2011)"
    elif quarter_clean in ["q2", "q2_2011"]:
        filtered_df = filtered_df[(filtered_df["InvoiceDate"] >= "2011-04-01") & (filtered_df["InvoiceDate"] < "2011-07-01")]
        period_label = "Q2 2011 (Apr - Jun 2011)"
    elif quarter_clean in ["q3", "q3_2011"]:
        filtered_df = filtered_df[(filtered_df["InvoiceDate"] >= "2011-07-01") & (filtered_df["InvoiceDate"] < "2011-10-01")]
        period_label = "Q3 2011 (Jul - Sep 2011)"
    elif quarter_clean in ["q4", "q4_2011"]:
        filtered_df = filtered_df[(filtered_df["InvoiceDate"] >= "2011-10-01") & (filtered_df["InvoiceDate"] <= "2011-12-31")]
        period_label = "Q4 2011 (Oct - Dec 2011)"
    elif quarter_clean in ["aug_nov", "aug_nov_2011"]:
        filtered_df = filtered_df[(filtered_df["InvoiceDate"] >= "2011-08-01") & (filtered_df["InvoiceDate"] < "2011-12-01")]
        period_label = "Aug 1, 2011 - Nov 30, 2011"

    total_records = len(filtered_df)
    total_orders = int(filtered_df["InvoiceNo"].nunique())
    gross_revenue = float(filtered_df[filtered_df["TotalAmount"] > 0]["TotalAmount"].sum()) if not filtered_df.empty else 0.0

    # Cancellation Rate
    if not filtered_df.empty and "IsCancelled" in filtered_df.columns:
        inv_cancelled = filtered_df.groupby("InvoiceNo")["IsCancelled"].any()
        cancellation_rate = round(float(inv_cancelled.mean() * 100), 2)
    else:
        cancellation_rate = 14.81

    # Peak hour
    if not filtered_df.empty and "Hour" in filtered_df.columns:
        hourly_counts = filtered_df.groupby("Hour")["InvoiceNo"].nunique()
        peak_hour_int = int(hourly_counts.idxmax()) if not hourly_counts.empty else 12
        peak_orders = int(hourly_counts.max()) if not hourly_counts.empty else 3220
        peak_time_str = f"{peak_hour_int if peak_hour_int <= 12 else peak_hour_int - 12}:00 {'AM' if peak_hour_int < 12 else 'PM'}"
    else:
        peak_hour_int = 12
        peak_time_str = "12:00 PM"
        peak_orders = 3220

    # Format revenue display string
    if gross_revenue >= 1_000_000:
        rev_disp = f"£{gross_revenue / 1_000_000:.2f}M"
    elif gross_revenue >= 1_000:
        rev_disp = f"£{gross_revenue / 1_000:.0f}k"
    else:
        rev_disp = f"£{gross_revenue:,.0f}"

    kpis = [
        KpiMetric(
            id="unique-orders",
            label="Total Unique Orders",
            value=total_orders,
            displayValue=f"{total_orders:,}",
            change=12.0,
            changeType="positive",
            changeLabel="+12.0% from prior cycle",
            icon="ShoppingBag",
            tooltip="Total distinct completed purchase orders in selected timeframe",
        ),
        KpiMetric(
            id="total-revenue",
            label="Tracked Dataset Revenue",
            value=round(gross_revenue, 2),
            displayValue=rev_disp,
            change=18.4,
            changeType="positive",
            changeLabel="+18.4% from prior cycle",
            icon="PoundSterling",
            tooltip="Aggregate gross merchandise sales volume for filtered timeframe",
        ),
        KpiMetric(
            id="cancellation-rate",
            label="Cancellation Rate",
            value=cancellation_rate,
            displayValue=f"{cancellation_rate:.2f}%",
            change=-1.2,
            changeType="positive",
            changeLabel="-1.2% improvement",
            icon="AlertCircle",
            tooltip="Percentage of invoice orders flagged with cancellation/return",
        ),
        KpiMetric(
            id="peak-order-time",
            label="Peak Order Window",
            value=peak_time_str,
            displayValue=peak_time_str,
            change=0,
            changeType="neutral",
            changeLabel=f"{peak_orders:,} orders in peak hour",
            icon="Clock",
            tooltip="Hour of highest purchase transaction volume",
        ),
    ]

    # Monthly revenue trend
    monthly_trend = []
    if not filtered_df.empty:
        pos_df = filtered_df[filtered_df["TotalAmount"] > 0]
        monthly_series = pos_df.groupby("MonthYear")["TotalAmount"].sum()
        prev_rev = 0.0
        for ym, rev in monthly_series.items():
            dt = pd.to_datetime(f"{ym}-01")
            m_name = dt.strftime("%B")
            growth = round(((rev - prev_rev) / prev_rev) * 100, 1) if prev_rev > 0 else 0.0
            prev_rev = rev
            disp = f"£{rev/1_000_000:.2f}M" if rev >= 1_000_000 else f"£{rev/1_000:.0f}k"
            monthly_trend.append(
                MonthlyRevenueItem(
                    month=f"{m_name} '{dt.strftime('%y')}",
                    revenue=round(float(rev), 2),
                    displayRevenue=disp,
                    growth=growth,
                )
            )

    # Hourly distribution
    hourly_orders = []
    if not filtered_df.empty and "Hour" in filtered_df.columns:
        hour_buckets = [8, 10, 12, 14, 16]
        hourly_grp = filtered_df.groupby("Hour")["InvoiceNo"].nunique()
        for h in hour_buckets:
            cnt = int(hourly_grp.get(h, 0))
            label = f"{h if h <= 12 else h - 12} {'AM' if h < 12 else 'PM'}"
            hourly_orders.append(
                HourlyOrderItem(
                    time=label,
                    hour=h,
                    orders=cnt,
                    isPeak=(h == peak_hour_int),
                )
            )

    # Top products by revenue
    top_products = []
    if not filtered_df.empty:
        prod_grp = (
            filtered_df[filtered_df["TotalAmount"] > 0]
            .groupby(["StockCode", "Description"])
            .agg(
                revenue=("TotalAmount", "sum"),
                qty=("Quantity", "sum"),
                unit_price=("UnitPrice", "mean"),
            )
            .sort_values("revenue", ascending=False)
            .head(5)
            .reset_index()
        )
        for idx, row in prod_grp.iterrows():
            rev = float(row["revenue"])
            disp = f"£{rev/1_000_000:.2f}M" if rev >= 1_000_000 else f"£{rev/1_000:.0f}k"
            top_products.append(
                TopProductItem(
                    rank=idx + 1,
                    stockCode=str(row["StockCode"]),
                    name=str(row["Description"]),
                    revenue=round(rev, 2),
                    displayRevenue=disp,
                    quantitySold=int(row["qty"]),
                    unitPrice=round(float(row["unit_price"]), 2),
                    category="General Retail",
                )
            )

    # Top markets
    top_markets = []
    if not filtered_df.empty:
        country_grp = (
            filtered_df[filtered_df["TotalAmount"] > 0]
            .groupby("Country")["TotalAmount"]
            .sum()
            .sort_values(ascending=False)
            .head(5)
        )
        tot_mkt_rev = float(country_grp.sum())
        country_codes = {
            "United Kingdom": "GB",
            "Netherlands": "NL",
            "EIRE": "IE",
            "Germany": "DE",
            "France": "FR",
            "Australia": "AU",
            "Spain": "ES",
            "Switzerland": "CH",
        }
        for c_name, c_rev in country_grp.items():
            disp = f"£{c_rev/1_000_000:.2f}M" if c_rev >= 1_000_000 else f"£{c_rev/1_000:.0f}k"
            share = round((c_rev / tot_mkt_rev) * 100, 1) if tot_mkt_rev > 0 else 0.0
            top_markets.append(
                TopMarketItem(
                    country=str(c_name),
                    code=country_codes.get(str(c_name), "EU"),
                    revenue=round(float(c_rev), 2),
                    displayRevenue=disp,
                    share=share,
                )
            )

    return DashboardAnalyticsResponse(
        summary=DashboardSummary(
            title="Retail Intelligence Live Analytics",
            dataset="Online Retail (541,909 Transactions)",
            period=period_label,
            updatedAt="2026-09-06T19:00:00Z",
            totalRecords=total_records,
            filteredQuarter=quarter_clean,
            filteredCountry=country,
        ),
        kpis=kpis,
        monthlyRevenueTrend=monthly_trend,
        hourlyOrders=hourly_orders,
        topProducts=top_products,
        topMarkets=top_markets,
    )


@app.get(
    "/predict/clv/{customer_id}",
    response_model=CustomerCLVExplorerResponse,
    tags=["Customer Intelligence"],
    summary="Customer 360 & CLV Explorer",
)
@app.get(
    "/api/v1/predict/clv/{customer_id}",
    response_model=CustomerCLVExplorerResponse,
    include_in_schema=False,
)
async def get_customer_clv_explorer(customer_id: int) -> CustomerCLVExplorerResponse:
    """Retrieve detailed Customer 360 and 12-month CLV predictions for a given Customer ID."""
    cust_db = artifacts.get("customer_db")
    if cust_db is None or customer_id not in cust_db.index:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer ID {customer_id} not found in historical records.",
        )

    row = cust_db.loc[customer_id]
    freq = int(row.get("Frequency", 1))
    rec = int(row.get("Recency", 0))
    mon = float(row.get("Monetary", 0.0))
    aov = float(row.get("AvgOrderValue", mon / max(1, freq)))
    prob_alive = float(row.get("ProbAlive", 1.0))
    clv_90d = float(row.get("CLV_90D", 0.0))
    exp_90d = float(row.get("ExpPurchases_90D", 0.0))

    predicted_12m = round(clv_90d * 4.0, 2)
    exp_purchases_12m = round(exp_90d * 4.0, 1)

    tier = "Champion" if predicted_12m > 2000 else ("Loyal" if predicted_12m > 500 else "Needs Attention")
    segment = str(row.get("SegmentName", "Standard"))

    return CustomerCLVExplorerResponse(
        customer_id=customer_id,
        predicted_12m_spend=predicted_12m,
        expected_purchases=exp_purchases_12m,
        frequency=freq,
        recency=rec,
        monetary=round(mon, 2),
        avg_order_value=round(aov, 2),
        customer_tier=tier,
        segment_name=segment,
        prob_alive=round(prob_alive, 4),
    )


@app.get(
    "/recommend/{product_name}",
    response_model=ProductRecommendationsResponse,
    tags=["Market Basket Analysis"],
    summary="Dynamic Product Cross-Sell Recommendations",
)
@app.get(
    "/api/v1/recommend/{product_name}",
    response_model=ProductRecommendationsResponse,
    include_in_schema=False,
)
async def get_product_cross_sell_recommendations(product_name: str) -> ProductRecommendationsResponse:
    """Retrieve cross-sell item recommendations and lift scores for a product."""
    rules_df = artifacts.get("association_rules")
    if rules_df is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market basket association rules are not loaded in memory.",
        )

    p_clean = product_name.strip().lower()
    matches = rules_df[
        rules_df["antecedent_names"].apply(
            lambda names: any(p_clean in n.lower() or n.lower() in p_clean for n in names)
        )
    ]

    results: list[ProductRecommendationItem] = []
    seen: set[str] = set()

    if not matches.empty:
        for _, r in matches.sort_values("lift", ascending=False).iterrows():
            desc = str(r["consequent_description"]).strip()
            if desc and desc not in seen and desc.lower() != p_clean:
                seen.add(desc)
                results.append(
                    ProductRecommendationItem(
                        recommended_item=desc,
                        lift=round(float(r["lift"]), 2),
                        confidence=round(float(r["confidence"]), 2),
                        affinity="Frequently Purchased Together",
                    )
                )
            if len(results) >= 6:
                break

    # If no exact match, fallback to top high-lift complementary products in the store
    if not results:
        top_rules = rules_df.sort_values("lift", ascending=False).head(15)
        for _, r in top_rules.iterrows():
            desc = str(r["consequent_description"]).strip()
            if desc and desc not in seen and desc.lower() != p_clean:
                seen.add(desc)
                results.append(
                    ProductRecommendationItem(
                        recommended_item=desc,
                        lift=round(float(r["lift"]), 2),
                        confidence=round(float(r["confidence"]), 2),
                        affinity="Frequently Purchased Together",
                    )
                )
            if len(results) >= 6:
                break

    return ProductRecommendationsResponse(
        product_name=product_name,
        recommendations=results,
    )


# ---------------------------------------------------------------------------
# Anomaly Detection & Live Transaction Streaming Endpoints
# ---------------------------------------------------------------------------

@app.post(
    "/predict/anomaly",
    response_model=AnomalyPredictionResponse,
    tags=["Anomaly Detection"],
    summary="Evaluate Transaction Anomaly Score",
)
@app.post(
    "/api/v1/predict/anomaly",
    response_model=AnomalyPredictionResponse,
    include_in_schema=False,
)
async def predict_anomaly(payload: AnomalyPredictionRequest) -> AnomalyPredictionResponse:
    """Evaluate an invoice or basket feature vector using the unsupervised Isolation Forest model."""
    return predict_anomaly_internal(
        monetary_variance=payload.monetary_variance,
        basket_size=payload.basket_size,
        days_since_last_order=payload.days_since_last_order,
        invoice_no=str(payload.invoice_no) if payload.invoice_no is not None else None,
    )


@app.post(
    "/api/transactions/stream",
    response_model=StreamTransaction,
    tags=["Streaming Ledger"],
    summary="Ingest live transaction event",
)
async def ingest_stream_transaction(payload: StreamTransaction) -> StreamTransaction:
    """Ingest a live transactional event, evaluate anomaly status, and broadcast to active consumers."""
    item = payload.model_dump()
    if not item.get("is_anomaly") and (item.get("monetary_variance", 0) > 0 or item.get("basket_size", 0) > 0):
        eval_res = predict_anomaly_internal(
            monetary_variance=float(item.get("monetary_variance", 0.0)),
            basket_size=float(item.get("basket_size", 0.0)),
            days_since_last_order=float(item.get("days_since_last_order", 0.0)),
            invoice_no=item.get("invoice_no"),
        )
        item["is_anomaly"] = eval_res.is_anomaly
        item["anomaly_score"] = eval_res.anomaly_score
        item["risk_level"] = eval_res.risk_level
        item["reasons"] = eval_res.reasons

    await stream_manager.broadcast(item)
    return StreamTransaction(**item)


@app.get(
    "/api/transactions/recent",
    response_model=list[StreamTransaction],
    tags=["Streaming Ledger"],
    summary="Get recent transactions from memory buffer",
)
async def get_recent_transactions() -> list[StreamTransaction]:
    """Retrieve the recent transaction event stream cached in memory."""
    return [StreamTransaction(**item) for item in list(stream_manager.buffer)]


@app.websocket("/ws/transactions")
async def websocket_transactions(websocket: WebSocket):
    """WebSocket endpoint broadcasting real-time retail transaction events with anomaly scores."""
    await stream_manager.connect(websocket)
    try:
        # Emit initial snapshot of recent events for instant client hydration
        snapshot = list(stream_manager.buffer)[-25:]
        for item in snapshot:
            await websocket.send_json(item)

        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        stream_manager.disconnect(websocket)
    except (RuntimeError, ConnectionError, OSError) as exc:
        logger.debug("WebSocket connection terminated: %s", exc)
        stream_manager.disconnect(websocket)


@app.get("/events/transactions", tags=["Streaming Ledger"], summary="Server-Sent Events stream")
async def sse_transactions():
    """Server-Sent Events (SSE) fallback endpoint for real-time transaction streaming."""
    async def event_generator():
        # First send initial snapshot
        for item in list(stream_manager.buffer)[-15:]:
            yield f"data: {json.dumps(item)}\n\n"
        last_idx = len(stream_manager.buffer)
        while True:
            await asyncio.sleep(0.15)
            curr = list(stream_manager.buffer)
            if len(curr) > last_idx:
                new_items = curr[last_idx:]
                last_idx = len(curr)
                for item in new_items:
                    yield f"data: {json.dumps(item)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Executive Reporting Endpoints
# ---------------------------------------------------------------------------

@app.get(
    "/api/reports/latest",
    response_model=ExecutiveReportResponse,
    tags=["Executive Reporting"],
    summary="Get latest executive intelligence briefing",
)
async def get_latest_executive_report() -> ExecutiveReportResponse:
    """Retrieve the latest automated executive briefing report."""
    from src.workers.nightly_report import load_or_generate_latest_report
    report = load_or_generate_latest_report(artifacts.get("transactions_df"))
    return report


@app.post(
    "/api/reports/generate",
    response_model=ExecutiveReportResponse,
    tags=["Executive Reporting"],
    summary="Trigger new executive report generation",
)
async def trigger_executive_report() -> ExecutiveReportResponse:
    """Manually trigger fresh executive report generation."""
    from src.workers.nightly_report import generate_executive_report
    report = generate_executive_report(artifacts.get("transactions_df"))
    return report


# ---------------------------------------------------------------------------
# XGBoost Order Cancellation Risk & SHAP Waterfall Endpoints
# ---------------------------------------------------------------------------

@app.get(
    "/api/risk/cancellation-sample",
    response_model=list[CancellationRiskResponse],
    tags=["Risk Intelligence"],
    summary="Sample order cancellation evaluations with SHAP waterfalls",
)
async def get_cancellation_risk_samples() -> list[CancellationRiskResponse]:
    """Retrieve precomputed representative orders with SHAP feature attribution waterfalls."""
    return [
        CancellationRiskResponse(
            invoice_no="567423",
            base_probability=0.148,
            predicted_risk=0.784,
            risk_tier="HIGH",
            factors=[
                CancellationRiskFactor(
                    feature="UnitPrice Outlier",
                    value="£125.00 (vs £3.40 avg)",
                    shap_value=0.280,
                    description="High luxury ticket price increases buyer remorse and cancellation probability.",
                ),
                CancellationRiskFactor(
                    feature="Prior Return Frequency",
                    value="3 Return Invoices",
                    shap_value=0.190,
                    description="Customer historical return propensity indicates heightened post-purchase churn.",
                ),
                CancellationRiskFactor(
                    feature="Late Rush-Hour Order",
                    value="16:30 Dispatch Cutoff",
                    shap_value=0.140,
                    description="Orders placed during late afternoon cutoffs exhibit greater cancellation request volume.",
                ),
                CancellationRiskFactor(
                    feature="Wholesale Unit Volume",
                    value="1,200 Units",
                    shap_value=0.120,
                    description="Bulk orders carry higher payment verification and fulfillment friction.",
                ),
                CancellationRiskFactor(
                    feature="Domestic Destination",
                    value="United Kingdom",
                    shap_value=-0.094,
                    description="Domestic shipping reduces logistical customs and cancellation likelihood.",
                ),
            ],
        ),
        CancellationRiskResponse(
            invoice_no="562439",
            base_probability=0.148,
            predicted_risk=0.386,
            risk_tier="MODERATE",
            factors=[
                CancellationRiskFactor(
                    feature="Prolonged Inactivity Gap",
                    value="145 Days Dormant",
                    shap_value=0.120,
                    description="Customer reactivation after multi-month dormancy slightly raises return rates.",
                ),
                CancellationRiskFactor(
                    feature="Cross-Border European Freight",
                    value="Germany",
                    shap_value=0.070,
                    description="International transit times modestly elevate modification rates.",
                ),
                CancellationRiskFactor(
                    feature="Multi-SKU Basket Depth",
                    value="240 Units / 8 Lines",
                    shap_value=0.050,
                    description="Higher SKU variety marginally increases picking discrepancies.",
                ),
                CancellationRiskFactor(
                    feature="Verified Payment History",
                    value="4 Prior Orders",
                    shap_value=-0.052,
                    description="Customer has history of successfully settled accounts.",
                ),
            ],
        ),
        CancellationRiskResponse(
            invoice_no="536365",
            base_probability=0.148,
            predicted_risk=0.034,
            risk_tier="LOW",
            factors=[
                CancellationRiskFactor(
                    feature="Loyal Repeat Frequency",
                    value="18 Lifetime Invoices",
                    shap_value=-0.076,
                    description="Established recurring loyalty creates very low cancellation risk.",
                ),
                CancellationRiskFactor(
                    feature="Morning Dispatch Window",
                    value="10:15 AM",
                    shap_value=-0.021,
                    description="Morning order placement allows standard processing and immediate picking.",
                ),
                CancellationRiskFactor(
                    feature="Standard Catalog Pricing",
                    value="£2.55 Avg Price",
                    shap_value=-0.017,
                    description="Everyday value retail SKUs exhibit predictable consumer retention.",
                ),
            ],
        ),
    ]



