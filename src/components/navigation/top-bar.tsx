"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Search, Menu, ChevronRight } from "lucide-react";
import { useThemeStore } from "@/lib/stores/theme-store";
import { SyncStatusBadge } from "@/components/sync-status-badge";

export interface TopBarProps {
  onSearchClick?: () => void;
  onMenuClick?: () => void;
}

export function TopBar({ onSearchClick, onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useThemeStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Derive breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label = seg.charAt(0).toUpperCase() + seg.slice(1);
    return { href, label };
  });

  return (
    <header className="sticky top-0 z-20 w-full border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-sm">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              OS
            </Link>
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <React.Fragment key={item.href}>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  {isLast ? (
                    <span
                      aria-current="page"
                      className="font-semibold text-foreground truncate"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground font-medium transition-colors truncate"
                    >
                      {item.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <SyncStatusBadge />

          {/* Search Trigger */}
          <button
            onClick={onSearchClick}
            className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan border border-border/40"
          >
            {/* Accessible name comes from content so the visible label
                ("Search...") is part of it (WCAG 2.5.3). The sr-only span
                adds context on all breakpoints, including mobile where the
                visible text is hidden. */}
            <span className="sr-only">Search curriculum and resources (Ctrl+K)</span>
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline text-xs">Search...</span>
            <kbd className="hidden sm:inline text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border font-mono" aria-hidden="true">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle */}
          {mounted ? (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700" />
              )}
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>
      </div>
    </header>
  );
}
