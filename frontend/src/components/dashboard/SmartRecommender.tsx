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
import {
  Sparkles,
  ShoppingBag,
  TrendingUp,
  PackageCheck,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { ProductRecommendation, ProductRecommendationsResponse } from "@/lib/types";

const POPULAR_SKUS = [
  "REGENCY CAKESTAND 3 TIER",
  "WHITE HANGING HEART T-LIGHT HOLDER",
  "LUNCH BAG RED RETROSPOT",
  "GREEN REGENCY TEACUP AND SAUCER",
  "PARTY BUNTING",
  "SET OF 3 CAKE TINS PANTRY DESIGN",
];

export function SmartRecommender() {
  const [selectedProduct, setSelectedProduct] = useState<string>("REGENCY CAKESTAND 3 TIER");
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async (productName: string) => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(productName);
      const res = await fetch(`http://localhost:8000/recommend/${encoded}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data: ProductRecommendationsResponse = await res.json();
      setRecommendations(data.recommendations);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load cross-sell recommendations";
      setError(msg);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations(selectedProduct);
  }, [selectedProduct, fetchRecommendations]);

  const handleSelectProduct = (product: string) => {
    setSelectedProduct(product);
  };

  return (
    <Card className="shadow-sm border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-lg font-bold">
                Smart Basket Recommender & Cross-Sell
              </CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                Market Basket Analysis (MBA)
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Frequent itemset mining and association rules predicting complementary purchases with lift metrics.
            </CardDescription>
          </div>

          {/* SKU Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Seed SKU:</span>
            <div className="relative">
              <select
                value={selectedProduct}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="h-9 w-64 sm:w-72 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary appearance-none pr-8 cursor-pointer truncate"
              >
                {POPULAR_SKUS.map((sku) => (
                  <option key={sku} value={sku}>
                    {sku}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-xs">Calculating association rules & lift scores...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive text-center">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="group relative rounded-xl border border-border bg-card/60 p-4 transition-all hover:border-primary/40 hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      <TrendingUp className="h-3 w-3" />
                      Lift: {rec.lift.toFixed(2)}x
                    </span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {(rec.confidence * 100).toFixed(0)}% Conf.
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2.5 mt-1">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/10 transition-colors">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                        {rec.recommended_item}
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {rec.affinity}
                  </span>
                  <span className="text-[10px] text-muted-foreground">High Affinity</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

