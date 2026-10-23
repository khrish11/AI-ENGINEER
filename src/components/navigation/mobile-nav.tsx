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
  X,
  Search,
  Sun,
  Moon,
  GitCommit,
} from "lucide-react";
import { useThemeStore } from "@/lib/stores/theme-store";

const BOTTOM_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/curriculum", label: "Curriculum", icon: BookOpen },
  { href: "/resources", label: "Resources", icon: Compass },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ALL_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/curriculum", label: "Curriculum", icon: BookOpen, badge: "20 Phases" },
  { href: "/resources", label: "Resources", icon: Compass },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/roadmap", label: "Roadmap", icon: Compass, badge: "Phase 5" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, badge: "Phase 7" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface MobileNavProps {
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
  onSearchClick?: () => void;
}

interface AuthStatus {
  authenticated: boolean;
  user: { id: string; name: string | null; email: string | null } | null;
}

export function MobileNav({
  drawerOpen = false,
  onDrawerClose,
  onSearchClick,
}: MobileNavProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useThemeStore();
  const [mounted, setMounted] = React.useState(false);
  const [authStatus, setAuthStatus] = React.useState<AuthStatus | null>(null);

  React.useEffect(() => {
    setMounted(true);
    const loadAuthStatus = async () => {
      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" });
        const json = (await response.json()) as AuthStatus;
        setAuthStatus(json);
      } catch {
        setAuthStatus(null);
      }
    };
    void loadAuthStatus();
  }, []);

  return (
    <>
      {/* Slide-out Drawer for Mobile */}
      {drawerOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 md:hidden flex"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onDrawerClose}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
            className="relative z-50 w-72 max-w-[80vw] bg-surface border-r border-border h-full flex flex-col p-4 shadow-2xl animate-in slide-in-from-left duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-violet flex items-center justify-center text-white font-bold text-sm">
                  AI
                </div>
                <div>
                  <h2 className="font-bold text-sm text-foreground">AI Engineer OS</h2>
                  <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                    <GitCommit className="w-2.5 h-2.5 inline" /> v0.1.0
                  </p>
                </div>
              </div>
              <button
                onClick={onDrawerClose}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Search */}
            <div className="py-3">
              <button
                onClick={() => {
                  onDrawerClose?.();
                  onSearchClick?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
              >
                <Search className="h-4 w-4" />
                <span className="text-xs">Search curriculum...</span>
              </button>
            </div>

            {/* Navigation items */}
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {ALL_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onDrawerClose}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent-cyan/15 text-accent-cyan font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-accent-violet/20 flex items-center justify-center text-accent-violet text-xs font-semibold">
                  {mounted && authStatus?.authenticated
                    ? (authStatus.user?.name || authStatus.user?.email || "U").charAt(0).toUpperCase()
                    : "—"}
                </div>
                <span className="text-xs font-medium text-foreground">
                  {mounted && authStatus?.authenticated
                    ? authStatus.user?.name || authStatus.user?.email || "Learner"
                    : "Not Signed In"}
                </span>
              </div>
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-slate-700" />
                  )}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Bottom Fixed Navigation Bar (Mobile) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border z-40"
      >
        <div className="flex items-center justify-around py-1.5 px-2">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-lg transition-colors min-w-[56px]",
                  isActive
                    ? "text-accent-cyan font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="text-[10px] leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
