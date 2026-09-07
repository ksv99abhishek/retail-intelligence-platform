"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
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
import { HourlyOrder } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Clock } from "lucide-react";

interface HourlyBarChartProps {
  data: HourlyOrder[];
}

export function HourlyBarChart({ data }: HourlyBarChartProps) {
  return (
    <Card className="flex flex-col border-border/80 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Hourly Order Distribution
            </CardTitle>
            <CardDescription>
              Transaction frequency across peak business trading hours
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Peak at 12:00 PM (3,220)</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-muted/40"
              />

              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                className="text-xs fill-muted-foreground"
                dy={8}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${(val / 1_000).toFixed(1)}k`}
                tick={{ fontSize: 12 }}
                className="text-xs fill-muted-foreground"
                dx={-4}
              />

              <Tooltip
                cursor={{ fill: "rgba(100, 116, 139, 0.1)" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as HourlyOrder;
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          Order Window: {item.time}
                        </p>
                        <p className="text-base font-bold text-foreground mt-0.5">
                          {formatNumber(item.orders)} Orders
                        </p>
                        {item.isPeak && (
                          <span className="inline-block rounded-sm bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-300 mt-1">
                            Daily Peak Trading Hour
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Bar dataKey="orders" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPeak ? "#a855f7" : "#6366f1"}
                    className="transition-opacity hover:opacity-80 cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

