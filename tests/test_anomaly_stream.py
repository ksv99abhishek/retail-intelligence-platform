"""Tests for Anomaly Detection, Live Transaction Streaming, and Executive Reporting."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture
def client():
    """Yield test client with initialized lifespan."""
    with TestClient(app) as c:
        yield c


def test_predict_anomaly_endpoint(client: TestClient):
    """Test POST /predict/anomaly with normal and outlier feature vectors."""
    # Test normal transaction
    res_normal = client.post(
        "/predict/anomaly",
        json={
            "invoice_no": "10001",
            "monetary_variance": 0.1,
            "basket_size": 25,
            "days_since_last_order": 14.0,
        },
    )
    assert res_normal.status_code == 200
    data_normal = res_normal.json()
    assert "is_anomaly" in data_normal
    assert "anomaly_score" in data_normal
    assert "risk_level" in data_normal
    assert data_normal["risk_level"] in ["LOW", "MEDIUM", "HIGH"]

    # Test extreme outlier transaction
    res_outlier = client.post(
        "/predict/anomaly",
        json={
            "invoice_no": "99999",
            "monetary_variance": 5.5,
            "basket_size": 15000,
            "days_since_last_order": 300.0,
        },
    )
    assert res_outlier.status_code == 200
    data_outlier = res_outlier.json()
    assert data_outlier["is_anomaly"] is True
    assert data_outlier["risk_level"] == "HIGH"
    assert len(data_outlier["reasons"]) > 0


def test_streaming_ingest_and_recent(client: TestClient):
    """Test POST /api/transactions/stream and GET /api/transactions/recent."""
    tx_payload = {
        "invoice_no": "TEST-STREAM-01",
        "stock_code": "85123A",
        "description": "WHITE HANGING HEART T-LIGHT HOLDER",
        "quantity": 120,
        "unit_price": 2.55,
        "total_amount": 306.0,
        "customer_id": 17850,
        "country": "United Kingdom",
        "invoice_date": "2026-09-07 10:00:00",
        "monetary_variance": 0.2,
        "basket_size": 120,
        "days_since_last_order": 5.0,
    }
    post_res = client.post("/api/transactions/stream", json=tx_payload)
    assert post_res.status_code == 200
    stream_data = post_res.json()
    assert stream_data["invoice_no"] == "TEST-STREAM-01"
    assert "is_anomaly" in stream_data
    assert "anomaly_score" in stream_data

    # Check that it appears in recent buffer
    get_res = client.get("/api/transactions/recent")
    assert get_res.status_code == 200
    recent_items = get_res.json()
    assert isinstance(recent_items, list)
    assert any(item["invoice_no"] == "TEST-STREAM-01" for item in recent_items)


def test_latest_report_endpoint(client: TestClient):
    """Test GET /api/reports/latest returning valid executive intelligence report."""
    res = client.get("/api/reports/latest")
    assert res.status_code == 200
    report = res.json()
    assert "report_id" in report
    assert "report_date" in report
    assert "total_transactions" in report
    assert "markdown_content" in report
    assert len(report["markdown_content"]) > 100
    assert "Executive Retail Intelligence Briefing" in report["markdown_content"]


def test_cancellation_risk_samples(client: TestClient):
    """Test GET /api/risk/cancellation-sample returning SHAP waterfall factors."""
    res = client.get("/api/risk/cancellation-sample")
    assert res.status_code == 200
    samples = res.json()
    assert isinstance(samples, list)
    assert len(samples) >= 3
    for s in samples:
        assert "invoice_no" in s
        assert "predicted_risk" in s
        assert "risk_tier" in s
        assert "factors" in s
        assert len(s["factors"]) > 0
        for f in s["factors"]:
            assert "feature" in f
            assert "shap_value" in f

