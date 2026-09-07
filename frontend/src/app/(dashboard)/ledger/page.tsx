"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Trash2,
  Sparkles,
  Search,
  FileText,
  SlidersHorizontal,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  RefreshCw,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StreamTransaction } from "@/lib/types";
import { useFilterContext } from "@/context/FilterContext";
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

export default function LiveLedgerPage() {
  const { setReportOpen, fetchReport } = useFilterContext();
  const [transactions, setTransactions] = useState<StreamTransaction[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [selectedTx, setSelectedTx] = useState<StreamTransaction | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);

  // Initial load: fetch recent transactions from buffer
  useEffect(() => {
    async function loadRecent() {
      try {
        const res = await fetch("http://localhost:8000/api/transactions/recent");
        if (res.ok) {
          const data: StreamTransaction[] = await res.json();
          if (data && data.length > 0) {
            setTransactions(data.reverse());
            setSelectedTx(data[0]);
          }
        }
      } catch (err) {
        console.warn("Could not fetch initial transactions:", err);
      }
    }
    loadRecent();
  }, []);

  // Connect WebSocket for real-time live streaming
  useEffect(() => {
    if (!isStreaming) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnectionStatus("disconnected");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket("ws://localhost:8000/ws/transactions");
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.invoice_no) {
            setTransactions((prev) => {
              // Avoid duplicates if already present
              if (prev.some((t) => t.invoice_no === data.invoice_no && t.stock_code === data.stock_code)) {
                return prev;
              }
              const next = [data, ...prev.slice(0, 149)];
              return next;
            });
          }
        } catch (e) {
          // ignore non-json messages (e.g. ping/pong)
        }
      };

      ws.onerror = () => {
        setConnectionStatus("disconnected");
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
      };
    } catch (err) {
      setConnectionStatus("disconnected");
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isStreaming]);

  // Trigger simulated transaction burst
  const handleSimulateBurst = async () => {
    try {
      // Post 3 simulated transactions directly
      const sampleInvoices = ["SIM-901", "SIM-902", "SIM-903"];
      for (const inv of sampleInvoices) {
        const isAnom = inv === "SIM-901";
        await fetch("http://localhost:8000/api/transactions/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoice_no: inv,
            stock_code: isAnom ? "22423" : "85123A",
            description: isAnom ? "REGENCY CAKESTAND 3 TIER (HIGH BULK)" : "WHITE HANGING HEART T-LIGHT HOLDER",
            quantity: isAnom ? 1500 : 24,
            unit_price: isAnom ? 12.75 : 2.55,
            total_amount: isAnom ? 19125.0 : 61.2,
            customer_id: isAnom ? 14646 : 17850,
            country: "United Kingdom",
            invoice_date: new Date().toISOString().replace("T", " ").substring(0, 19),
            monetary_variance: isAnom ? 4.5 : 0.2,
            basket_size: isAnom ? 1500 : 24,
            days_since_last_order: isAnom ? 180 : 12,
          }),
        });
      }
    } catch (err) {
      console.warn("Could not post burst:", err);
    }
  };

  // Filtered transactions
  const filtered = transactions.filter((tx) => {
    if (filterRisk === "anomalies" && !tx.is_anomaly && tx.risk_level !== "HIGH") return false;
    if (filterRisk === "high" && tx.risk_level !== "HIGH") return false;
    if (filterRisk === "normal" && (tx.is_anomaly || tx.risk_level === "HIGH")) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tx.invoice_no.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        tx.country.toLowerCase().includes(q) ||
        (tx.customer_id && tx.customer_id.toString().includes(q))
      );
    }
    return true;
  });

  // Calculate anomaly distribution for Recharts
  const scoreBuckets = [
    { range: "<0.02 (Normal)", count: 0, color: "#10b981" },
    { range: "0.02-0.05 (Low)", count: 0, color: "#3b82f6" },
    { range: "0.05-0.08 (Elevated)", count: 0, color: "#f59e0b" },
    { range: "0.08+ (High Alert)", count: 0, color: "#ef4444" },
  ];

  transactions.forEach((t) => {
    const s = t.anomaly_score;
    if (s < 0.02) scoreBuckets[0].count += 1;
    else if (s < 0.05) scoreBuckets[1].count += 1;
    else if (s < 0.08) scoreBuckets[2].count += 1;
    else scoreBuckets[3].count += 1;
  });

  const highAnomaliesCount = transactions.filter((t) => t.risk_level === "HIGH" || t.is_anomaly).length;

  return (
    <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-rose-500" />
              Live Transaction Stream & Anomaly Forensics
            </h2>
            <Badge
              variant="outline"
              className={`text-xs gap-1.5 ${
                connectionStatus === "connected"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500 animate-ping"
                    : "bg-muted-foreground"
                }`}
              />
              <span>{connectionStatus === "connected" ? "WebSocket Active" : "Polling Mode"}</span>
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Streaming event ingestion with real-time Isolation Forest anomaly classification and spatial density evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReportOpen(true);
              fetchReport();
            }}
            className="text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <FileText className="h-3.5 w-3.5" />
            Executive Briefing
          </Button>

          <Button
            variant={isStreaming ? "secondary" : "default"}
            size="sm"
            onClick={() => setIsStreaming(!isStreaming)}
            className="text-xs h-8 gap-1.5"
          >
            {isStreaming ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause Feed
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Resume Feed
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulateBurst}
            className="text-xs h-8 gap-1.5"
            title="Inject simulated high-volume orders"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Inject Burst
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTransactions([])}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
            title="Clear buffer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Analytics KPI Row & Anomaly Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Mini-Cards */}
        <div className="space-y-4">
          <Card className="shadow-xs border bg-card/80">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Buffer Event Volume
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {transactions.length} Events
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Circular memory ledger (max 150 items)
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border bg-card/80">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Flagged Anomalies
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-rose-500">
                {highAnomaliesCount} Outliers
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Isolation Forest contamination: ~1.0%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recharts Score Distribution Histogram */}
        <Card className="shadow-xs border lg:col-span-2">
          <CardHeader className="pb-2 border-b bg-muted/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Anomaly Score Distribution (Current Buffer)
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Score Threshold &gt;0.08 = Anomaly
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreBuckets}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: number) => [`${val} Transactions`, "Frequency"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: "12px",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scoreBuckets.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Transaction Ledger Table with Inspector Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table Column (2 Cols) */}
        <Card className="shadow-xs border lg:col-span-2 overflow-hidden flex flex-col">
          <CardHeader className="px-4 py-3 border-b bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">
                Live Transaction Log
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                {filtered.length} showing
              </Badge>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter invoice/SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2 py-1 bg-background text-xs rounded border border-input h-7 w-36 sm:w-44 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center rounded border p-0.5 bg-muted/40 text-[11px]">
                {["all", "anomalies", "normal"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterRisk(f)}
                    className={`px-2 py-0.5 rounded capitalize transition-colors ${
                      filterRisk === f
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur text-[11px] text-muted-foreground border-b select-none z-10">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Product Description</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground font-sans text-xs">
                      No live transactions recorded matching active filter.
                    </td>
                  </tr>
                )}
                {filtered.map((tx, idx) => {
                  const isSelected = selectedTx?.invoice_no === tx.invoice_no;
                  const isHigh = tx.risk_level === "HIGH" || tx.is_anomaly;

                  return (
                    <tr
                      key={`${tx.invoice_no}-${tx.stock_code}-${idx}`}
                      onClick={() => setSelectedTx(tx)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 hover:bg-primary/15"
                          : isHigh
                          ? "bg-rose-500/5 hover:bg-rose-500/10"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="p-3 text-muted-foreground text-[11px]">
                        {tx.invoice_date.split(" ")[1] || tx.invoice_date}
                      </td>
                      <td className="p-3 font-semibold text-primary">{tx.invoice_no}</td>
                      <td className="p-3 font-sans truncate max-w-[180px]" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="p-3">{tx.quantity}</td>
                      <td className="p-3 font-semibold">£{tx.total_amount.toFixed(2)}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 font-semibold uppercase ${
                            isHigh
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : tx.risk_level === "MEDIUM"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          }`}
                        >
                          {isHigh ? "HIGH ANOMALY" : tx.risk_level || "NORMAL"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Anomaly Forensics Inspector Column (1 Col) */}
        <Card className="shadow-xs border flex flex-col">
          <CardHeader className="px-4 py-3 border-b bg-muted/10">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Transaction Forensics</span>
              {selectedTx && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    selectedTx.is_anomaly || selectedTx.risk_level === "HIGH"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  }`}
                >
                  Score: {selectedTx.anomaly_score.toFixed(4)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 space-y-4 text-xs">
            {!selectedTx && (
              <div className="text-center py-16 text-muted-foreground">
                Select any transaction from the live log to view feature attributions and anomaly explanations.
              </div>
            )}

            {selectedTx && (
              <>
                {/* Header Information */}
                <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-foreground">Invoice #{selectedTx.invoice_no}</span>
                    <span className="text-muted-foreground">{selectedTx.country}</span>
                  </div>
                  <div className="font-sans text-xs text-foreground font-medium">
                    {selectedTx.description}
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-[11px] pt-1 border-t">
                    <span>SKU: {selectedTx.stock_code}</span>
                    <span>Customer: #{selectedTx.customer_id || "Guest"}</span>
                  </div>
                </div>

                {/* Feature Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded border bg-card/60">
                    <span className="text-[10px] text-muted-foreground block">Basket Volume</span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      {selectedTx.basket_size} units
                    </span>
                  </div>
                  <div className="p-2.5 rounded border bg-card/60">
                    <span className="text-[10px] text-muted-foreground block">Total Value</span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      £{selectedTx.total_amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded border bg-card/60">
                    <span className="text-[10px] text-muted-foreground block">Monetary Variance</span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      {selectedTx.monetary_variance}σ
                    </span>
                  </div>
                  <div className="p-2.5 rounded border bg-card/60">
                    <span className="text-[10px] text-muted-foreground block">Dormancy Gap</span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      {selectedTx.days_since_last_order} days
                    </span>
                  </div>
                </div>

                {/* Forensic Rationale */}
                <div className="space-y-2">
                  <span className="font-semibold text-foreground text-xs block">
                    Isolation Forest Causal Drivers:
                  </span>
                  {selectedTx.reasons && selectedTx.reasons.length > 0 ? (
                    <ul className="space-y-1.5">
                      {selectedTx.reasons.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 p-2 rounded bg-rose-500/5 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px]"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-1.5 p-2 rounded bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Transaction conforms to expected baseline density. No anomaly indicators detected.</span>
                    </div>
                  )}
                </div>

                {/* Action recommendations */}
                <div className="pt-2 border-t space-y-2">
                  <span className="font-semibold text-foreground text-xs block">
                    Automated Routing Action:
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedTx.is_anomaly || selectedTx.risk_level === "HIGH"
                      ? "Order flagged for secondary fraud & inventory verification before dispatch."
                      : "Direct route to automated warehouse picking queue."}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

