"""Customer Lifetime Value (CLV) & RFM Segmentation Training Pipeline.

Integrates:
- Scikit-learn for RFM clustering and customer segmentation.
- BTYD (Beta-Geometric / Negative Binomial Distribution + Gamma-Gamma) for probabilistic CLV.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

import dill
import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Import Probabilistic CLV Models (Lifetimes / BTYD)
BTYD_BACKEND: str | None = None
try:
    from lifetimes import BetaGeoFitter, GammaGammaFitter
    BTYD_BACKEND = "lifetimes"
except (ImportError, AttributeError, RuntimeError):
    try:
        from btyd import BetaGeoFitter, GammaGammaFitter
        BTYD_BACKEND = "btyd"
    except (ImportError, AttributeError, RuntimeError):
        BetaGeoFitter = None
        GammaGammaFitter = None
        BTYD_BACKEND = None

# Local data utilities
try:
    from src.data.preprocess import (
        create_btyd_summary,
        create_rfm_summary,
        load_and_clean_data,
    )
except ImportError:
    # Allow running directly from script directory
    sys.path.append(str(Path(__file__).resolve().parents[2]))
    from src.data.preprocess import (
        create_btyd_summary,
        create_rfm_summary,
        load_and_clean_data,
    )

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("train_clv")


class CLVPipeline:
    """End-to-end pipeline for RFM segmentation and probabilistic CLV modeling."""

    def __init__(
        self,
        n_clusters: int = 4,
        penalizer_coef: float = 0.0,
        random_state: int = 42,
    ):
        """Initialize pipeline with model hyperparameters.

        Args:
            n_clusters: Number of K-Means clusters for RFM segmentation.
            penalizer_coef: L2 penalty parameter for BTYD models (defaults to 0.0).
            random_state: Random seed for reproducibility.
        """
        self.n_clusters = n_clusters
        self.penalizer_coef = penalizer_coef
        self.random_state = random_state

        self.rfm_scaler: StandardScaler | None = None
        self.kmeans_model: KMeans | None = None
        self.cluster_labels_map: dict[int, str] = {}

        self.bgf_model: Any | None = None
        self.ggf_model: Any | None = None

    def segment_rfm(self, rfm_df: pd.DataFrame) -> pd.DataFrame:
        """Perform RFM segmentation using log transformation, scaling, and K-Means.

        Args:
            rfm_df: DataFrame with ['Recency', 'Frequency', 'Monetary'].

        Returns:
            DataFrame with added 'Cluster' and 'SegmentName' columns.
        """
        logger.info("Starting RFM segmentation on %d customer profiles...", len(rfm_df))
        df_rfm = rfm_df.copy()

        # Log transform to mitigate heavy-tail skewness
        features = ["Recency", "Frequency", "Monetary"]
        rfm_log = np.log1p(df_rfm[features])

        # Standardize features
        self.rfm_scaler = StandardScaler()
        rfm_scaled = self.rfm_scaler.fit_transform(rfm_log)

        # Fit KMeans clustering
        self.kmeans_model = KMeans(
            n_clusters=self.n_clusters,
            random_state=self.random_state,
            n_init=10,
        )
        df_rfm["Cluster"] = self.kmeans_model.fit_predict(rfm_scaled)

        # Profile clusters and assign human-interpretable segment names
        cluster_profile = df_rfm.groupby("Cluster").agg(
            Recency_mean=("Recency", "mean"),
            Frequency_mean=("Frequency", "mean"),
            Monetary_mean=("Monetary", "mean"),
            Count=("Recency", "count"),
        )

        # Rank clusters by a composite value score (higher freq/monetary, lower recency)
        # Score = (Rank(Frequency) + Rank(Monetary) + (N - Rank(Recency)))
        r_rank = cluster_profile["Recency_mean"].rank(ascending=False)
        f_rank = cluster_profile["Frequency_mean"].rank(ascending=True)
        m_rank = cluster_profile["Monetary_mean"].rank(ascending=True)
        composite_score = r_rank + f_rank + m_rank
        ranked_clusters = composite_score.sort_values(ascending=False).index.tolist()

        default_names = [
            "Champions",
            "Loyal Customers",
            "Potential Loyalists",
            "At Risk / Hibernating",
            "Promising",
            "Needs Attention",
        ]

        self.cluster_labels_map = {
            cluster_id: default_names[i] if i < len(default_names) else f"Segment {i+1}"
            for i, cluster_id in enumerate(ranked_clusters)
        }

        df_rfm["SegmentName"] = df_rfm["Cluster"].map(self.cluster_labels_map)

        logger.info("RFM Segmentation finished. Cluster Distribution:\n%s", cluster_profile)
        return df_rfm

    def fit_btyd_models(
        self,
        btyd_summary: pd.DataFrame,
    ) -> tuple[Any, Any]:
        """Fit BG/NBD (transaction rate) and Gamma-Gamma (monetary value) models.

        Args:
            btyd_summary: DataFrame containing ['frequency', 'recency', 'T', 'monetary_value'].

        Returns:
            Tuple of (fitted BetaGeoFitter, fitted GammaGammaFitter).
        """
        if BTYD_BACKEND is None:
            raise ImportError(
                "Neither 'btyd' nor 'lifetimes' package is installed. "
                "Please run: pip install btyd"
            )

        logger.info("Fitting BG/NBD model using '%s' backend...", BTYD_BACKEND)
        penalizers_to_try = [self.penalizer_coef, 0.0, 0.001, 0.01, 0.05, 0.1]
        # Remove duplicates while preserving order
        penalizers_to_try = list(dict.fromkeys(penalizers_to_try))

        bgf_fitted = False
        for p in penalizers_to_try:
            try:
                bgf = BetaGeoFitter(penalizer_coef=p)
                bgf.fit(
                    frequency=btyd_summary["frequency"],
                    recency=btyd_summary["recency"],
                    T=btyd_summary["T"],
                )
                self.bgf_model = bgf
                bgf_fitted = True
                logger.info("BG/NBD model converged with penalizer=%.4f. Params: %s", p, bgf.params_)
                break
            except (ValueError, RuntimeError, TypeError, ZeroDivisionError) as e:
                logger.warning("BG/NBD fitting failed with penalizer=%.4f: %s. Trying next...", p, e)

        if not bgf_fitted:
            raise RuntimeError("BG/NBD model failed to converge with all tested penalizers.")

        # Filter repeat customers with positive monetary spend for Gamma-Gamma
        repeat_customers = btyd_summary[
            (btyd_summary["frequency"] > 0) & (btyd_summary["monetary_value"] > 0)
        ]
        logger.info(
            "Fitting Gamma-Gamma model on %d repeat customers...",
            len(repeat_customers),
        )

        ggf_fitted = False
        for p in penalizers_to_try:
            try:
                ggf = GammaGammaFitter(penalizer_coef=p)
                ggf.fit(
                    frequency=repeat_customers["frequency"],
                    monetary_value=repeat_customers["monetary_value"],
                )
                self.ggf_model = ggf
                ggf_fitted = True
                logger.info("Gamma-Gamma model converged with penalizer=%.4f. Params: %s", p, ggf.params_)
                break
            except (ValueError, RuntimeError, TypeError, ZeroDivisionError) as e:
                logger.warning("Gamma-Gamma fitting failed with penalizer=%.4f: %s. Trying next...", p, e)

        if not ggf_fitted:
            raise RuntimeError("Gamma-Gamma model failed to converge with all tested penalizers.")

        return self.bgf_model, self.ggf_model

    def predict_clv(
        self,
        btyd_summary: pd.DataFrame,
        time_horizon_days: int = 90,
        discount_rate_monthly: float = 0.01,
    ) -> pd.DataFrame:
        """Compute expected transactions, expected order value, and CLV predictions.

        Args:
            btyd_summary: DataFrame containing ['frequency', 'recency', 'T', 'monetary_value'].
            time_horizon_days: Future horizon in days (e.g. 90 or 365).
            discount_rate_monthly: Monthly discount rate for DCF valuation.

        Returns:
            DataFrame with predictions per customer.
        """
        if self.bgf_model is None or self.ggf_model is None:
            raise ValueError("Models must be fitted before running predictions.")

        logger.info(
            "Generating predictions for %d-day horizon (monthly discount rate: %.2f)...",
            time_horizon_days,
            discount_rate_monthly,
        )

        predictions = btyd_summary.copy()

        # 1. Probability that customer is currently alive
        prob_alive = self.bgf_model.conditional_probability_alive(
            frequency=predictions["frequency"],
            recency=predictions["recency"],
            T=predictions["T"],
        )
        predictions["ProbAlive"] = pd.Series(prob_alive, index=predictions.index).fillna(1.0)

        # 2. Expected number of transactions in next t days
        exp_purchases = self.bgf_model.conditional_expected_number_of_purchases_up_to_time(
            t=time_horizon_days,
            frequency=predictions["frequency"],
            recency=predictions["recency"],
            T=predictions["T"],
        )
        predictions[f"ExpPurchases_{time_horizon_days}D"] = pd.Series(
            exp_purchases, index=predictions.index
        ).fillna(0.0)

        # 3. Expected average monetary value per transaction
        exp_spend = self.ggf_model.conditional_expected_average_profit(
            frequency=predictions["frequency"],
            monetary_value=predictions["monetary_value"],
        )
        predictions["ExpAvgSpend"] = (
            pd.Series(exp_spend, index=predictions.index)
            .fillna(predictions["monetary_value"])
            .fillna(0.0)
        )

        # 4. Customer Lifetime Value (BTYD formula expects time in months and freq='D')
        time_horizon_months = max(1.0, time_horizon_days / 30.0)
        clv = self.ggf_model.customer_lifetime_value(
            transaction_prediction_model=self.bgf_model,
            frequency=predictions["frequency"],
            recency=predictions["recency"],
            T=predictions["T"],
            monetary_value=predictions["monetary_value"],
            time=time_horizon_months,
            freq="D",
            discount_rate=discount_rate_monthly,
        )
        predictions[f"CLV_{time_horizon_days}D"] = pd.Series(
            clv, index=predictions.index
        ).fillna(0.0)

        return predictions

    def save_artifacts(
        self,
        output_dir: str | Path,
        customer_master: pd.DataFrame,
    ) -> dict[str, str]:
        """Serialize models and customer predictions table.

        Args:
            output_dir: Directory path where artifacts will be written.
            customer_master: Final enriched customer table with RFM + CLV metrics.

        Returns:
            Dictionary of saved artifact file paths.
        """
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        saved_files = {}

        # Save BTYD Models
        bgf_path = out_path / "bgf_model.pkl"
        if self.bgf_model is not None and hasattr(self.bgf_model, "save_model"):
            self.bgf_model.save_model(str(bgf_path), save_generate_data_method=False)
        else:
            with open(bgf_path, "wb") as f:
                dill.dump(self.bgf_model, f)
        saved_files["bgf_model"] = str(bgf_path)

        ggf_path = out_path / "ggf_model.pkl"
        if self.ggf_model is not None and hasattr(self.ggf_model, "save_model"):
            self.ggf_model.save_model(str(ggf_path), save_generate_data_method=False)
        else:
            with open(ggf_path, "wb") as f:
                dill.dump(self.ggf_model, f)
        saved_files["ggf_model"] = str(ggf_path)

        # Save KMeans and Scaler
        rfm_artifacts = {
            "scaler": self.rfm_scaler,
            "kmeans": self.kmeans_model,
            "cluster_labels": self.cluster_labels_map,
        }
        rfm_path = out_path / "kmeans_rfm.pkl"
        joblib.dump(rfm_artifacts, rfm_path)
        saved_files["kmeans_rfm"] = str(rfm_path)

        # Save Customer Summary Table
        summary_csv = out_path / "customer_clv_segments.csv"
        customer_master.to_csv(summary_csv)
        saved_files["customer_clv_segments_csv"] = str(summary_csv)

        # Save Metadata and Segment Aggregates
        metadata = {
            "backend": BTYD_BACKEND,
            "n_customers": len(customer_master),
            "n_clusters": self.n_clusters,
            "segment_distribution": customer_master["SegmentName"].value_counts().to_dict(),
            "mean_clv_by_segment": customer_master.groupby("SegmentName")
            .agg(
                {
                    col: "mean"
                    for col in customer_master.columns
                    if col.startswith("CLV_") or col == "Monetary"
                }
            )
            .to_dict(),
        }
        meta_path = out_path / "training_summary.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
        saved_files["training_summary"] = str(meta_path)

        logger.info("All artifacts successfully saved to %s", out_path.resolve())
        return saved_files


def train_and_evaluate_clv(
    data_path: str | Path,
    output_dir: str | Path = "artifacts",
    time_horizon_days: int = 90,
    n_clusters: int = 4,
    penalizer_coef: float = 0.01,
) -> dict[str, Any]:
    """Execute complete end-to-end training and artifact generation pipeline.

    Args:
        data_path: Path to raw dataset file (Excel/CSV).
        output_dir: Directory to save serialized artifacts.
        time_horizon_days: Forward-looking forecast horizon for CLV.
        n_clusters: Number of K-Means customer clusters.
        penalizer_coef: L2 penalty parameter.

    Returns:
        Dictionary with status, metrics, and saved artifact paths.
    """
    # 1. Load and clean raw transactions (or load from processed cache if available)
    processed_cache = Path("data/processed/cleaned_transactions.csv")
    if processed_cache.exists() and Path(data_path).name == "Online Retail.xlsx":
        logger.info("Loading cached processed transactions from %s ...", processed_cache)
        clean_df = pd.read_csv(processed_cache)
        clean_df["InvoiceDate"] = pd.to_datetime(clean_df["InvoiceDate"])
    else:
        clean_df = load_and_clean_data(data_path)
        processed_cache.parent.mkdir(parents=True, exist_ok=True)
        clean_df.to_csv(processed_cache, index=False)
        logger.info("Saved processed transactions cache to %s", processed_cache)

    # 2. Build RFM and BTYD feature summaries
    rfm_df = create_rfm_summary(clean_df)
    btyd_df = create_btyd_summary(clean_df)

    # 3. Instantiate pipeline
    pipeline = CLVPipeline(
        n_clusters=n_clusters,
        penalizer_coef=penalizer_coef,
    )

    # 4. Perform RFM Segmentation
    rfm_segmented = pipeline.segment_rfm(rfm_df)

    # 5. Fit BTYD Probabilistic Models
    pipeline.fit_btyd_models(btyd_df)

    # 6. Predict CLV
    clv_predictions = pipeline.predict_clv(
        btyd_df,
        time_horizon_days=time_horizon_days,
    )

    # 7. Merge RFM segments and CLV metrics into unified customer master
    customer_master = rfm_segmented.join(
        clv_predictions[["ProbAlive", f"ExpPurchases_{time_horizon_days}D", "ExpAvgSpend", f"CLV_{time_horizon_days}D"]],
        how="inner",
    )

    # 8. Save artifacts
    saved_artifacts = pipeline.save_artifacts(output_dir, customer_master)

    return {
        "status": "success",
        "n_customers": len(customer_master),
        "saved_artifacts": saved_artifacts,
        "sample": customer_master.head(5).to_dict(orient="index"),
    }


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Train CLV (BTYD) & RFM Segmentation (Scikit-Learn) Models."
    )
    parser.add_argument(
        "--data-path",
        type=str,
        default="data/raw/Online Retail.xlsx",
        help="Path to Online Retail dataset (Excel or CSV)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="artifacts",
        help="Directory to save fitted models and predictions",
    )
    parser.add_argument(
        "--time-horizon-days",
        type=int,
        default=90,
        help="Forecast horizon in days for Customer Lifetime Value",
    )
    parser.add_argument(
        "--n-clusters",
        type=int,
        default=4,
        help="Number of clusters for RFM segmentation",
    )
    parser.add_argument(
        "--penalizer",
        type=float,
        default=0.0,
        help="L2 penalizer coefficient for BG/NBD and Gamma-Gamma fitters (default 0.0)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    logger.info("Starting CLV training with arguments: %s", vars(args))
    try:
        results = train_and_evaluate_clv(
            data_path=args.data_path,
            output_dir=args.output_dir,
            time_horizon_days=args.time_horizon_days,
            n_clusters=args.n_clusters,
            penalizer_coef=args.penalizer,
        )
        logger.info("Training pipeline completed successfully.")
        print(json.dumps(results, indent=2, default=str))
    except Exception:
        logger.exception("Training pipeline failed")
        sys.exit(1)

