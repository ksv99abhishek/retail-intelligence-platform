"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  Users,
  Activity,
  Sparkles,
  FileText,
  Command,
  Database,
  Cpu,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFilterContext } from "@/context/FilterContext";

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className = "", onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { setCommandOpen, setCopilotOpen, setReportOpen, fetchReport, isLive } =
    useFilterContext();

  const navItems = [
    {
      label: "Executive Overview",
      href: "/",
      icon: LayoutDashboard,
      badge: "Core",
      description: "Financial KPIs & macro trends",
    },
    {
      label: "Cancellation Risk",
      href: "/risk",
      icon: ShieldAlert,
      badge: "XGBoost",
      description: "SHAP waterfall & churn",
    },
    {
      label: "Customer 360",
      href: "/customers",
      icon: Users,
      badge: "CLV",
      description: "Lifetimes & RFM segments",
    },
    {
      label: "Live Ledger",
      href: "/ledger",
      icon: Activity,
      badge: "Stream",
      description: "Isolation Forest anomalies",
    },
  ];

  const handleOpenReport = () => {
    setReportOpen(true);
    fetchReport();
    if (onNavigate) onNavigate();
  };

  const handleOpenCopilot = () => {
    setCopilotOpen(true);
    if (onNavigate) onNavigate();
  };

  return (
    <aside
      className={`w-64 border-r border-border bg-card/60 backdrop-blur-xl flex flex-col justify-between select-none ${className}`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border/60">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-primary-foreground shadow-md shadow-emerald-500/20">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground leading-tight">
              Retail Intelligence
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Autonomous Platform
            </p>
          </div>
        </div>

        {/* Primary Navigation Links */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive
                        ? "text-primary-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 font-semibold tracking-wide uppercase ${
                      isActive
                        ? "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground"
                        : "border-border text-muted-foreground/80 bg-card/40"
                    }`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Intelligence Actions */}
        <div className="px-3 py-2 space-y-1.5 border-t border-border/40 mt-2">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Intelligence Tools
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenCopilot}
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-purple-500/10 gap-2.5 h-9"
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>AI Copilot Agent</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenReport}
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-emerald-500/10 gap-2.5 h-9"
          >
            <FileText className="h-4 w-4 text-emerald-500" />
            <span>Executive Briefing</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCommandOpen(true)}
            className="w-full justify-between text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 h-9"
          >
            <div className="flex items-center gap-2.5">
              <Command className="h-4 w-4 text-blue-500" />
              <span>Command Palette</span>
            </div>
            <kbd className="text-[10px] font-mono border rounded px-1.5 py-0.5 bg-muted/40">
              ⌘K
            </kbd>
          </Button>
        </div>
      </div>

      {/* Telemetry & System Status Footer */}
      <div className="p-3 border-t border-border/60 bg-muted/10 space-y-2">
        <div className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          System Telemetry
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between px-2 py-1 rounded bg-card/60 border border-border/40">
            <span className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-blue-500" />
              FastAPI Core
            </span>
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 ${
                isLive
                  ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                  : "text-amber-500 border-amber-500/30"
              }`}
            >
              {isLive ? "Online :8000" : "Offline Cache"}
            </Badge>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-card/60 border border-border/40">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-rose-500" />
              IsolationForest
            </span>
            <span className="font-mono text-[10px] text-foreground">1.0% Contam</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-card/60 border border-border/40">
            <span className="flex items-center gap-1.5">
              <Database className="h-3 w-3 text-emerald-500" />
              Dataset Rows
            </span>
            <span className="font-mono text-[10px] text-foreground">541,909</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

