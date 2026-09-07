"""Market Basket Analysis (MBA) using FP-Growth from mlxtend."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from mlxtend.frequent_patterns import association_rules, fpgrowth
from mlxtend.preprocessing import TransactionEncoder

# Local imports
try:
    from src.data.preprocess import load_and_clean_data
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parents[2]))
    from src.data.preprocess import load_and_clean_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("train_mba")


class MarketBasketPipeline:
    """Pipeline for mining frequent itemsets and association rules using FP-Growth."""

    def __init__(
        self,
        min_support: float = 0.015,
        min_lift: float = 1.2,
        min_confidence: float = 0.2,
    ):
        """Initialize MBA parameters.

        Args:
            min_support: Minimum frequency threshold for frequent itemsets.
            min_lift: Minimum lift threshold for strong association rules.
            min_confidence: Minimum conditional probability P(B|A).
        """
        self.min_support = min_support
        self.min_lift = min_lift
        self.min_confidence = min_confidence

        self.item_descriptions: dict[str, str] = {}
        self.frequent_itemsets: pd.DataFrame | None = None
        self.association_rules: pd.DataFrame | None = None

    def prepare_baskets(
        self,
        df: pd.DataFrame,
    ) -> list[list[str]]:
        """Filter transactions and aggregate products by invoice.

        Filters out non-product service codes (POST, MANUAL, D, DOT, etc.).

        Args:
            df: Cleaned transaction DataFrame.

        Returns:
            List of transactions, where each transaction is a list of distinct StockCodes.
        """
        logger.info("Preparing transaction baskets from %d records...", len(df))
        df_clean = df.copy()

        # Build StockCode -> Description lookup table (most common description per StockCode)
        desc_lookup = (
            df_clean.groupby("StockCode")["Description"]
            .agg(lambda x: x.mode().iloc[0] if not x.empty else "")
            .to_dict()
        )
        self.item_descriptions = desc_lookup

        # Filter out postage and internal administrative codes
        excluded_codes = {"POST", "D", "DOT", "M", "CRUK", "BANK CHARGES", "PADS"}
        df_clean = df_clean[~df_clean["StockCode"].isin(excluded_codes)]

        # Group by InvoiceNo and collect unique StockCodes per cart
        baskets_series = df_clean.groupby("InvoiceNo")["StockCode"].apply(lambda s: sorted(set(s)))

        # Keep baskets containing 2 or more distinct items
        baskets = [items for items in baskets_series if len(items) >= 2]
        logger.info("Extracted %d multi-item baskets for association rule mining.", len(baskets))

        return baskets

    def fit(self, baskets: list[list[str]]) -> pd.DataFrame:
        """Run FP-Growth and generate association rules.

        Args:
            baskets: List of transactions.

        Returns:
            Association rules DataFrame.
        """
        logger.info("One-hot encoding baskets with TransactionEncoder...")
        te = TransactionEncoder()
        te_ary = te.fit(baskets).transform(baskets)
        df_encoded = pd.DataFrame(te_ary, columns=te.columns_)

        logger.info(
            "Mining frequent itemsets using FP-Growth (min_support=%.4f)...",
            self.min_support,
        )
        self.frequent_itemsets = fpgrowth(
            df_encoded,
            min_support=self.min_support,
            use_colnames=True,
        )
        logger.info("Discovered %d frequent itemsets.", len(self.frequent_itemsets))

        if self.frequent_itemsets.empty:
            logger.warning("No frequent itemsets found. Try lowering --min-support.")
            self.association_rules = pd.DataFrame()
            return self.association_rules

        logger.info(
            "Generating association rules (min_lift=%.2f, min_confidence=%.2f)...",
            self.min_lift,
            self.min_confidence,
        )
        rules = association_rules(
            self.frequent_itemsets,
            metric="lift",
            min_threshold=self.min_lift,
        )

        # Apply confidence filter
        rules = rules[rules["confidence"] >= self.min_confidence].copy()

        # Convert frozensets to lists for JSON and serialization compatibility
        rules["antecedents_list"] = rules["antecedents"].apply(list)
        rules["consequents_list"] = rules["consequents"].apply(list)

        # Map human-readable descriptions
        rules["antecedent_names"] = rules["antecedents_list"].apply(
            lambda codes: [self.item_descriptions.get(c, c) for c in codes]
        )
        rules["consequent_names"] = rules["consequents_list"].apply(
            lambda codes: [self.item_descriptions.get(c, c) for c in codes]
        )
        rules["consequent_description"] = rules["consequents_list"].apply(
            lambda codes: ", ".join([self.item_descriptions.get(c, c) for c in codes])
        )

        # Sort by lift descending
        rules = rules.sort_values(by=["lift", "confidence"], ascending=[False, False]).reset_index(drop=True)
        self.association_rules = rules

        logger.info("Generated %d strong association rules.", len(rules))
        return rules

    def save_artifacts(
        self,
        output_dir: str | Path,
    ) -> dict[str, str]:
        """Serialize MBA rules and item metadata.

        Args:
            output_dir: Path to directory.

        Returns:
            Dictionary of saved artifact file paths.
        """
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        saved = {}

        if self.association_rules is not None and not self.association_rules.empty:
            rules_path = out_path / "association_rules.pkl"
            joblib.dump(self.association_rules, rules_path)
            saved["association_rules_pkl"] = str(rules_path)

            rules_csv = out_path / "association_rules.csv"
            # Format frozenset columns as string representations for CSV export
            export_df = self.association_rules.copy()
            export_df["antecedents"] = export_df["antecedents"].apply(lambda s: ", ".join(list(s)))
            export_df["consequents"] = export_df["consequents"].apply(lambda s: ", ".join(list(s)))
            export_df.to_csv(rules_csv, index=False)
            saved["association_rules_csv"] = str(rules_csv)

        lookup_path = out_path / "item_descriptions.json"
        with open(lookup_path, "w", encoding="utf-8") as f:
            json.dump(self.item_descriptions, f, indent=2)
        saved["item_descriptions"] = str(lookup_path)

        summary = {
            "min_support": self.min_support,
            "min_lift": self.min_lift,
            "min_confidence": self.min_confidence,
            "n_frequent_itemsets": len(self.frequent_itemsets) if self.frequent_itemsets is not None else 0,
            "n_rules": len(self.association_rules) if self.association_rules is not None else 0,
            "top_rules": [
                {
                    "antecedent": r["antecedent_names"],
                    "consequent": r["consequent_names"],
                    "support": round(r["support"], 4),
                    "confidence": round(r["confidence"], 4),
                    "lift": round(r["lift"], 2),
                }
                for _, r in self.association_rules.head(10).iterrows()
            ]
            if self.association_rules is not None and not self.association_rules.empty
            else [],
        }
        summary_path = out_path / "mba_summary.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        saved["mba_summary"] = str(summary_path)

        logger.info("MBA artifacts successfully saved to %s", out_path.resolve())
        return saved


def train_and_evaluate_mba(
    data_path: str | Path = "data/raw/Online Retail.xlsx",
    output_dir: str | Path = "artifacts",
    min_support: float = 0.015,
    min_lift: float = 1.2,
    min_confidence: float = 0.2,
) -> dict[str, Any]:
    """Complete training pipeline for Market Basket Analysis."""
    processed_cache = Path("data/processed/cleaned_transactions.csv")
    if processed_cache.exists():
        logger.info("Loading cached transactions from %s ...", processed_cache)
        df = pd.read_csv(processed_cache)
    else:
        df = load_and_clean_data(data_path)

    pipeline = MarketBasketPipeline(
        min_support=min_support,
        min_lift=min_lift,
        min_confidence=min_confidence,
    )

    baskets = pipeline.prepare_baskets(df)
    rules = pipeline.fit(baskets)
    saved_files = pipeline.save_artifacts(output_dir)

    return {
        "status": "success",
        "n_rules": len(rules),
        "saved_artifacts": saved_files,
        "sample_rules": rules[["antecedent_names", "consequent_names", "confidence", "lift"]]
        .head(5)
        .to_dict(orient="records"),
    }


def parse_args() -> argparse.Namespace:
    """Parse command line arguments for Market Basket Analysis."""
    parser = argparse.ArgumentParser(
        description="Market Basket Analysis using FP-Growth (mlxtend)."
    )
    parser.add_argument(
        "--data-path",
        type=str,
        default="data/raw/Online Retail.xlsx",
        help="Path to Online Retail transactions dataset",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="artifacts",
        help="Output directory to store association rules and artifacts",
    )
    parser.add_argument(
        "--min-support",
        type=float,
        default=0.015,
        help="Minimum support threshold for frequent itemsets (default 0.015)",
    )
    parser.add_argument(
        "--min-lift",
        type=float,
        default=1.2,
        help="Minimum lift threshold for association rules (default 1.2)",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.2,
        help="Minimum confidence threshold (default 0.2)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    logger.info("Starting Market Basket Analysis training: %s", vars(args))
    try:
        results = train_and_evaluate_mba(
            data_path=args.data_path,
            output_dir=args.output_dir,
            min_support=args.min_support,
            min_lift=args.min_lift,
            min_confidence=args.min_confidence,
        )
        logger.info("Market Basket Analysis pipeline completed successfully.")
        print(json.dumps(results, indent=2, default=str))
    except Exception:
        logger.exception("MBA training failed")
        sys.exit(1)

