"use client";

import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopProduct } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Package, Award } from "lucide-react";

interface TopProductsTableProps {
  products: TopProduct[];
}

export function TopProductsTable({ products }: TopProductsTableProps) {
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 font-bold text-xs">
            1
          </span>
        );
      case 2:
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400/20 text-slate-400 font-bold text-xs">
            2
          </span>
        );
      case 3:
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-700/20 text-amber-600 font-bold text-xs">
            3
          </span>
        );
      default:
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground font-medium text-xs">
            {rank}
          </span>
        );
    }
  };

  return (
    <Card className="flex flex-col border-border/80 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Top Products by Revenue
            </CardTitle>
            <CardDescription>
              Best-performing SKUs by gross generated merchandise volume
            </CardDescription>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex text-xs">
            <Package className="mr-1 h-3 w-3 text-muted-foreground" />
            Top 5 SKUs
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center">Rank</TableHead>
              <TableHead>Product Description</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.rank} className="hover:bg-muted/40">
                <TableCell className="font-medium text-center">
                  {getRankBadge(product.rank)}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground text-xs sm:text-sm">
                    {product.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono">{product.stockCode}</span>
                    <span>•</span>
                    <span>{product.category}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs font-mono text-muted-foreground">
                  {formatNumber(product.quantitySold)}
                </TableCell>
                <TableCell className="text-right text-xs font-mono text-muted-foreground">
                  £{product.unitPrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground text-xs sm:text-sm font-mono">
                  {product.displayRevenue}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

