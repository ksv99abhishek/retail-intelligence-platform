"use client";

import React, { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Calendar,
  Globe,
  Sparkles,
  Sun,
  Moon,
  TrendingUp,
  Clock,
  ShoppingBag,
  Filter,
  Check,
  Bot,
  HelpCircle,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Badge } from "@/components/ui/badge";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeQuarter: string;
  setActiveQuarter: (quarter: string) => void;
  activeCountry: string;
  setActiveCountry: (country: string) => void;
  onAskCopilot?: (query: string) => void;
}

export function CommandPalette({
  open,
  setOpen,
  activeQuarter,
  setActiveQuarter,
  activeCountry,
  setActiveCountry,
  onAskCopilot,
}: CommandPaletteProps) {
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");

  // Listen for global Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const handleSelectQuarter = (quarter: string) => {
    setActiveQuarter(quarter);
    setOpen(false);
  };

  const handleSelectCountry = (country: string) => {
    setActiveCountry(country);
    setOpen(false);
  };

  const handleAsk = (q: string) => {
    if (onAskCopilot && q.trim()) {
      onAskCopilot(q.trim());
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command className="rounded-xl border shadow-2xl">
        <CommandInput
          value={search}
          onValueChange={setSearch}
          onKeyDown={(e) => {
            if (e.key === "Enter" && search.trim()) {
              handleAsk(search);
            }
          }}
          placeholder="Ask a question or search metrics (e.g. 'Which country had the highest AOV?')..."
        />
        <CommandList>
          <CommandEmpty className="p-4 text-center">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">No standard navigation commands found.</p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => handleAsk(search)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-semibold transition-colors border border-primary/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Ask Copilot: "{search}"</span>
                </button>
              )}
            </div>
          </CommandEmpty>

          {/* AI Copilot Quick Questions */}
          <CommandGroup heading="AI Retail Analytics Copilot">
            {search.trim().length > 0 && (
              <CommandItem
                onSelect={() => handleAsk(search)}
                className="flex items-center justify-between text-primary font-medium bg-primary/5 border border-primary/10 rounded-lg my-1"
              >
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span>Ask Copilot: "{search}"</span>
                </div>
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </CommandItem>
            )}

            <CommandItem
              onSelect={() => handleAsk("Which country had the highest average order value?")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-emerald-500" />
                <span>"Which country had the highest average order value?"</span>
              </div>
              <Badge variant="outline" className="text-[10px]">AOV Analysis</Badge>
            </CommandItem>

            <CommandItem
              onSelect={() => handleAsk("Show monthly cancellations")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-rose-500" />
                <span>"Show monthly cancellations"</span>
              </div>
              <Badge variant="outline" className="text-[10px]">Returns Trend</Badge>
            </CommandItem>

            <CommandItem
              onSelect={() => handleAsk("What is the peak order time?")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-purple-500" />
                <span>"What is the peak order time?"</span>
              </div>
              <Badge variant="outline" className="text-[10px]">Hourly Volume</Badge>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Timeframe & Quarter Queries */}
          <CommandGroup heading="Timeframe & Quarters">
            <CommandItem
              onSelect={() => handleSelectQuarter("all")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" />
                <span>Show Full 13-Month Dataset (Dec 2010 - Dec 2011)</span>
              </div>
              {activeQuarter === "all" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectQuarter("q4_2011")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>Filter by Q4 2011 (Holiday Surge: Oct - Dec)</span>
              </div>
              {activeQuarter === "q4_2011" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectQuarter("q3_2011")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <span>Filter by Q3 2011 (Summer Expansion: Jul - Sep)</span>
              </div>
              {activeQuarter === "q3_2011" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectQuarter("q2_2011")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span>Filter by Q2 2011 (Spring Season: Apr - Jun)</span>
              </div>
              {activeQuarter === "q2_2011" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectQuarter("q1_2011")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span>Filter by Q1 2011 (Post-Holiday: Jan - Mar)</span>
              </div>
              {activeQuarter === "q1_2011" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectQuarter("aug_nov_2011")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-500" />
                <span>Filter by Late 2011 (Aug 1 - Nov 30, 2011)</span>
              </div>
              {activeQuarter === "aug_nov_2011" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Geographic Markets Filter */}
          <CommandGroup heading="Geographic Markets">
            <CommandItem
              onSelect={() => handleSelectCountry("all")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                <span>All Global Markets (Worldwide)</span>
              </div>
              {activeCountry === "all" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectCountry("United Kingdom")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <span>Filter by United Kingdom (Domestic Market)</span>
              </div>
              {activeCountry.toLowerCase() === "united kingdom" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectCountry("Germany")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-amber-500" />
                <span>Filter by Germany (Key European Expansion)</span>
              </div>
              {activeCountry.toLowerCase() === "germany" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectCountry("France")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-indigo-500" />
                <span>Filter by France</span>
              </div>
              {activeCountry.toLowerCase() === "france" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectCountry("Netherlands")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-orange-500" />
                <span>Filter by Netherlands</span>
              </div>
              {activeCountry.toLowerCase() === "netherlands" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>

            <CommandItem
              onSelect={() => handleSelectCountry("EIRE")}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-500" />
                <span>Filter by EIRE (Ireland)</span>
              </div>
              {activeCountry.toLowerCase() === "eire" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Quick UI & System Actions */}
          <CommandGroup heading="System & Theme Actions">
            <CommandItem
              onSelect={() => {
                toggleTheme();
                setOpen(false);
              }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-700" />
                )}
                <span>Toggle Dark / Light Mode</span>
              </div>
              <CommandShortcut>Theme</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

