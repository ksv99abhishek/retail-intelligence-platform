"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCheck,
  Search,
  PoundSterling,
  ShoppingBag,
  Clock,
  Award,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { CustomerCLVExplorerData } from "@/lib/types";

const SAMPLE_CUSTOMERS = [
  { id: 17850, label: "17850 (Champion)" },
  { id: 13047, label: "13047 (Loyal)" },
  { id: 12583, label: "12583 (High Value)" },
];

export function CustomerIntelligenceCard() {
  const [customerIdInput, setCustomerIdInput] = useState<string>("17850");
  const [activeCustomerId, setActiveCustomerId] = useState<number>(17850);
  const [customerData, setCustomerData] = useState<CustomerCLVExplorerData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerCLV = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/predict/clv/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Customer ID #${id} not found in historical records.`);
        }
        throw new Error(`Server returned error ${res.status}`);
      }
      const data: CustomerCLVExplorerData = await res.json();
      setCustomerData(data);
      setActiveCustomerId(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retrieve customer data";
      setError(msg);
      setCustomerData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch customer on mount (or from ?cust= URL parameter)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const custParam = params.get("cust");
      if (custParam) {
        const p = parseInt(custParam, 10);
        if (!isNaN(p)) {
          setCustomerIdInput(custParam);
          fetchCustomerCLV(p);
          return;
        }
      }
    }
    fetchCustomerCLV(17850);
  }, [fetchCustomerCLV]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = parseInt(customerIdInput.trim(), 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      setError("Please enter a valid numeric Customer ID.");
      return;
    }
    fetchCustomerCLV(parsedId);
  };

  const handleSelectSample = (id: number) => {
    setCustomerIdInput(id.toString());
    fetchCustomerCLV(id);
  };

  // Tier badge styling helper
  const getTierBadgeStyle = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "champion":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "loyal":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      default:
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
  };

  return (
    <Card className="shadow-sm border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold">
                Customer 360 & Lifetime Value (CLV) Explorer
              </CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                BTYD & Gamma-Gamma
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Real-time probabilistic customer forecasting, RFM segmentation, and forward 12-month value projection.
            </CardDescription>
          </div>

          {/* Customer Search Bar & Quick Select */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={customerIdInput}
                onChange={(e) => setCustomerIdInput(e.target.value)}
                placeholder="Enter Customer ID..."
                className="h-9 w-40 sm:w-48 rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 text-xs px-3 gap-1" disabled={loading}>
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>Lookup</span>
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Quick Sample Selector Pills */}
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-[11px]">Sample Accounts:</span>
          {SAMPLE_CUSTOMERS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSelectSample(sample.id)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                activeCustomerId === sample.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted text-foreground border-border"
              }`}
            >
              #{sample.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert State */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Customer Not Found: </span>
              {error} Please try sample customer 17850, 13047, or 12583.
            </div>
          </div>
        )}

        {/* Customer Stat Cards Grid */}
        {customerData && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1: Predicted 12-Month Spend */}
            <div className="rounded-xl border border-border bg-card/60 p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Predicted 12-Month Spend
                </span>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <PoundSterling className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  £{customerData.predicted_12m_spend.toLocaleString("en-GB", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>Gamma-Gamma DCF Projection</span>
              </div>
            </div>

            {/* Stat 2: Expected Future Purchases */}
            <div className="rounded-xl border border-border bg-card/60 p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Expected Future Purchases
                </span>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {customerData.expected_purchases.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">orders / 12 mo</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Prob. Active: {(customerData.prob_alive * 100).toFixed(1)}%
              </div>
            </div>

            {/* Stat 3: Historical Frequency & Recency */}
            <div className="rounded-xl border border-border bg-card/60 p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Historical RFM Profile
                </span>
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-purple-500" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {customerData.frequency}
                </span>
                <span className="text-xs text-muted-foreground">orders completed</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Last order: {customerData.recency}d ago</span>
                <span>AOV: £{customerData.avg_order_value.toFixed(0)}</span>
              </div>
            </div>

            {/* Stat 4: Customer Tier & Segment */}
            <div className="rounded-xl border border-border bg-card/60 p-4 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Value Tier & Cluster
                </span>
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Award className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getTierBadgeStyle(
                    customerData.customer_tier
                  )}`}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {customerData.customer_tier} Tier
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Cluster: <span className="font-medium text-foreground">{customerData.segment_name}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
