"use client";

import { useState, useEffect, useCallback } from "react";
import { RetailDashboardData } from "@/lib/types";
import fallbackMockData from "@/data/mockRetailData.json";

interface UseRetailAnalyticsOptions {
  quarter: string;
  country: string;
}

export function useRetailAnalytics({ quarter, country }: UseRetailAnalyticsOptions) {
  const [data, setData] = useState<RetailDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `http://localhost:8000/api/v1/analytics/dashboard?quarter=${encodeURIComponent(
        quarter
      )}&country=${encodeURIComponent(country)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const json = await response.json();
      setData(json);
      setIsLive(true);
    } catch (err: any) {
      console.warn("FastAPI live fetch failed or offline, using standardized dataset:", err.message);
      // Standardized fallback dataset
      setData(fallbackMockData as unknown as RetailDashboardData);
      setIsLive(false);
      setError(err.message || "Failed to reach live API");
    } finally {
      setLoading(false);
    }
  }, [quarter, country]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    refetch: fetchData,
  };
}

