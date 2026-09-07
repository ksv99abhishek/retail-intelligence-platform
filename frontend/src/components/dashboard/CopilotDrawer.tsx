"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  Sparkles,
  X,
  Bot,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentQueryResponse } from "@/lib/types";

interface CopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  query: string;
  result: AgentQueryResponse | null;
  loading: boolean;
  error: string | null;
}

const BAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#6366f1",
];

export function CopilotDrawer({
  open,
  onClose,
  query,
  result,
  loading,
  error,
}: CopilotDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm transition-all duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label="Close copilot drawer"
      />
      <div className="relative z-50 h-full w-full max-w-xl border-l bg-card p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="space-y-6">
          {/* Drawer Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  AI Retail Analytics Copilot
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Agentic tool execution directly over 541k in-memory retail transactions.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* User Query Pill */}
          <div className="rounded-lg bg-muted/60 p-3 border border-border flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <div className="text-xs">
              <span className="text-muted-foreground">Question: </span>
              <span className="font-semibold text-foreground">"{query}"</span>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span>Consulting analytical agent & computing aggregations...</span>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted/70 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-muted/70 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-muted/70 rounded animate-pulse" />
              </div>
              <div className="h-48 w-full bg-muted/40 rounded-xl border border-dashed border-border animate-pulse" />
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error executing query: </span>
                {error}
              </div>
            </div>
          )}

          {/* Result Content */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Metric Tag */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 bg-primary/5 text-primary border-primary/20">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Metric: {result.suggested_metric}</span>
                </Badge>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Live Pandas Query
                </span>
              </div>

              {/* Agent Narrative Response */}
              <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Executive Answer
                </h4>
                <p className="text-sm text-foreground leading-relaxed">
                  {result.answer}
                </p>
              </div>

              {/* Quick Visual Chart (if chart_data returned) */}
              {result.chart_data && result.chart_data.length > 0 && (
                <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span>Data Breakdown ({result.suggested_metric})</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {result.chart_data.length} data points
                    </span>
                  </div>

                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={result.chart_data}
                        margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                      >
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "currentColor", opacity: 0.7, fontSize: 10 }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis
                          tick={{ fill: "currentColor", opacity: 0.7, fontSize: 10 }}
                          tickFormatter={(v) =>
                            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [
                            value.toLocaleString(),
                            result.suggested_metric,
                          ]}
                        />
                        <Bar
                          dataKey="value"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        >
                          {result.chart_data.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={BAR_COLORS[index % BAR_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t pt-4 text-center text-[11px] text-muted-foreground flex items-center justify-between">
          <span>FastAPI Microservice Engine</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

