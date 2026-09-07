"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  Sparkles,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Calendar,
  HeartHandshake,
  CheckCircle2,
  Award,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerCLVExplorerData } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function Customer360Page() {
  const [searchId, setSearchId] = useState<string>("17850");
  const [customerData, setCustomerData] = useState<CustomerCLVExplorerData | null>({
    customer_id: 17850,
    predicted_12m_spend: 3840.50,
    expected_purchases: 18.2,
    frequency: 34,
    recency: 371,
    monetary: 5391.21,
    avg_order_value: 158.56,
    customer_tier: "Champion",
    segment_name: "Champions",
    prob_alive: 0.9842,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sampleCustomers = [
    { id: "17850", name: "High-Frequency Champion", tier: "Champion", spend: "£5.39k" },
    { id: "13047", name: "Loyal Domestic Regular", tier: "Loyal", spend: "£3.66k" },
    { id: "12583", name: "European High-Value Export", tier: "Champion", spend: "£7.28k" },
    { id: "14646", name: "Top Wholesale Partner", tier: "Champion", spend: "£280.2k" },
    { id: "14911", name: "Active Multi-Order Veteran", tier: "Champion", spend: "£143.8k" },
  ];

  const fetchCustomerCLV = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/predict/clv/${id.trim()}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Customer ID #${id} not found in historical records.`);
        }
        throw new Error(`Server returned error status ${res.status}`);
      }
      const data: CustomerCLVExplorerData = await res.json();
      setCustomerData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load customer profile";
      setError(msg);
      setCustomerData(null);
    } finally {
      setLoading(false);
    }
  };

  const segmentDistribution = [
    { name: "Champions", count: 850, avgClv: "£4,250", color: "#10b981" },
    { name: "Loyal Customers", count: 1240, avgClv: "£1,890", color: "#3b82f6" },
    { name: "Promising", count: 720, avgClv: "£940", color: "#8b5cf6" },
    { name: "Needs Attention", count: 910, avgClv: "£420", color: "#f59e0b" },
    { name: "At Risk / Churn", count: 618, avgClv: "£180", color: "#ef4444" },
  ];

  return (
    <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-emerald-500" />
              Customer 360 & Lifetimes CLV Explorer
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Probabilistic BG/NBD and Gamma-Gamma models predicting churn probability and 12-month expected customer spend.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-card/60">
            <Sparkles className="mr-1.5 h-3 w-3 text-purple-500" />
            BG/NBD + Gamma-Gamma
          </Badge>
          <Badge variant="outline" className="text-xs bg-card/60">
            4,338 Profiles Analyzed
          </Badge>
        </div>
      </div>

      {/* Customer Lookup & Quick Pick Bar */}
      <Card className="shadow-xs border bg-card/80">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Customer ID (e.g. 17850, 14646, 12583)..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchCustomerCLV(searchId)}
                className="w-full pl-9 pr-4 py-2 bg-background rounded-md border border-input text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button
              onClick={() => fetchCustomerCLV(searchId)}
              disabled={loading}
              className="w-full sm:w-auto text-xs px-5 h-9"
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Analyze Profile
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground mr-1">Quick Select Profiles:</span>
            {sampleCustomers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSearchId(c.id);
                  fetchCustomerCLV(c.id);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                  customerData?.customer_id.toString() === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-mono font-medium">#{c.id}</span>
                <span className="opacity-75">({c.name})</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Customer 360 Profile Dossier */}
      {customerData && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Profile Summary Card */}
          <Card className="shadow-xs border overflow-hidden">
            <div className="bg-muted/20 px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold font-mono">
                  #{customerData.customer_id.toString().slice(-2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      Customer Profile #{customerData.customer_id}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        customerData.customer_tier === "Champion"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : customerData.customer_tier === "Loyal"
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      }`}
                    >
                      <Award className="h-3 w-3 mr-1" />
                      {customerData.customer_tier}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Segment: <span className="font-semibold text-foreground">{customerData.segment_name}</span> • Retention probability: {(customerData.prob_alive * 100).toFixed(1)}% active
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-card/60">
                  P(Alive): {(customerData.prob_alive * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>

            <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/20 border space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  12-Mo Projected Spend
                </span>
                <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  £{customerData.predicted_12m_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-muted-foreground">Discounted CLV Projection</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/20 border space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-blue-500" />
                  Expected Purchases
                </span>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {customerData.expected_purchases} orders
                </div>
                <p className="text-[10px] text-muted-foreground">Next 365-day cadence</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/20 border space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-purple-500" />
                  Historical Total Spend
                </span>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  £{customerData.monetary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-muted-foreground">Across {customerData.frequency} completed orders</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/20 border space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  Customer Recency
                </span>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {customerData.recency} days
                </div>
                <p className="text-[10px] text-muted-foreground">Average order value: £{customerData.avg_order_value}</p>
              </div>
            </CardContent>
          </Card>

          {/* Segment Distribution & RFM Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-xs border">
              <CardHeader className="pb-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-semibold">
                  Customer Cohort Distribution
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Proportion of customer base across RFM behavioral clusters.
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={segmentDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip
                        formatter={(val: number) => [`${val.toLocaleString()} Customers`, "Cohort Size"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          fontSize: "12px",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {segmentDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border">
              <CardHeader className="pb-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-semibold">
                  Prescriptive Engagement Playbook
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Recommended retention and upsell levers tailored to this tier.
                </p>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 text-xs">
                <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 space-y-1">
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Priority VIP Concierge & Early Product Access
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Customer is in top 5% of spenders. Automatically assign priority fulfillment and early holiday catalog previews.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-blue-500/5 border-blue-500/20 space-y-1">
                  <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <HeartHandshake className="h-4 w-4" />
                    Automated Replenishment Reminders
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Expected purchase cycle is approximately every 20 days. Send personalized restocking emails before expected order date.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-purple-500/5 border-purple-500/20 space-y-1">
                  <div className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Award className="h-4 w-4" />
                    High-Margin Cross-Sell Pairing
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Customer exhibits strong basket affinity with home decor. Bundle recommendations with &gt;2.5 lift scores.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}

