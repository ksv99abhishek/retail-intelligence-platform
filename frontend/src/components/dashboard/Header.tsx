"use client";

import React, { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  Calendar,
  ChevronDown,
  Moon,
  Sun,
  TrendingUp,
  Check,
  Command as CommandIcon,
  Wifi,
  WifiOff,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  selectedQuarter: string;
  onSelectQuarter: (q: string) => void;
  onOpenCommandPalette: () => void;
  isLive?: boolean;
  onToggleMobileNav?: () => void;
}

export function Header({
  selectedQuarter,
  onSelectQuarter,
  onOpenCommandPalette,
  isLive = true,
  onToggleMobileNav,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const periods = [
    { key: "all", label: "Full Dataset (13 Months)" },
    { key: "q4_2011", label: "Q4 2011 (Holiday Surge)" },
    { key: "q3_2011", label: "Q3 2011 (Summer Expansion)" },
    { key: "q2_2011", label: "Q2 2011 (Spring Season)" },
    { key: "q1_2011", label: "Q1 2011 (Post-Holiday)" },
    { key: "aug_nov_2011", label: "Late 2011 (Aug - Nov)" },
  ];

  const currentPeriod =
    periods.find((p) => p.key === selectedQuarter)?.label || "Full Dataset (13 Months)";

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left branding */}
        <div className="flex items-center gap-3">
          {onToggleMobileNav && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMobileNav}
              className="lg:hidden h-9 w-9 -ml-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/20">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Retail Intelligence
              </h1>
              {isLive ? (
                <Badge variant="success" className="hidden text-[10px] sm:inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>FastAPI Live</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="hidden text-[10px] sm:inline-flex items-center gap-1 text-muted-foreground">
                  <WifiOff className="h-2.5 w-2.5" />
                  <span>Cached Data</span>
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Online Retail Insights & Market Analytics
            </p>
          </div>
        </div>

        {/* Right controls: AI Command Palette, Date range, Theme toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Command Palette Button (Cmd+K) */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 text-xs font-normal border-border bg-card/80 hover:bg-accent text-muted-foreground hover:text-foreground shadow-xs px-2.5 sm:px-3"
            title="Open AI Command Palette (⌘K)"
          >
            <CommandIcon className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline">Quick Actions...</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* Stateful Date-Range Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 text-xs font-normal border-border bg-card hover:bg-accent shadow-xs"
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden md:inline font-medium">{currentPeriod}</span>
              <span className="md:hidden font-medium">
                {selectedQuarter === "all" ? "13 Mo" : selectedQuarter.toUpperCase().replace("_2011", "")}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl z-50 animate-in fade-in-80"
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Select Filter Period (FastAPI Synced)
                </div>
                {periods.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      onSelectQuarter(p.key);
                      setDropdownOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground text-left transition-colors"
                  >
                    <span>{p.label}</span>
                    {selectedQuarter === p.key && (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 border-border bg-card hover:bg-accent text-foreground transition-all duration-200"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle dark/light theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700 transition-transform -rotate-12 hover:rotate-0" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
