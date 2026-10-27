export interface ClientAuthStatus {
  configured: boolean;
  providers: string[];
  developmentHint?: string | null;
  authenticated: boolean;
  user: { id: string; name: string | null; email: string | null } | null;
}

/**
 * Single shared reader for `/api/auth/status`.
 *
 * Every consumer used to `fetch` its own copy on mount; with several client
 * components mounting in one navigation the endpoint was hit 2-3x per page
 * load. Concurrent callers now coalesce into one in-flight request. No TTL
 * cache is applied: auth state must always be read fresh (sign-in/out flows
 * and the sync coordinator both depend on immediacy over repetition).
 */
let inFlight: Promise<ClientAuthStatus> | null = null;

export const EMPTY_AUTH_STATUS: ClientAuthStatus = {
  configured: false,
  providers: [],
  developmentHint: null,
  authenticated: false,
  user: null,
};

export function fetchAuthStatus(): Promise<ClientAuthStatus> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const response = await fetch("/api/auth/status", { cache: "no-store" });
      if (!response.ok) return { ...EMPTY_AUTH_STATUS };
      return (await response.json()) as ClientAuthStatus;
    } catch {
      return { ...EMPTY_AUTH_STATUS };
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
