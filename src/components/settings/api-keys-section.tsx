"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  KeyRound,
  Copy,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Terminal,
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

interface CreatedKey extends ApiKeyItem {
  secretKey: string;
}

type ExpirationChoice = "never" | "30d" | "90d" | "1y";

const EXPIRATION_OPTIONS: { value: ExpirationChoice; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

function expirationToDate(choice: ExpirationChoice): string | undefined {
  if (choice === "never") return undefined;
  const days = choice === "30d" ? 30 : choice === "90d" ? 90 : 365;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function keyStatus(key: ApiKeyItem): "active" | "revoked" | "expired" {
  if (key.isRevoked) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function ApiKeysSection() {
  const [keys, setKeys] = React.useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState("read");
  const [expiration, setExpiration] = React.useState<ExpirationChoice>("never");
  const [creating, setCreating] = React.useState(false);
  const [createdKey, setCreatedKey] = React.useState<CreatedKey | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const loadKeys = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/api-keys", { credentials: "same-origin" });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: ApiKeyItem[]; error?: string }
        | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? "Failed to load API keys");
      }
      setKeys(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const copyText = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Copy failed — select and copy manually");
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const expiresAt = expirationToDate(expiration);
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: scopes.trim() || "read",
          ...(expiresAt ? { expiresAt } : {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: CreatedKey; error?: string }
        | null;
      if (!res.ok || !body?.success || !body.data?.secretKey) {
        throw new Error(body?.error ?? "Failed to create API key");
      }
      setCreatedKey(body.data);
      setName("");
      setScopes("read");
      setExpiration("never");
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm("Revoke this API key? Any integrations using it will stop working immediately.")) {
      return;
    }
    setRevokingId(keyId);
    setError(null);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? "Failed to revoke API key");
      }
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setRevokingId(null);
    }
  };

  const curlExample = createdKey?.secretKey ?? "aios_YOUR_KEY_HERE";

  return (
    <Card data-testid="api-keys-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Developer / API Keys
            </CardTitle>
            <CardDescription>
              Create keys to access the public REST API and MCP integrations programmatically.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadKeys()}
            disabled={loading}
            aria-label="Refresh API keys"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-xs flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Create form */}
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-lg border border-border bg-surface p-4 space-y-3"
          aria-label="Create API key"
        >
          <h4 className="text-sm font-semibold text-foreground">Generate new key</h4>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="api-key-name" className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                id="api-key-name"
                data-testid="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. chatbot-integration"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="api-key-scopes" className="text-xs font-medium text-muted-foreground">
                Scopes
              </label>
              <Input
                id="api-key-scopes"
                data-testid="api-key-scopes"
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                placeholder="read"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="api-key-expiration" className="text-xs font-medium text-muted-foreground">
                Expires
              </label>
              <select
                id="api-key-expiration"
                data-testid="api-key-expiration"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value as ExpirationChoice)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                {EXPIRATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" size="sm" disabled={creating || !name.trim()} data-testid="api-key-create">
            <Plus className="w-4 h-4" /> {creating ? "Creating…" : "Create key"}
          </Button>
        </form>

        {/* One-time secret display */}
        {createdKey && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-status-warning/50 bg-status-warning/10 p-4 space-y-3"
            data-testid="api-key-secret"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Copy your API key now — it will not be shown again
                </h4>
                <p className="text-xs text-muted-foreground">
                  Store it somewhere safe. Anyone with this key can call the API as you.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 rounded-md bg-background border border-border px-3 py-2 text-xs font-mono break-all select-all">
                {createdKey.secretKey}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copyText(createdKey.secretKey, "secret")}
                data-testid="copy-secret"
              >
                {copied === "secret" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === "secret" ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreatedKey(null)}
                data-testid="dismiss-secret"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Usage examples */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Usage examples
          </h4>
          <div className="grid lg:grid-cols-2 gap-3">
            {(
              [
                {
                  label: "Authorization: Bearer",
                  cmd: `curl -H "Authorization: Bearer ${curlExample}" \\\n  https://ai-engineer-os-inky.vercel.app/api/v1/phases`,
                  testId: "curl-bearer",
                },
                {
                  label: "x-api-key header",
                  cmd: `curl -H "x-api-key: ${curlExample}" \\\n  https://ai-engineer-os-inky.vercel.app/api/v1/phases`,
                  testId: "curl-x-api-key",
                },
              ] as const
            ).map(({ label, cmd, testId }) => (
              <div key={label} className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                  <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => void copyText(cmd, testId)}
                    data-testid={testId}
                  >
                    {copied === testId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === testId ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="p-3 text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre">
                  {cmd}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Key list */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Your keys</h4>
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
              No API keys yet. Generate one above to start using the API.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="api-key-list">
              {keys.map((key) => {
                const status = keyStatus(key);
                return (
                  <li
                    key={key.id}
                    className="rounded-lg border border-border bg-surface p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                    data-testid={`api-key-item-${key.id}`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {key.name}
                        </span>
                        <Badge
                          variant={
                            status === "active"
                              ? "success"
                              : status === "revoked"
                                ? "error"
                                : "secondary"
                          }
                        >
                          {status}
                        </Badge>
                        <Badge variant="muted">{key.scopes}</Badge>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">
                        {key.keyPrefix}…
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Created {formatDate(key.createdAt)}
                        {key.expiresAt ? ` · Expires ${formatDate(key.expiresAt)}` : " · No expiration"}
                        {key.lastUsedAt ? ` · Last used ${formatDate(key.lastUsedAt)}` : " · Never used"}
                      </p>
                    </div>
                    {status === "active" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleRevoke(key.id)}
                        disabled={revokingId === key.id}
                        data-testid={`revoke-key-${key.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        {revokingId === key.id ? "Revoking…" : "Revoke"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Keys authenticate requests to <code>/api/v1/*</code> and MCP tools. Secrets are shown once
          and are never stored in your browser.
        </p>
      </CardContent>
    </Card>
  );
}
