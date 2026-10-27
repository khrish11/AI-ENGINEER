"use client";

import { useEffect, useState } from "react";
import { fetchAuthStatus, type ClientAuthStatus } from "@/lib/auth/client-status";

export type AuthStatus = ClientAuthStatus;

/**
 * Reads the shared /api/auth/status snapshot exactly once per mount via the
 * deduplicated fetchAuthStatus reader. `loading` distinguishes "not checked
 * yet" from a definitive `configured:false` — consumers must gate
 * configuration warnings on !loading to avoid the pre-hydration
 * "OAuth is not configured" flash (BUG-04).
 */
export function useAuthStatus() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchAuthStatus().then((status) => {
      if (!active) return;
      setAuthStatus(status);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    authStatus: authStatus ?? {
      configured: false,
      providers: [],
      developmentHint: null,
      authenticated: false,
      user: null,
    },
    loading,
    settled: authStatus !== null,
  };
}
