"use client";

import { useEffect, useState } from "react";

export interface AuthStatus {
  configured: boolean;
  providers: string[];
  authenticated: boolean;
  user: { id: string; name: string | null; email: string | null } | null;
}

export function useAuthStatus() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    configured: false,
    providers: [],
    authenticated: false,
    user: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuthStatus() {
      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" });
        const json = (await response.json()) as AuthStatus;
        setAuthStatus(json);
      } catch {
        setAuthStatus({
          configured: false,
          providers: [],
          authenticated: false,
          user: null,
        });
      } finally {
        setLoading(false);
      }
    }
    void loadAuthStatus();
  }, []);

  return { authStatus, loading };
}
