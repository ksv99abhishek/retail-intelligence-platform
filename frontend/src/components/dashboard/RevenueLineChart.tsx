"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { MonthlyRevenue } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface RevenueLineChartProps {
  data: MonthlyRevenue[];
}

export function RevenueLineChart({ data }: RevenueLineChartProps) {
  return (
    <Card className="flex flex-col border-border/80 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Monthly Revenue Trajectory
            </CardTitle>
            <CardDescription>
              Continuous sales volume growth leading to Q4 holiday surge
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+98.8% Total Aug-Nov Growth</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-muted/40"
              />

              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                className="text-xs fill-muted-foreground"
                dy={8}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `£${(val / 1_000_000).toFixed(1)}M`}
                tick={{ fontSize: 12 }}
                className="text-xs fill-muted-foreground"
                dx={-4}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as MonthlyRevenue;
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          {label} 2011
                        </p>
                        <p className="text-base font-bold text-foreground mt-0.5">
                          {formatCurrency(item.revenue)}
                        </p>
                        {item.growth > 0 && (
                          <p className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-0.5">
                            <span>+{item.growth}% MoM Expansion</span>
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#revenueGradient)"
                isAnimationActive={false}
                dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#0f172a" }}
                activeDot={{
                  r: 6,
                  className: "fill-emerald-500 stroke-background stroke-2",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

