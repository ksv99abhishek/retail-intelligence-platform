"""Integration tests for the FastAPI microservice."""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture(scope="module")
def client():
    """Create test client with lifespan event execution."""
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client):
    """Verify health endpoint returns status and confirms models are loaded."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"
    assert data["models_loaded"] is True


def test_clv_predict_by_customer_id(client):
    """Verify CLV prediction by existing customer ID (e.g. 12347 - Champions)."""
    payload = {
        "customer_id": 12347,
        "time_horizon_days": 90,
    }
    response = client.post("/api/v1/clv/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["customer_id"] == 12347
    assert data["prob_alive"] > 0.9
    assert data["expected_purchases"] > 0.0
    assert data["predicted_clv"] > 0.0
    assert "Champions" in data["segment_name"] or len(data["segment_name"]) > 0


def test_clv_predict_dynamic(client):
    """Verify CLV prediction dynamically calculated from customer metrics."""
    payload = {
        "frequency": 3.0,
        "recency": 30.0,
        "T": 90.0,
        "monetary_value": 150.0,
        "time_horizon_days": 90,
    }
    response = client.post("/api/v1/clv/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["prob_alive"] <= 1.0
    assert data["expected_purchases"] > 0.0
    assert data["expected_avg_spend"] > 0.0
    assert data["predicted_clv"] > 0.0


def test_cross_sell_recommendations(client):
    """Verify market basket recommendations for teacup set."""
    # Test with REGENCY CAKESTAND (22423) and GREEN REGENCY TEACUP (22383)
    payload = {
        "basket": ["22423", "22383"],
        "top_k": 3,
    }
    response = client.post("/api/v1/recommendations/cross-sell", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["basket"] == ["22423", "22383"]
    assert len(data["recommendations"]) > 0
    # Top recommendation should have high lift
    top_rec = data["recommendations"][0]
    assert top_rec["lift"] > 1.0
    assert top_rec["confidence"] > 0.0


def test_dashboard_analytics_endpoint(client):
    """Verify live dashboard analytics aggregation endpoint."""
    response = client.get("/api/v1/analytics/dashboard?quarter=all")
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["dataset"] is not None
    assert len(data["kpis"]) == 4
    assert len(data["monthlyRevenueTrend"]) == 13
    assert len(data["hourlyOrders"]) == 5
    assert len(data["topProducts"]) == 5
    assert len(data["topMarkets"]) == 5

    # Verify Q4 filter
    q4_res = client.get("/api/v1/analytics/dashboard?quarter=q4_2011")
    assert q4_res.status_code == 200
    q4_data = q4_res.json()
    assert len(q4_data["monthlyRevenueTrend"]) == 3

