"""Unit tests for data preprocessing, RFM calculations, and CLV modeling."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.data.preprocess import (
    create_btyd_summary,
    create_rfm_summary,
    load_and_clean_data,
)
from src.models.train_clv import CLVPipeline


@pytest.fixture
def sample_transaction_df():
    """Create a synthetic DataFrame imitating Online Retail dataset."""
    return pd.DataFrame(
        {
            "InvoiceNo": ["536365", "536365", "C536366", "536367", "536368", "536369"],
            "StockCode": ["85123A", "71053", "85123A", "84879", "22728", "22729"],
            "Description": ["WHITE HANGING HEART", "WHITE METAL LANTERN", "CANCELLED", "ASSORTED COLOUR BIRD", "ALARM CLOCK", "BAD PRICE"],
            "Quantity": [6, 8, -6, 2, 4, 1],
            "InvoiceDate": [
                "2010-12-01 08:26:00",
                "2010-12-01 08:26:00",
                "2010-12-01 09:00:00",
                "2010-12-05 10:00:00",
                "2010-12-10 14:00:00",
                "2010-12-12 15:00:00",
            ],
            "UnitPrice": [2.55, 3.39, 2.55, 1.69, 3.75, 0.0],
            "CustomerID": [17850.0, 17850.0, 17850.0, 13047.0, 13047.0, np.nan],
            "Country": ["United Kingdom"] * 6,
        }
    )


def test_data_cleaning_rules(sample_transaction_df, tmp_path):
    """Verify that null CustomerIDs, cancellations, and zero prices are filtered out."""
    csv_path = tmp_path / "sample_retail.csv"
    sample_transaction_df.to_csv(csv_path, index=False)

    cleaned = load_and_clean_data(csv_path)

    # 1. Null CustomerID row should be dropped (row with UnitPrice=0.0 and CustomerID=nan)
    assert not cleaned["CustomerID"].isnull().any()
    assert 17850 in cleaned["CustomerID"].values
    assert 13047 in cleaned["CustomerID"].values

    # 2. Cancellation (InvoiceNo starting with C) should be dropped
    assert not cleaned["InvoiceNo"].str.startswith("C").any()

    # 3. TotalAmount should be Quantity * UnitPrice
    row1 = cleaned.iloc[0]
    assert row1["TotalAmount"] == pytest.approx(row1["Quantity"] * row1["UnitPrice"])

    # 4. Total valid rows: rows 0, 1, 3, 4 -> 4 rows
    assert len(cleaned) == 4


def test_rfm_summary_calculation(sample_transaction_df, tmp_path):
    """Verify RFM metric calculations."""
    csv_path = tmp_path / "sample_retail.csv"
    sample_transaction_df.to_csv(csv_path, index=False)
    cleaned = load_and_clean_data(csv_path)

    ref_date = pd.to_datetime("2010-12-15 00:00:00")
    rfm = create_rfm_summary(cleaned, reference_date=ref_date)

    # Customer 17850 has 1 invoice on 2010-12-01: (6*2.55 + 8*3.39) = 15.30 + 27.12 = 42.42
    assert 17850 in rfm.index
    assert rfm.loc[17850, "Frequency"] == 1
    assert rfm.loc[17850, "Monetary"] == pytest.approx(42.42)
    assert rfm.loc[17850, "Recency"] == 13  # 2010-12-15 - 2010-12-01 is 14 or 13 days depending on hour

    # Customer 13047 has 2 invoices (2010-12-05, 2010-12-10)
    assert 13047 in rfm.index
    assert rfm.loc[13047, "Frequency"] == 2
    assert rfm.loc[13047, "Monetary"] == pytest.approx(2 * 1.69 + 4 * 3.75)


def test_btyd_summary_calculation(sample_transaction_df, tmp_path):
    """Verify BTYD frequency/recency/T transformation."""
    csv_path = tmp_path / "sample_retail.csv"
    sample_transaction_df.to_csv(csv_path, index=False)
    cleaned = load_and_clean_data(csv_path)

    ref_date = pd.to_datetime("2010-12-15")
    btyd_summary = create_btyd_summary(cleaned, reference_date=ref_date)

    # Customer 17850 only purchased on 1 single day -> frequency = 0, recency = 0
    assert btyd_summary.loc[17850, "frequency"] == 0.0
    assert btyd_summary.loc[17850, "recency"] == 0.0
    assert btyd_summary.loc[17850, "T"] == (ref_date - pd.to_datetime("2010-12-01")).days

    # Customer 13047 purchased on 2 distinct days (12-05 and 12-10) -> frequency = 1
    assert btyd_summary.loc[13047, "frequency"] == 1.0
    assert btyd_summary.loc[13047, "recency"] == 5.0  # 10 - 5 = 5 days
    assert btyd_summary.loc[13047, "monetary_value"] == pytest.approx(4 * 3.75)


def test_rfm_segmentation():
    """Verify KMeans RFM clustering and segment naming."""
    # Synthetic RFM data for 10 customers
    np.random.seed(42)
    synthetic_rfm = pd.DataFrame(
        {
            "Recency": [2, 5, 10, 50, 100, 150, 200, 250, 300, 350],
            "Frequency": [20, 15, 12, 6, 4, 3, 2, 1, 1, 1],
            "Monetary": [2000, 1500, 1200, 500, 300, 200, 150, 80, 50, 30],
        },
        index=range(1001, 1011),
    )

    pipeline = CLVPipeline(n_clusters=3, random_state=42)
    segmented = pipeline.segment_rfm(synthetic_rfm)

    assert "Cluster" in segmented.columns
    assert "SegmentName" in segmented.columns
    assert len(segmented["Cluster"].unique()) == 3
    assert len(segmented["SegmentName"].unique()) == 3

