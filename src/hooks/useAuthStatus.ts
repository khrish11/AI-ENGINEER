"use client";

import { useEffect, useState } from "react";

export interface AuthStatus {
  configured: boolean;
  providers: Array<{ id: string; name: string }>;
  authenticated: boolean;
  user: {
    name?: string;
    email?: string;
    image?: string | null;
  } | null;
}

export function useAuthStatus() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/status");
        const payload = (await response.json()) as AuthStatus;
        if (!cancelled) setAuth(payload);
      } catch {
        if (!cancelled) setAuth({ configured: false, providers: [], authenticated: false, user: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { auth, loading };
}
