# Retail Intelligence Platform

An end-to-end Machine Learning and Microservice Platform for Customer Lifetime Value (CLV), RFM Segmentation, and Market Basket Cross-Sell Recommendations.

---

## Architecture Overview

```
retail-intelligence-platform/
├── data/
│   ├── raw/                 # Put 'Online Retail.xlsx' here
│   └── processed/           # Processed datasets
├── artifacts/               # Serialized models and customer profiles
├── src/
│   ├── data/
│   │   └── preprocess.py    # Cleaning, cancellation filtering, RFM & BTYD summaries
│   ├── models/
│   │   ├── train_clv.py     # BTYD (BG/NBD, Gamma-Gamma) & Scikit-Learn KMeans
│   │   └── train_mba.py     # Market Basket Analysis (FP-Growth via mlxtend)
│   └── api/
│       ├── main.py          # FastAPI application
│       └── schemas.py       # Pydantic schemas
├── tests/
│   └── test_clv.py          # Unit tests
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Quickstart Guide

### 1. Environment Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Dataset Placement
Place `Online Retail.xlsx` into `data/raw/`:
```bash
cp "/path/to/Online Retail.xlsx" data/raw/
```

### 3. Train CLV & RFM Segmentation
Run the training pipeline:
```bash
python3 -m src.models.train_clv \
  --data-path "data/raw/Online Retail.xlsx" \
  --output-dir "artifacts" \
  --time-horizon-days 90 \
  --n-clusters 4 \
  --penalizer 0.01
```

This generates:
- `artifacts/bgf_model.pkl`: Fitted BetaGeoFitter model.
- `artifacts/ggf_model.pkl`: Fitted GammaGammaFitter model.
- `artifacts/kmeans_rfm.pkl`: Scaler, KMeans cluster model, and segment mappings.
- `artifacts/customer_clv_segments.csv`: Customer-level table with Recency, Frequency, Monetary, Cluster, Segment Name, Probability Alive, Expected Purchases, and predicted CLV.
- `artifacts/training_summary.json`: High-level segment distribution and metrics.

### 4. Run the FastAPI Microservice
Locally:
```bash
uvicorn src.api.main:app --reload --port 8000
```
Interactive Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 5. Run with Docker Compose
```bash
docker-compose up --build
```

---

## API Endpoints

- `GET /health`: Health check and model availability.
- `POST /api/v1/clv/predict`: Predict CLV, purchase frequency, and active probability for a given customer or transaction metrics.
- `POST /api/v1/recommendations/cross-sell`: Top complementary product recommendations given current basket items.

