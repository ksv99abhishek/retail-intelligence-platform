"""Pydantic schemas for the Retail Intelligence API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "0.1.0"
    models_loaded: bool = False
    details: str | None = None


class CustomerCLVRequest(BaseModel):
    """Request payload for customer-level CLV prediction."""
    customer_id: int | None = Field(None, description="Known Customer ID in historical database")
    frequency: float | None = Field(None, ge=0, description="Repeat purchase frequency (count of repeat periods)")
    recency: float | None = Field(None, ge=0, description="Recency in days (first to last purchase)")
    T: float | None = Field(None, ge=0, description="Customer age in days (first purchase to observation cutoff)")
    monetary_value: float | None = Field(None, ge=0, description="Average spend per repeat purchase period")
    time_horizon_days: int = Field(90, ge=1, le=730, description="Prediction horizon in days")


class CustomerCLVResponse(BaseModel):
    """Prediction output for customer CLV."""
    customer_id: int | None = None
    prob_alive: float = Field(..., description="Estimated probability customer is still active")
    expected_purchases: float = Field(..., description="Predicted number of purchases in time horizon")
    expected_avg_spend: float = Field(..., description="Predicted average spend per future purchase")
    predicted_clv: float = Field(..., description="Discounted Customer Lifetime Value prediction")
    segment_name: str | None = Field(None, description="RFM Customer Segment (e.g. Champions, At Risk)")


class CrossSellRequest(BaseModel):
    """Request payload for market basket cross-sell recommendations."""
    basket: list[str] = Field(..., min_length=1, description="List of StockCodes currently in the cart")
    top_k: int = Field(5, ge=1, le=20, description="Maximum number of recommendations to return")


class RecommendedItem(BaseModel):
    """Single item recommendation with association metric."""
    stock_code: str
    description: str | None = None
    confidence: float
    lift: float


class CrossSellResponse(BaseModel):
    """Recommendation response payload."""
    basket: list[str]
    recommendations: list[RecommendedItem]


class KpiMetric(BaseModel):
    """KPI card metric representation."""
    id: str
    label: str
    value: float | int | str
    displayValue: str
    change: float
    changeType: str
    changeLabel: str
    icon: str
    tooltip: str


class MonthlyRevenueItem(BaseModel):
    """Monthly revenue time series point."""
    month: str
    revenue: float
    displayRevenue: str
    growth: float


class HourlyOrderItem(BaseModel):
    """Hourly order frequency point."""
    time: str
    hour: int
    orders: int
    isPeak: bool = False


class TopProductItem(BaseModel):
    """Product sales ranking item."""
    rank: int
    stockCode: str
    name: str
    revenue: float
    displayRevenue: str
    quantitySold: int
    unitPrice: float
    category: str


class TopMarketItem(BaseModel):
    """Geographic market revenue and share."""
    country: str
    code: str
    revenue: float
    displayRevenue: str
    share: float


class DashboardSummary(BaseModel):
    """Metadata summary of the current analytics query."""
    title: str
    dataset: str
    period: str
    updatedAt: str
    totalRecords: int
    filteredQuarter: str
    filteredCountry: str


class DashboardAnalyticsResponse(BaseModel):
    """Full dashboard payload matching frontend requirements."""
    summary: DashboardSummary
    kpis: list[KpiMetric]
    monthlyRevenueTrend: list[MonthlyRevenueItem]
    hourlyOrders: list[HourlyOrderItem]
    topProducts: list[TopProductItem]
    topMarkets: list[TopMarketItem]


class CustomerCLVExplorerResponse(BaseModel):
    """Detailed Customer 360 CLV Explorer metrics."""
    customer_id: int
    predicted_12m_spend: float = Field(..., description="Projected spend over the next 12 months in GBP")
    expected_purchases: float = Field(..., description="Projected purchase count in 12 months")
    frequency: int = Field(..., description="Historical completed order count")
    recency: int = Field(..., description="Days since last completed transaction")
    monetary: float = Field(..., description="Historical total spend in GBP")
    avg_order_value: float = Field(..., description="Average spend per historical order in GBP")
    customer_tier: str = Field(..., description="Tier badge (Champion, Loyal, Needs Attention)")
    segment_name: str = Field(..., description="RFM Segment Name from clustering")
    prob_alive: float = Field(..., description="Probability customer is active")


class ProductRecommendationItem(BaseModel):
    """Cross-sell product recommendation item."""
    recommended_item: str = Field(..., description="Recommended product title / description")
    lift: float = Field(..., description="Association rule lift score")
    confidence: float = Field(..., description="Association rule confidence score")
    affinity: str = Field("Frequently Purchased Together", description="Affinity description tag")


class ProductRecommendationsResponse(BaseModel):
    """Response payload for product recommendations."""
    product_name: str
    recommendations: list[ProductRecommendationItem]


class AgentChartDataPoint(BaseModel):
    """Chart data point returned by the natural language analytics agent."""
    label: str
    value: float


class AgentQueryRequest(BaseModel):
    """Request payload for natural language analytics queries."""
    query: str = Field(..., min_length=2, description="Natural language analytical question")


class AgentQueryResponse(BaseModel):
    """Response payload from the agentic analytical tool pipeline."""
    query: str
    answer: str
    suggested_metric: str
    chart_data: list[AgentChartDataPoint] | None = None


class AnomalyPredictionRequest(BaseModel):
    """Request payload for evaluating an individual transaction for anomalies."""
    invoice_no: str | int | None = Field(None, description="Invoice number")
    monetary_variance: float = Field(..., description="Monetary variance relative to baseline")
    basket_size: float = Field(..., description="Total unit count in invoice basket")
    days_since_last_order: float = Field(..., description="Days since customer's previous transaction")


class AnomalyPredictionResponse(BaseModel):
    """Prediction outcome from the unsupervised IsolationForest model."""
    invoice_no: str | None = None
    is_anomaly: bool = Field(..., description="True if flagged as anomalous (predict == -1)")
    anomaly_score: float = Field(..., description="Continuous anomaly score (higher indicates abnormal)")
    risk_level: str = Field(..., description="Risk tier: HIGH, MEDIUM, or LOW")
    confidence: float = Field(..., description="Heuristic confidence metric")
    reasons: list[str] = Field(default_factory=list, description="Contributing drivers for anomaly flag")


class StreamTransaction(BaseModel):
    """Single transactional event emitted to live ledger / streaming subscribers."""
    invoice_no: str
    stock_code: str
    description: str
    quantity: int
    unit_price: float
    total_amount: float
    customer_id: int | None = None
    country: str
    invoice_date: str
    monetary_variance: float = 0.0
    basket_size: int = 0
    days_since_last_order: float = 0.0
    is_anomaly: bool = False
    anomaly_score: float = 0.0
    risk_level: str = "LOW"
    reasons: list[str] = Field(default_factory=list)


class ExecutiveReportResponse(BaseModel):
    """Automated executive intelligence report summarizing platform activity."""
    report_id: str
    report_date: str
    generated_at: str
    generated_by: str
    total_transactions: int
    total_volume_gbp: float
    cancellation_rate: float
    anomalies_detected: int
    top_anomalous_invoices: list[dict[str, Any]] = Field(default_factory=list)
    key_insights: list[str] = Field(default_factory=list)
    markdown_content: str


class CancellationRiskFactor(BaseModel):
    """SHAP feature attribution factor contributing to cancellation risk."""
    feature: str
    value: str | float
    shap_value: float
    description: str


class CancellationRiskResponse(BaseModel):
    """Cancellation risk assessment with SHAP feature attributions."""
    invoice_no: str
    base_probability: float
    predicted_risk: float
    risk_tier: str
    factors: list[CancellationRiskFactor]



