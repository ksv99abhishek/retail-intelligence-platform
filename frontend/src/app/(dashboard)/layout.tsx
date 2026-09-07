"use client";

import React, { useState } from "react";
import { FilterProvider, useFilterContext } from "@/context/FilterContext";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { CopilotDrawer } from "@/components/dashboard/CopilotDrawer";
import { ExecutiveReportDrawer } from "@/components/dashboard/ExecutiveReportDrawer";
import { X } from "lucide-react";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const {
    activeQuarter,
    setActiveQuarter,
    activeCountry,
    setActiveCountry,
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
    isLive,
    data,
  } = useFilterContext();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop Persistent Sidebar */}
      <Sidebar className="hidden lg:flex shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto" />

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-card border-r border-border h-full shadow-2xl z-10 flex flex-col">
            <div className="absolute right-2.5 top-3 z-20">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar
              className="w-full flex-1 border-r-0"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main App Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <Header
          selectedQuarter={activeQuarter}
          onSelectQuarter={setActiveQuarter}
          onOpenCommandPalette={() => setCommandOpen(true)}
          isLive={isLive}
          onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
        />

        {/* AI Command Palette (Cmd+K) */}
        <CommandPalette
          open={commandOpen}
          setOpen={setCommandOpen}
          activeQuarter={activeQuarter}
          setActiveQuarter={setActiveQuarter}
          activeCountry={activeCountry}
          setActiveCountry={setActiveCountry}
          onAskCopilot={handleAskCopilot}
        />

        {/* AI Copilot Drawer */}
        <CopilotDrawer
          open={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          query={copilotQuery}
          result={copilotResult}
          loading={copilotLoading}
          error={copilotError}
        />

        {/* Executive Intelligence Briefing Drawer */}
        <ExecutiveReportDrawer
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          report={reportData}
          loading={reportLoading}
          onRefresh={fetchReport}
        />

        {/* Page Content */}
        <div className="flex-1 flex flex-col">{children}</div>

        {/* Persistent Bottom Telemetry Footer */}
        <footer className="border-t py-4 text-center text-xs text-muted-foreground bg-card/20 mt-auto">
          <div className="container mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Retail Intelligence Platform • Next.js App Router, FastAPI, Recharts & XGBoost
            </span>
            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Operational ({data?.summary?.totalRecords ? data.summary.totalRecords.toLocaleString() : "541,909"} records indexed)
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FilterProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </FilterProvider>
  );
}

