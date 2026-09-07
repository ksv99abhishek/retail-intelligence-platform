"use client";

import React, { useState } from "react";
import { ExecutiveReportData } from "@/lib/types";
import {
  X,
  FileText,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ExecutiveReportDrawerProps {
  open: boolean;
  onClose: () => void;
  report: ExecutiveReportData | null;
  loading: boolean;
  onRefresh: () => void;
}

export function ExecutiveReportDrawer({
  open,
  onClose,
  report,
  loading,
  onRefresh,
}: ExecutiveReportDrawerProps) {
  const [regenerating, setRegenerating] = useState(false);

  if (!open) return null;

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await fetch("http://localhost:8000/api/reports/generate", { method: "POST" });
      onRefresh();
    } catch (err) {
      console.warn("Failed to trigger report generation:", err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report.markdown_content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Executive_Report_${report.report_date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label="Close backdrop"
      />

      <div className="relative w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  Executive Intelligence Briefing
                </h3>
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  {report?.generated_by || "AI Generated"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {report ? `Report ${report.report_id} • ${report.report_date}` : "Loading latest report..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!report}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Markdown
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || loading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Assembling Executive Report...</p>
              <p className="text-xs text-muted-foreground mt-1">Aggregating transactional volumes & anomaly forensics</p>
            </div>
          )}

          {!loading && !report && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No report currently cached. Click &ldquo;Regenerate&rdquo; to compile report.
            </div>
          )}

          {!loading && report && (
            <>
              {/* Metric Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-card/60">
                  <span className="text-[11px] text-muted-foreground block font-medium">Total Volume</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block">
                    £{report.total_volume_gbp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5 mt-0.5">
                    <TrendingUp className="h-2.5 w-2.5" /> 13-month
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-card/60">
                  <span className="text-[11px] text-muted-foreground block font-medium">Ledger Items</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block">
                    {report.total_transactions.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Transactions</span>
                </div>
                <div className="p-3 rounded-lg border bg-card/60">
                  <span className="text-[11px] text-muted-foreground block font-medium">Cancellation Rate</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block">
                    {report.cancellation_rate}%
                  </span>
                  <span className="text-[10px] text-amber-500">Historical norm</span>
                </div>
                <div className="p-3 rounded-lg border bg-card/60">
                  <span className="text-[11px] text-muted-foreground block font-medium">Anomalies</span>
                  <span className="text-base font-bold text-rose-500 mt-0.5 block">
                    {report.anomalies_detected}
                  </span>
                  <span className="text-[10px] text-rose-500/80 font-medium">Isolation Forest</span>
                </div>
              </div>

              {/* Key Insights Highlights */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Key Strategic Insights
                </div>
                <ul className="space-y-1.5 text-xs text-foreground/90">
                  {report.key_insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Top Flagged Anomalous Invoices */}
              {report.top_anomalous_invoices.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    Top Anomalous Transactions Under Review
                  </div>
                  <div className="rounded-lg border overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-muted/50 text-[11px] text-muted-foreground border-b">
                        <tr>
                          <th className="p-2.5">Invoice</th>
                          <th className="p-2.5">Customer</th>
                          <th className="p-2.5">Spend</th>
                          <th className="p-2.5">Units</th>
                          <th className="p-2.5">Anomaly Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.top_anomalous_invoices.map((anom) => (
                          <tr key={anom.invoice_no} className="hover:bg-muted/30">
                            <td className="p-2.5 font-mono font-medium text-primary">{anom.invoice_no}</td>
                            <td className="p-2.5 text-muted-foreground">{anom.customer_id ? `#${anom.customer_id}` : "Guest"} ({anom.country})</td>
                            <td className="p-2.5 font-semibold">£{anom.total_spend.toLocaleString()}</td>
                            <td className="p-2.5">{anom.total_units.toLocaleString()}</td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="font-mono text-[10px] bg-rose-500/10 text-rose-500 border-rose-500/20">
                                {anom.anomaly_score.toFixed(4)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full Formatted Markdown Content */}
              <div className="space-y-3 border-t pt-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Complete Briefing Document
                </div>
                <div className="rounded-lg bg-muted/30 p-4 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed border overflow-x-auto">
                  {report.markdown_content}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

