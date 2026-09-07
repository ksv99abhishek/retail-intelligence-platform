"use client";

import React from "react";
import { useFilterContext } from "@/context/FilterContext";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { RevenueLineChart } from "@/components/dashboard/RevenueLineChart";
import { HourlyBarChart } from "@/components/dashboard/HourlyBarChart";
import { TopProductsTable } from "@/components/dashboard/TopProductsTable";
import { TopMarketsChart } from "@/components/dashboard/TopMarketsChart";
import { SmartRecommender } from "@/components/dashboard/SmartRecommender";
import {
  Database,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  X,
  Server,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function OverviewPage() {
  const {
    data,
    loading,
    activeQuarter,
    setActiveQuarter,
    activeCountry,
    setActiveCountry,
    hasActiveFilters,
    clearFilters,
    isLive,
    setReportOpen,
    fetchReport,
  } = useFilterContext();

  const handleOpenReport = () => {
    setReportOpen(true);
    fetchReport();
  };

  return (
    <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Welcome / Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Executive Overview
            </h2>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {data?.summary.period || "Standardized 13-Month Dataset"} • Macro sales trajectory, hourly patterns, and cross-sell affinities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenReport}
            className="text-xs h-7 gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>AI Executive Briefing</span>
          </Button>
          <Badge variant="outline" className="text-xs bg-card/60">
            <Server className="mr-1.5 h-3 w-3 text-blue-500" />
            {isLive ? "FastAPI: localhost:8000" : "Offline Cache Fallback"}
          </Badge>
          <Badge variant="outline" className="text-xs bg-card/60">
            <Database className="mr-1.5 h-3 w-3 text-emerald-500" />
            Dataset: 541k rows
          </Badge>
          <Badge variant="outline" className="text-xs bg-card/60 hidden sm:inline-flex">
            <Sparkles className="mr-1.5 h-3 w-3 text-purple-500" />
            CLV & MBA Ready
          </Badge>
        </div>
      </div>

      {/* Active Filter Pills Bar */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-primary">Active Filters:</span>
          {activeQuarter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 font-medium border text-foreground">
              <span>Quarter: {activeQuarter.toUpperCase().replace("_2011", "")}</span>
              <button
                onClick={() => setActiveQuarter("all")}
                className="hover:text-destructive"
                aria-label="Remove quarter filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {activeCountry !== "all" && (
            <span className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 font-medium border text-foreground">
              <span>Country: {activeCountry}</span>
              <button
                onClick={() => setActiveCountry("all")}
                className="hover:text-destructive"
                aria-label="Remove country filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 text-[11px] ml-auto text-muted-foreground hover:text-foreground"
          >
            Reset All
          </Button>
        </div>
      )}

      {/* 1. Global KPIs (4 Metric Cards) */}
      {data && <KpiGrid kpis={data.kpis} />}

      {/* 2. Analytics Row (2-Column Grid: Line Chart + Bar Chart) */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueLineChart data={data.monthlyRevenueTrend} />
          <HourlyBarChart data={data.hourlyOrders} />
        </div>
      )}

      {/* 3. Details Row (2-Column Grid: Products Table + Markets Horizontal Bar Chart) */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopProductsTable products={data.topProducts} />
          <TopMarketsChart data={data.topMarkets} />
        </div>
      )}

      {/* 4. Dynamic Basket Affinities & Cross-Sell UI */}
      <SmartRecommender />
    </main>
  );
}

