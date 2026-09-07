"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { TopMarket } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Globe, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopMarketsChartProps {
  data: TopMarket[];
}

export function TopMarketsChart({ data }: TopMarketsChartProps) {
  const [excludeUK, setExcludeUK] = useState(false);

  // Filter or sort descending
  const sortedData = [...data].sort((a, b) => b.revenue - a.revenue);
  const displayData = excludeUK
    ? sortedData.filter((d) => d.country !== "United Kingdom")
    : sortedData;

  const ukItem = sortedData.find((d) => d.country === "United Kingdom");
  const ukShare = ukItem ? ukItem.share : 89.2;

  return (
    <Card className="flex flex-col border-border/80 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Top Geographic Markets
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                {excludeUK ? "Europe Focus (ex-UK)" : "Global Scale"}
              </Badge>
            </div>
            <CardDescription>
              Cross-border revenue distribution and market penetration
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle view mode to solve UK scale magnitude */}
            <Button
              variant={excludeUK ? "default" : "outline"}
              size="sm"
              onClick={() => setExcludeUK(!excludeUK)}
              className="h-7 text-xs px-2.5 gap-1.5"
            >
              <Filter className="h-3 w-3" />
              <span>{excludeUK ? "Show All (Inc. UK)" : "Focus Europe (ex-UK)"}</span>
            </Button>

            {!excludeUK && (
              <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Globe className="h-3.5 w-3.5" />
                <span>UK: {ukShare}%</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={displayData}
              layout="vertical"
              margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                className="stroke-muted/40"
              />

              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                domain={excludeUK ? [0, 350000] : [0, 10000000]}
                ticks={
                  excludeUK
                    ? [0, 100000, 200000, 300000]
                    : [0, 2000000, 4000000, 6000000, 8000000, 10000000]
                }
                tickFormatter={(val) =>
                  val >= 1_000_000
                    ? `£${(val / 1_000_000).toFixed(0)}M`
                    : `£${(val / 1_000).toFixed(0)}k`
                }
                tick={{ fontSize: 11 }}
                className="text-xs fill-muted-foreground"
              />

              <YAxis
                type="category"
                dataKey="country"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                className="text-xs fill-foreground font-medium"
                width={100}
              />

              <Tooltip
                cursor={{ fill: "rgba(100, 116, 139, 0.1)" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as TopMarket;
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          Market: {item.country} ({item.code})
                        </p>
                        <p className="text-base font-bold text-foreground mt-0.5">
                          {formatCurrency(item.revenue)}
                        </p>
                        <p className="text-xs font-medium text-blue-500 mt-1">
                          {item.share}% of Tracked Volume
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Bar dataKey="revenue" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                {displayData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.country === "United Kingdom" ? "#3b82f6" : "#60a5fa"}
                    className="transition-opacity hover:opacity-80 cursor-pointer"
                  />
                ))}
                <LabelList
                  dataKey="displayRevenue"
                  position="right"
                  className="fill-muted-foreground text-[11px] font-mono font-medium"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
