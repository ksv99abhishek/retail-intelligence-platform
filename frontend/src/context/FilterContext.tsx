"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AgentQueryResponse, ExecutiveReportData, RetailDashboardData } from "@/lib/types";
import { useRetailAnalytics } from "@/hooks/useRetailAnalytics";

interface FilterContextType {
  activeQuarter: string;
  setActiveQuarter: (q: string) => void;
  activeCountry: string;
  setActiveCountry: (c: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;

  // Command Palette
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  // AI Copilot Drawer
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  copilotQuery: string;
  copilotResult: AgentQueryResponse | null;
  copilotLoading: boolean;
  copilotError: string | null;
  handleAskCopilot: (query: string) => Promise<void>;

  // Executive Intelligence Report Drawer
  reportOpen: boolean;
  setReportOpen: (open: boolean) => void;
  reportData: ExecutiveReportData | null;
  reportLoading: boolean;
  fetchReport: () => Promise<void>;

  // Analytics Feed
  data: RetailDashboardData | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  refetch: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeQuarter, setActiveQuarter] = useState<string>("all");
  const [activeCountry, setActiveCountry] = useState<string>("all");
  const [commandOpen, setCommandOpen] = useState(false);

  // Copilot Drawer State
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotResult, setCopilotResult] = useState<AgentQueryResponse | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  // Executive Report Drawer State
  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState<ExecutiveReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Live dynamic analytics query
  const { data, loading, error, isLive, refetch } = useRetailAnalytics({
    quarter: activeQuarter,
    country: activeCountry,
  });

  const hasActiveFilters = activeQuarter !== "all" || activeCountry !== "all";

  const clearFilters = () => {
    setActiveQuarter("all");
    setActiveCountry("all");
  };

  const handleAskCopilot = async (query: string) => {
    setCopilotQuery(query);
    setCopilotOpen(true);
    setCopilotLoading(true);
    setCopilotError(null);
    try {
      const res = await fetch("http://localhost:8000/api/agent/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        throw new Error(`Agent query failed with HTTP status ${res.status}`);
      }
      const json: AgentQueryResponse = await res.json();
      setCopilotResult(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute copilot query";
      setCopilotError(msg);
      setCopilotResult(null);
    } finally {
      setCopilotLoading(false);
    }
  };

  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/reports/latest");
      if (res.ok) {
        const json: ExecutiveReportData = await res.json();
        setReportData(json);
      }
    } catch (err) {
      console.warn("Could not fetch latest executive report:", err);
    } finally {
      setReportLoading(false);
    }
  };

  // Sync URL parameters on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("cmd") === "true") setCommandOpen(true);
      const q = params.get("quarter");
      if (q) setActiveQuarter(q);
      const c = params.get("country");
      if (c) setActiveCountry(c);
      const copilotQ = params.get("copilot");
      if (copilotQ) {
        handleAskCopilot(
          copilotQ === "true" ? "Which country had the highest average order value?" : copilotQ
        );
      }
      if (params.get("report") === "true") {
        setReportOpen(true);
        fetchReport();
      }
    }
  }, []);

  return (
    <FilterContext.Provider
      value={{
        activeQuarter,
        setActiveQuarter,
        activeCountry,
        setActiveCountry,
        clearFilters,
        hasActiveFilters,
        commandOpen,
        setCommandOpen,
        copilotOpen,
        setCopilotOpen,
        copilotQuery,
        copilotResult,
        copilotLoading,
        copilotError,
        handleAskCopilot,
        reportOpen,
        setReportOpen,
        reportData,
        reportLoading,
        fetchReport,
        data,
        loading,
        error,
        isLive,
        refetch,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilterContext() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilterContext must be used within a FilterProvider");
  }
  return context;
}

