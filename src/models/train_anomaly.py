"""Unsupervised Anomaly Detection Pipeline using Scikit-Learn IsolationForest."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("train_anomaly")


def extract_transaction_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Extract invoice-level features for anomaly detection.

    Features:
    - MonetaryVariance: Normalized deviation of invoice spend relative to customer historical mean.
    - BasketSize: Total quantity of items in the invoice.
    - DaysSinceLastOrder: Days since customer's previous order.

    Returns:
        Tuple of (feature_dataframe, full_invoice_summary_dataframe).
    """
    logger.info("Extracting anomaly features from %d transaction records...", len(df))
    pos_df = df[df["TotalAmount"] > 0].copy()

    # Invoice-level aggregations
    inv_summary = (
        pos_df.groupby("InvoiceNo")
        .agg(
            CustomerID=("CustomerID", "first"),
            InvoiceDate=("InvoiceDate", "first"),
            TotalAmount=("TotalAmount", "sum"),
            BasketSize=("Quantity", "sum"),
            ItemCount=("StockCode", "nunique"),
            Country=("Country", "first"),
        )
        .reset_index()
    )

    # Calculate customer spending baseline
    cust_stats = (
        inv_summary.groupby("CustomerID")["TotalAmount"]
        .agg(mean_spend="mean", std_spend="std")
        .reset_index()
    )
    cust_stats["std_spend"] = cust_stats["std_spend"].fillna(0.0)

    inv_summary = inv_summary.merge(cust_stats, on="CustomerID", how="left")

    # MonetaryVariance: Z-score if std > 0, else relative deviation
    std_safe = inv_summary["std_spend"].replace(0, np.nan)
    z_score = np.abs(inv_summary["TotalAmount"] - inv_summary["mean_spend"]) / std_safe
    rel_dev = np.abs(inv_summary["TotalAmount"] - inv_summary["mean_spend"]) / (
        inv_summary["mean_spend"] + 1e-5
    )
    inv_summary["MonetaryVariance"] = z_score.fillna(rel_dev).fillna(0.0).clip(0, 15.0)

    # DaysSinceLastOrder
    inv_summary = inv_summary.sort_values(["CustomerID", "InvoiceDate"])
    inv_summary["PrevDate"] = inv_summary.groupby("CustomerID")["InvoiceDate"].shift(1)
    inv_summary["DaysSinceLastOrder"] = (
        (inv_summary["InvoiceDate"] - inv_summary["PrevDate"]).dt.total_seconds() / 86400.0
    ).fillna(30.0).clip(0, 365.0)

    # Ensure BasketSize is non-negative
    inv_summary["BasketSize"] = inv_summary["BasketSize"].clip(lower=1)

    feature_cols = ["MonetaryVariance", "BasketSize", "DaysSinceLastOrder"]
    features_df = inv_summary[feature_cols].copy()

    logger.info("Engineered %d invoice feature vectors. Feature summary:\n%s", len(features_df), features_df.describe())
    return features_df, inv_summary


def train_isolation_forest(
    features_df: pd.DataFrame,
    contamination: float = 0.01,
    random_state: int = 42,
    n_estimators: int = 100,
) -> IsolationForest:
    """Fit Scikit-Learn IsolationForest model."""
    logger.info(
        "Fitting IsolationForest (contamination=%.3f, n_estimators=%d, random_state=%d)...",
        contamination,
        n_estimators,
        random_state,
    )
    model = IsolationForest(
        contamination=contamination,
        random_state=random_state,
        n_estimators=n_estimators,
        n_jobs=-1,
    )
    model.fit(features_df)

    preds = model.predict(features_df)
    n_anomalies = int((preds == -1).sum())
    logger.info(
        "Training complete. Identified %d anomalies out of %d samples (%.2f%%).",
        n_anomalies,
        len(features_df),
        (n_anomalies / len(features_df)) * 100,
    )
    return model


def save_artifacts(
    model: IsolationForest,
    feature_names: list[str],
    output_paths: list[str | Path],
) -> list[str]:
    """Serialize the trained IsolationForest model artifact."""
    saved = []
    bundle: dict[str, Any] = {
        "model": model,
        "feature_names": feature_names,
        "algorithm": "IsolationForest",
        "contamination": model.contamination,
    }
    for p in output_paths:
        path = Path(p)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(bundle, path)
        logger.info("Saved anomaly detection artifact to %s", path.resolve())
        saved.append(str(path))
    return saved


def main() -> None:
    """Execute anomaly model training pipeline."""
    parser = argparse.ArgumentParser(description="Train IsolationForest Anomaly Detection Model.")
    parser.add_argument(
        "--data-path",
        type=str,
        default="data/processed/dashboard_transactions.pkl",
        help="Path to transaction pickle or CSV.",
    )
    parser.add_argument(
        "--contamination",
        type=float,
        default=0.01,
        help="Expected proportion of transactional anomalies.",
    )
    args = parser.parse_args()

    data_path = Path(args.data_path)
    if data_path.suffix == ".pkl":
        df = pd.read_pickle(data_path)
    else:
        df = pd.read_csv(data_path, parse_dates=["InvoiceDate"])

    features_df, inv_summary = extract_transaction_features(df)
    model = train_isolation_forest(features_df, contamination=args.contamination)

    # Save to both src/models/isolation_forest.pkl and artifacts/isolation_forest.pkl
    output_paths = [
        Path("src/models/isolation_forest.pkl"),
        Path("artifacts/isolation_forest.pkl"),
    ]
    save_artifacts(model, ["MonetaryVariance", "BasketSize", "DaysSinceLastOrder"], output_paths)

    # Save sample anomalies for inspection and testing
    inv_summary["is_anomaly"] = np.where(model.predict(features_df) == -1, 1, 0)
    inv_summary["anomaly_score"] = -model.decision_function(features_df)
    anomalies = inv_summary[inv_summary["is_anomaly"] == 1].sort_values("anomaly_score", ascending=False)
    logger.info("Top 5 flagged anomalous transactions:\n%s", anomalies[["InvoiceNo", "TotalAmount", "BasketSize", "MonetaryVariance", "anomaly_score"]].head(5))


if __name__ == "__main__":
    main()

