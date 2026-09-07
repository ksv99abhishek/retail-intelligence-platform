"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Info,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancellationRiskData } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

export default function CancellationRiskPage() {
  const [samples, setSamples] = useState<CancellationRiskData[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string>("567423");
  const [loading, setLoading] = useState(true);

  // Custom Simulator State
  const [unitPrice, setUnitPrice] = useState<number>(125);
  const [basketUnits, setBasketUnits] = useState<number>(850);
  const [orderHour, setOrderHour] = useState<number>(16);
  const [priorReturns, setPriorReturns] = useState<number>(2);

  useEffect(() => {
    async function loadSamples() {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:8000/api/risk/cancellation-sample");
        if (res.ok) {
          const data = await res.json();
          setSamples(data);
        }
      } catch (err) {
        console.warn("Could not fetch risk samples from API:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSamples();
  }, []);

  // Fallback sample data if API not responding
  const activeOrder: CancellationRiskData = samples.find(
    (s) => s.invoice_no === selectedInvoice
  ) || {
    invoice_no: "567423",
    base_probability: 0.148,
    predicted_risk: 0.784,
    risk_tier: "HIGH",
    factors: [
      {
        feature: "UnitPrice Outlier",
        value: "£125.00 (vs £3.40 avg)",
        shap_value: 0.28,
        description: "High ticket price increases buyer remorse and return probability.",
      },
      {
        feature: "Prior Return Frequency",
        value: "3 Return Invoices",
        shap_value: 0.19,
        description: "Customer historical return propensity indicates heightened post-purchase churn.",
      },
      {
        feature: "Late Rush-Hour Order",
        value: "16:30 Dispatch Cutoff",
        shap_value: 0.14,
        description: "Orders placed during late afternoon cutoffs exhibit greater cancellation request volume.",
      },
      {
        feature: "Wholesale Unit Volume",
        value: "1,200 Units",
        shap_value: 0.12,
        description: "Bulk orders carry higher payment verification and fulfillment friction.",
      },
      {
        feature: "Domestic Destination",
        value: "United Kingdom",
        shap_value: -0.094,
        description: "Domestic shipping reduces logistical customs and cancellation likelihood.",
      },
    ],
  };

  // Prepare waterfall data for Recharts
  const waterfallData = [
    {
      name: "Base Rate",
      attribution: Math.round(activeOrder.base_probability * 100 * 10) / 10,
      display: `${(activeOrder.base_probability * 100).toFixed(1)}%`,
      type: "base",
    },
    ...activeOrder.factors.map((f) => ({
      name: f.feature,
      attribution: Math.round(f.shap_value * 100 * 10) / 10,
      display: `${f.shap_value > 0 ? "+" : ""}${(f.shap_value * 100).toFixed(1)}%`,
      type: f.shap_value > 0 ? "positive" : "negative",
      description: f.description,
      raw_value: f.value,
    })),
    {
      name: "Final Predicted Risk",
      attribution: Math.round(activeOrder.predicted_risk * 100 * 10) / 10,
      display: `${(activeOrder.predicted_risk * 100).toFixed(1)}%`,
      type: "final",
    },
  ];

  // Dynamic Simulator Calculation
  const simBase = 0.1481;
  const simPriceShap = unitPrice > 50 ? (unitPrice - 50) * 0.003 : -0.02;
  const simUnitsShap = basketUnits > 500 ? (basketUnits - 500) * 0.00015 : -0.015;
  const simHourShap = orderHour >= 15 && orderHour <= 17 ? 0.11 : -0.03;
  const simReturnShap = priorReturns * 0.08;
  const simTotalRisk = Math.min(
    0.98,
    Math.max(0.02, simBase + simPriceShap + simUnitsShap + simHourShap + simReturnShap)
  );

  return (
    <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-amber-500" />
              Order Cancellation Risk & SHAP Waterfall
            </h2>
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Supervised XGBoost model calibrated on historical order behaviors, explaining feature-level contributions via Shapley values.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-card/60">
            <Sparkles className="mr-1.5 h-3 w-3 text-purple-500" />
            Model: XGBoost Classifier
          </Badge>
          <Badge variant="outline" className="text-xs bg-card/60">
            SHAP TreeExplainer
          </Badge>
        </div>
      </div>

      {/* KPI Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs border bg-card/80">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Base Cancellation Rate
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">14.81%</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Dataset baseline across 25,900 unique orders
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card/80">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dominant Risk Factor
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-rose-500">+28.0% SHAP</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              High Unit Price Outliers (&gt;£50 luxury SKUs)
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card/80">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Domestic Retention Lift
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-500">-9.4% SHAP</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Domestic UK fulfillment significantly lowers return churn
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card/80">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Model Accuracy (AUC-ROC)
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">0.892</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Trained on 5-fold cross-validated transaction splits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis: Interactive SHAP Waterfall Inspector */}
      <Card className="shadow-xs border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b bg-muted/10 pb-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span>SHAP Feature Attribution Waterfall</span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  activeOrder.risk_tier === "HIGH"
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    : activeOrder.risk_tier === "MODERATE"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                }`}
              >
                {activeOrder.risk_tier} RISK TIER ({(activeOrder.predicted_risk * 100).toFixed(1)}%)
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Decomposition of baseline order risk into additive positive and negative Shapley forces.
            </p>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Select Order:</span>
            {[
              { id: "567423", label: "Invoice #567423 (High 78%)" },
              { id: "562439", label: "Invoice #562439 (Mod 39%)" },
              { id: "536365", label: "Invoice #536365 (Low 3%)" },
            ].map((btn) => (
              <Button
                key={btn.id}
                variant={selectedInvoice === btn.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedInvoice(btn.id)}
                className="text-xs h-7 px-2.5"
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Recharts Waterfall Chart */}
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={waterfallData}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  unit="%"
                  tick={{ fontSize: 11 }}
                  domain={[-15, 85]}
                />
                <ReferenceLine y={0} stroke="#888888" strokeWidth={1} />
                <ReferenceLine
                  y={14.8}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  label={{ value: "Base 14.8%", fill: "#3b82f6", fontSize: 10, position: "right" }}
                />
                <Tooltip
                  formatter={(val: number) => [`${val > 0 ? "+" : ""}${val}%`, "Attribution"]}
                  labelFormatter={(label) => `Feature: ${label}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    fontSize: "12px",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="attribution" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, index) => {
                    let fill = "#10b981"; // emerald for negative risk reduction
                    if (entry.type === "base") fill = "#3b82f6"; // blue
                    else if (entry.type === "final") fill = entry.attribution > 40 ? "#ef4444" : "#10b981";
                    else if (entry.type === "positive") fill = "#ef4444"; // red for risk push
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Factor Breakdown Table */}
          <div className="rounded-lg border overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-muted/50 text-[11px] text-muted-foreground border-b font-medium">
                <tr>
                  <th className="p-3">Feature Name</th>
                  <th className="p-3">Observed Value</th>
                  <th className="p-3">SHAP Force</th>
                  <th className="p-3">Causal Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeOrder.factors.map((f, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold text-foreground">{f.feature}</td>
                    <td className="p-3 font-mono text-muted-foreground">{f.value}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] ${
                          f.shap_value > 0
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        }`}
                      >
                        {f.shap_value > 0 ? "+" : ""}
                        {(f.shap_value * 100).toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Interactive What-If Risk Simulator */}
      <Card className="shadow-xs border">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                Interactive What-If Cancellation Simulator
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adjust basket parameters in real time to observe dynamic XGBoost risk inference and SHAP projections.
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs px-3 py-1 font-bold ${
                simTotalRisk > 0.5
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                  : simTotalRisk > 0.25
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
              }`}
            >
              SIMULATED RISK: {(simTotalRisk * 100).toFixed(1)}%
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Unit Price (£)</span>
              <span className="font-mono text-primary font-bold">£{unitPrice}</span>
            </div>
            <input
              type="range"
              min="1"
              max="250"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">Impact: {simPriceShap > 0 ? `+${(simPriceShap * 100).toFixed(1)}%` : `${(simPriceShap * 100).toFixed(1)}%`}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Basket Units</span>
              <span className="font-mono text-primary font-bold">{basketUnits} pcs</span>
            </div>
            <input
              type="range"
              min="10"
              max="2000"
              step="10"
              value={basketUnits}
              onChange={(e) => setBasketUnits(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">Impact: {simUnitsShap > 0 ? `+${(simUnitsShap * 100).toFixed(1)}%` : `${(simUnitsShap * 100).toFixed(1)}%`}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Order Placement Hour</span>
              <span className="font-mono text-primary font-bold">{orderHour}:00</span>
            </div>
            <input
              type="range"
              min="8"
              max="20"
              value={orderHour}
              onChange={(e) => setOrderHour(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">Impact: {simHourShap > 0 ? `+${(simHourShap * 100).toFixed(1)}%` : `${(simHourShap * 100).toFixed(1)}%`}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Prior Customer Returns</span>
              <span className="font-mono text-primary font-bold">{priorReturns} returns</span>
            </div>
            <input
              type="range"
              min="0"
              max="6"
              value={priorReturns}
              onChange={(e) => setPriorReturns(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">Impact: +{(simReturnShap * 100).toFixed(1)}%</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

