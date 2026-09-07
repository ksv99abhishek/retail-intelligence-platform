"""Live transaction streaming worker simulating real-time retail transaction events.

Streams transactions to the Retail Intelligence FastAPI backend at configurable intervals
(default 100ms) with automated anomaly evaluation.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure workspace root is on sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

import httpx
import pandas as pd

logger = logging.getLogger("stream_worker")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def load_dataset(data_path: str | Path = "data/processed/dashboard_transactions.pkl") -> pd.DataFrame:
    """Load dataset for streaming simulation."""
    p = Path(data_path)
    if not p.exists():
        fallback = Path("data/processed/cleaned_transactions.csv")
        if fallback.exists():
            return pd.read_csv(fallback, parse_dates=["InvoiceDate"])
        raise FileNotFoundError(f"Cannot find transactions dataset at {p} or {fallback}.")
    if p.suffix == ".pkl":
        return pd.read_pickle(p)
    return pd.read_csv(p, parse_dates=["InvoiceDate"])


class TransactionStreamer:
    """Simulates a live transactional event stream from historical records."""

    def __init__(
        self,
        df: pd.DataFrame,
        endpoint: str = "http://127.0.0.1:8000/api/transactions/stream",
        interval: float = 0.1,
    ) -> None:
        self.df = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(self.df["InvoiceDate"]):
            self.df["InvoiceDate"] = pd.to_datetime(self.df["InvoiceDate"])
        self.df = self.df.sort_values("InvoiceDate").reset_index(drop=True)
        self.endpoint = endpoint
        self.interval = interval
        self.running = False

        # Precompute invoice-level statistics for fast streaming
        logger.info("Precomputing streaming metadata for %d records...", len(self.df))
        self.cust_means = (
            self.df.groupby("CustomerID")["TotalAmount"].sum()
            / self.df.groupby("CustomerID")["InvoiceNo"].nunique()
        ).to_dict()

        inv_sizes = self.df.groupby("InvoiceNo")["Quantity"].sum().to_dict()
        self.inv_sizes = inv_sizes

    def build_transaction_payload(self, idx: int) -> dict[str, Any]:
        """Format a row into a StreamTransaction schema payload."""
        row = self.df.iloc[idx % len(self.df)]
        cid = row["CustomerID"] if pd.notna(row["CustomerID"]) else None
        mean_spend = self.cust_means.get(cid, 350.0) if cid else 250.0
        line_spend = float(row["TotalAmount"])
        variance = abs(line_spend - mean_spend) / max(50.0, mean_spend)
        basket_sz = int(self.inv_sizes.get(row["InvoiceNo"], abs(int(row["Quantity"]))))

        # Randomize simulated timestamp to current time for live streaming freshness
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        return {
            "invoice_no": str(row["InvoiceNo"]),
            "stock_code": str(row["StockCode"]),
            "description": str(row["Description"]),
            "quantity": int(row["Quantity"]),
            "unit_price": round(float(row["UnitPrice"]), 2),
            "total_amount": round(line_spend, 2),
            "customer_id": int(cid) if cid is not None else None,
            "country": str(row["Country"]),
            "invoice_date": now_str,
            "monetary_variance": round(variance, 3),
            "basket_size": basket_sz,
            "days_since_last_order": round(float(idx % 180), 1),
        }

    async def run(self, max_events: int = 0) -> None:
        """Stream events asynchronously over HTTP POST."""
        self.running = True
        logger.info(
            "Starting live transaction streaming worker -> %s (interval: %.2fs)...",
            self.endpoint,
            self.interval,
        )

        sent_count = 0
        anomaly_count = 0

        idx = 0
        while self.running:
            payload = self.build_transaction_payload(idx)
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.post(self.endpoint, json=payload)
                if res.status_code == 200:
                    sent_count += 1
                    data = res.json()
                    if data.get("is_anomaly"):
                        anomaly_count += 1
                        logger.warning(
                            "[ANOMALY DETECTED] Inv: %s | Spend: £%.2f | Basket: %d | Score: %.4f",
                            data["invoice_no"],
                            data["total_amount"],
                            data["basket_size"],
                            data["anomaly_score"],
                        )
                    elif sent_count % 50 == 0:
                        logger.info(
                            "Streamed %d transactions (%d anomalies flagged so far)...",
                            sent_count,
                            anomaly_count,
                        )
                else:
                    logger.debug("Ingest endpoint status %d", res.status_code)
            except httpx.RequestError as exc:
                if sent_count == 0:
                    logger.warning("Could not reach %s (%s). Retrying in 1s...", self.endpoint, exc)
                await asyncio.sleep(1.0)
                continue

                idx += 1
                if max_events > 0 and sent_count >= max_events:
                    logger.info("Reached target limit of %d events. Stopping streamer.", max_events)
                    break

                await asyncio.sleep(self.interval)

        logger.info("Transaction stream stopped. Total sent: %d, anomalies: %d", sent_count, anomaly_count)


def main() -> None:
    """CLI entrypoint for transaction streaming worker."""
    parser = argparse.ArgumentParser(description="Live Retail Transaction Streaming Worker.")
    parser.add_argument("--data-path", default="data/processed/dashboard_transactions.pkl")
    parser.add_argument("--endpoint", default="http://127.0.0.1:8000/api/transactions/stream")
    parser.add_argument("--interval", type=float, default=0.1, help="Streaming delay in seconds (default: 0.1s)")
    parser.add_argument("--max-events", type=int, default=0, help="Maximum events to stream (0 = infinite)")
    args = parser.parse_args()

    df = load_dataset(args.data_path)
    streamer = TransactionStreamer(df, endpoint=args.endpoint, interval=args.interval)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def handle_signal(*_: Any) -> None:
        logger.info("Received interrupt signal. Gracefully exiting...")
        streamer.running = False

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_signal)
        except (NotImplementedError, RuntimeError):
            pass

    try:
        loop.run_until_complete(streamer.run(max_events=args.max_events))
    except KeyboardInterrupt:
        logger.info("Exited via KeyboardInterrupt.")
    finally:
        loop.close()


if __name__ == "__main__":
    main()
