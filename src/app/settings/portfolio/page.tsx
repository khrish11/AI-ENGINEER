"use client";

import * as React from "react";
import { PortfolioSettingsClient } from "@/components/portfolio/portfolio-settings-client";
import { useAuthStatus } from "@/hooks/useAuthStatus";

export default function PortfolioSettingsPage() {
  const { auth, loading } = useAuthStatus();
  if (loading) {
    return (
      <main
        id="main-content"
        className="container mx-auto px-4 md:px-6 py-8 max-w-3xl"
        aria-busy="true"
      >
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
        <span className="sr-only">Loading…</span>
      </main>
    );
  }
  return (
    <main id="main-content" className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-3xl">
      <PortfolioSettingsClient auth={auth} />
    </main>
  );
}
