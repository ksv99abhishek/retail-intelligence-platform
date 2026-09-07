"""Tests for Agentic Natural Language Query, Customer CLV Explorer, and Product Recommender."""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture(scope="module")
def client():
    """Create test client with lifespan initialization for models and datasets."""
    with TestClient(app) as test_client:
        yield test_client


def test_customer_clv_explorer_found(client):
    """Test retrieving known customer CLV profile."""
    resp = client.get("/predict/clv/17850")
    assert resp.status_code == 200
    data = resp.json()
    assert data["customer_id"] == 17850
    assert data["predicted_12m_spend"] > 0
    assert data["expected_purchases"] >= 0
    assert data["customer_tier"] in ["Champion", "Loyal", "Needs Attention"]
    assert "segment_name" in data
    assert "frequency" in data
    assert "recency" in data


def test_customer_clv_explorer_not_found(client):
    """Test error handling when customer ID is not in historical dataset."""
    resp = client.get("/predict/clv/999999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_product_recommendations_known_item(client):
    """Test retrieving cross-sell recommendations for a known SKU."""
    resp = client.get("/recommend/REGENCY CAKESTAND 3 TIER")
    assert resp.status_code == 200
    data = resp.json()
    assert data["product_name"] == "REGENCY CAKESTAND 3 TIER"
    assert len(data["recommendations"]) > 0
    first_rec = data["recommendations"][0]
    assert "recommended_item" in first_rec
    assert first_rec["lift"] > 0
    assert first_rec["affinity"] == "Frequently Purchased Together"


def test_product_recommendations_fallback(client):
    """Test retrieving fallback recommendations for a novel or unlisted item."""
    resp = client.get("/recommend/NONEXISTENT_ITEM_ABC_XYZ")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["recommendations"]) > 0


def test_agent_query_highest_aov(client):
    """Test agent query answering highest Average Order Value by country."""
    resp = client.post(
        "/api/agent/query",
        json={"query": "Which country had the highest average order value?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "suggested_metric" in data
    assert "chart_data" in data
    assert len(data["chart_data"]) > 0
    assert any("netherlands" in data["answer"].lower() or "australia" in data["answer"].lower() for _ in [1])


def test_agent_query_monthly_cancellations(client):
    """Test agent query answering monthly cancellations trend."""
    resp = client.post(
        "/api/agent/query",
        json={"query": "Show monthly cancellations"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "chart_data" in data
    assert len(data["chart_data"]) >= 12  # 12 or 13 months


def test_agent_query_customer_lookup(client):
    """Test agent query looking up a customer by ID in prompt."""
    resp = client.post(
        "/api/agent/query",
        json={"query": "What is the CLV for customer 17850?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "17850" in data["answer"]

