"use client";

import React from "react";
import {
  ShoppingBag,
  PoundSterling,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiItem } from "@/lib/types";

interface KpiGridProps {
  kpis: KpiItem[];
}

export function KpiGrid({ kpis }: KpiGridProps) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "ShoppingBag":
        return <ShoppingBag className="h-5 w-5 text-emerald-500" />;
      case "PoundSterling":
        return <PoundSterling className="h-5 w-5 text-blue-500" />;
      case "AlertCircle":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "Clock":
        return <Clock className="h-5 w-5 text-purple-500" />;
      default:
        return <ShoppingBag className="h-5 w-5 text-emerald-500" />;
    }
  };

  return (
    <section aria-label="Global Key Performance Indicators" className="w-full">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.id}
            className="group relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-xs transition-all duration-300 hover:border-border hover:shadow-lg hover:-translate-y-0.5"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                  {getIcon(kpi.icon)}
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {kpi.displayValue}
                </div>
              </div>

              {/* Trend Indicator */}
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  {kpi.changeType === "positive" ? (
                    <span className="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400">
                      <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                      {kpi.changeLabel}
                    </span>
                  ) : kpi.changeType === "negative" ? (
                    <span className="inline-flex items-center font-medium text-rose-600 dark:text-rose-400">
                      <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                      {kpi.changeLabel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center font-medium text-muted-foreground">
                      {kpi.changeLabel}
                    </span>
                  )}
                </div>

                <span
                  title={kpi.tooltip}
                  className="cursor-help text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

