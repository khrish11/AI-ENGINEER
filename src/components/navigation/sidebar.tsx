"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  FolderKanban,
  Compass,
  BarChart3,
  Settings,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Search,
  GitCommit,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/curriculum", label: "Curriculum", icon: BookOpen, badge: "20 Phases" },
  { href: "/resources", label: "Resources", icon: Compass },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/roadmap", label: "Roadmap", icon: Compass, badge: "Phase 5" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, badge: "Phase 7" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface SidebarProps {
  onSearchClick?: () => void;
}

export function Sidebar({ onSearchClick }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-surface transition-all duration-300 z-30 select-none",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-border h-16">
        {!isCollapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-violet flex items-center justify-center text-white shadow-sm font-bold text-sm">
              AI
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-foreground truncate">
                AI Engineer OS
              </span>
              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                <GitCommit className="w-2.5 h-2.5 inline" /> v0.1.0 (Phase 1)
              </span>
            </div>
          </Link>
        ) : (
          <div className="mx-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-violet flex items-center justify-center text-white shadow-sm font-bold text-sm">
              AI
            </div>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Quick Search Button.
          Visible text ("Search OS...") must stay part of the accessible name
          (WCAG 2.5.3); when expanded the name is derived from content, and
          when collapsed there is no visible text, so the explicit label is
          kept for that state. */}
      <div className="p-3">
        <button
          onClick={onSearchClick}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan",
            isCollapsed && "justify-center px-0"
          )}
          aria-label={isCollapsed ? "Quick search (Ctrl+K)" : undefined}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left text-xs">Search OS...</span>
              <kbd className="text-[10px] bg-surface px-1.5 py-0.5 rounded border border-border font-mono">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative",
                isActive
                  ? "bg-accent-cyan/15 text-accent-cyan font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-accent-cyan" : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden="true"
              />
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
              {isCollapsed && (
                <div className="sr-only">{item.label}</div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Learner Status Footer */}
      <div className="p-3 border-t border-border">
        {!isCollapsed ? (
          <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-violet/20 border border-accent-violet/30 flex items-center justify-center text-accent-violet font-semibold text-xs shrink-0">
              G
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground truncate">
                  Guest Learner
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                Local-first persistence
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-accent-violet/20 border border-accent-violet/30 flex items-center justify-center text-accent-violet font-semibold text-xs">
              G
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
