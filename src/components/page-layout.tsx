"use client";

import * as React from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { TopBar } from "@/components/navigation/top-bar";
import { SearchModal } from "@/components/navigation/search-modal";

export function PageLayout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Global keyboard shortcut: Ctrl+K or Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar onSearchClick={() => setSearchOpen(true)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            onSearchClick={() => setSearchOpen(true)}
            onMenuClick={() => setDrawerOpen(true)}
          />
          <main id="main-content" className="flex-1 pb-16 md:pb-8">
            {children}
          </main>
        </div>
      </div>

      <MobileNav
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
        onSearchClick={() => setSearchOpen(true)}
      />

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
