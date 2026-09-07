"""Data loading, cleaning, and transformation functions for Retail Intelligence."""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


def load_and_clean_data(
    file_path: str | Path,
    sheet_name: str | int = 0,
) -> pd.DataFrame:
    """Load raw transaction data (Excel, CSV, or Parquet) and apply cleaning rules.

    Cleaning Rules:
    - Drop rows where CustomerID is null.
    - Convert CustomerID to integer (avoiding float conversions).
    - Remove cancellations (InvoiceNo starting with 'C' or Quantity <= 0).
    - Remove transactions with non-positive UnitPrice.
    - Parse InvoiceDate to datetime.
    - Compute TotalAmount = Quantity * UnitPrice.
    - Clean whitespace in Description and StockCode.

    Args:
        file_path: Path to dataset file.
        sheet_name: Sheet name or index if reading Excel file.

    Returns:
        Cleaned pandas DataFrame.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at: {path.resolve()}")

    logger.info("Loading transaction dataset from %s ...", path)
    if path.suffix.lower() in [".xlsx", ".xls"]:
        df = pd.read_excel(path, sheet_name=sheet_name)
    elif path.suffix.lower() == ".csv":
        df = pd.read_csv(path)
    elif path.suffix.lower() == ".parquet":
        df = pd.read_parquet(path)
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")

    initial_rows = len(df)
    logger.info("Loaded %d raw records.", initial_rows)

    required_columns = [
        "InvoiceNo",
        "StockCode",
        "Description",
        "Quantity",
        "InvoiceDate",
        "UnitPrice",
        "CustomerID",
    ]
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise KeyError(f"Missing required columns in dataset: {missing_cols}")

    # Drop missing CustomerID
    df = df.dropna(subset=["CustomerID"]).copy()
    logger.info("Dropped null CustomerIDs. Remaining: %d rows.", len(df))

    # Clean CustomerID as integer
    df["CustomerID"] = df["CustomerID"].astype(int)

    # Convert InvoiceNo to string and clean
    df["InvoiceNo"] = df["InvoiceNo"].astype(str).str.strip()

    # Filter out cancellations & negative/zero quantities
    is_cancellation = df["InvoiceNo"].str.startswith("C", na=False)
    is_positive_qty = df["Quantity"] > 0
    is_positive_price = df["UnitPrice"] > 0

    df = df[~is_cancellation & is_positive_qty & is_positive_price].copy()
    logger.info(
        "Filtered cancellations and non-positive quantity/prices. Remaining: %d rows.",
        len(df),
    )

    # Convert InvoiceDate to datetime
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])

    # Clean text columns
    df["Description"] = df["Description"].astype(str).str.strip()
    df["StockCode"] = df["StockCode"].astype(str).str.strip()

    # Monetary value per item line
    df["TotalAmount"] = df["Quantity"] * df["UnitPrice"]

    logger.info(
        "Data cleaning complete. Retained %d of %d original records (%.2f%%).",
        len(df),
        initial_rows,
        (len(df) / initial_rows) * 100 if initial_rows > 0 else 0,
    )

    return df


def create_rfm_summary(
    df: pd.DataFrame,
    reference_date: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Compute Recency, Frequency, Monetary (RFM) metrics per customer.

    Args:
        df: Cleaned transaction DataFrame.
        reference_date: Analysis cutoff date. Defaults to max(InvoiceDate) + 1 day.

    Returns:
        DataFrame indexed by CustomerID with columns:
        - Recency: Days since last purchase.
        - Frequency: Total number of unique purchase days / transactions.
        - Monetary: Total monetary spend across all transactions.
        - AvgOrderValue: Average spend per order.
    """
    if reference_date is None:
        reference_date = df["InvoiceDate"].max() + pd.Timedelta(days=1)
    else:
        reference_date = pd.to_datetime(reference_date)

    # Aggregate per customer
    rfm = df.groupby("CustomerID").agg(
        LastInvoiceDate=("InvoiceDate", "max"),
        FirstInvoiceDate=("InvoiceDate", "min"),
        Frequency=("InvoiceNo", "nunique"),
        Monetary=("TotalAmount", "sum"),
    )

    rfm["Recency"] = (reference_date - rfm["LastInvoiceDate"]).dt.days
    rfm["CustomerTenureDays"] = (reference_date - rfm["FirstInvoiceDate"]).dt.days
    rfm["AvgOrderValue"] = rfm["Monetary"] / rfm["Frequency"]

    return rfm[["Recency", "Frequency", "Monetary", "AvgOrderValue", "CustomerTenureDays"]]


def create_btyd_summary(
    df: pd.DataFrame,
    reference_date: pd.Timestamp | None = None,
    freq: str = "D",
) -> pd.DataFrame:
    """Transform transaction data into BTYD RFM format (frequency, recency, T, monetary_value).

    Compatible with both `btyd` and `lifetimes` summary_data_from_transaction_data format.

    Definitions:
    - frequency: Count of repeat transaction periods (total unique periods - 1).
    - recency: Time between first and last purchase period (in days).
    - T: Age of customer (time between first purchase and observation period end).
    - monetary_value: Average spend per repeat purchase period.

    Args:
        df: Cleaned transactions DataFrame.
        reference_date: Cutoff date for the observation period.
        freq: Time frequency string ('D' for daily).

    Returns:
        DataFrame indexed by CustomerID with columns:
        ['frequency', 'recency', 'T', 'monetary_value']
    """
    if reference_date is None:
        reference_date = df["InvoiceDate"].max()
    else:
        reference_date = pd.to_datetime(reference_date)

    # Ensure transaction date only (daily granularity)
    df_daily = df.copy()
    df_daily["Date"] = df_daily["InvoiceDate"].dt.floor(freq)

    # Aggregate by customer and day
    customer_daily = df_daily.groupby(["CustomerID", "Date"]).agg(
        Spend=("TotalAmount", "sum")
    ).reset_index()

    grouped = customer_daily.groupby("CustomerID")

    summary_list = []
    for customer_id, group in grouped:
        dates = group["Date"].sort_values()
        first_date = dates.iloc[0]
        last_date = dates.iloc[-1]
        n_periods = len(dates)

        frequency = n_periods - 1
        recency = (last_date - first_date).days
        customer_age = (reference_date - first_date).days

        if frequency > 0:
            # Average spend of repeat transactions (excluding the initial purchase)
            repeat_spend = group[group["Date"] > first_date]["Spend"]
            monetary_value = repeat_spend.mean() if not repeat_spend.empty else 0.0
        else:
            monetary_value = 0.0

        summary_list.append(
            {
                "CustomerID": customer_id,
                "frequency": float(frequency),
                "recency": float(recency),
                "T": float(max(customer_age, recency)),
                "monetary_value": float(monetary_value),
            }
        )

    summary_df = pd.DataFrame(summary_list).set_index("CustomerID")
    return summary_df

