"use client";

import * as React from "react";
import { signIn, signOut } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/page-layout";
import { useThemeStore } from "@/lib/stores/theme-store";
import {
  exportProgress,
  previewImport,
  importProgress,
  resetLocalLearningData,
  estimateLocalStorageBytes,
  type ExportData,
  type ImportPreview,
} from "@/lib/progress/export-import";
import {
  getOrCreateDeviceId,
  getLocalProfile,
  shortenDeviceId,
  markAuthenticated,
  markGuest,
} from "@/lib/progress/device";
import { mergeOnSignIn } from "@/lib/progress/sync/client";
import type { MergeSummary } from "@/lib/progress/merge";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useConflicts } from "@/hooks/useConflicts";
import {
  Moon,
  Sun,
  Laptop,
  Download,
  Upload,
  Database,
  CheckCircle2,
  RefreshCw,
  LogOut,
  GitBranch,
  Globe,
  Cloud,
  HardDrive,
  AlertTriangle,
} from "lucide-react";

interface AuthStatus {
  configured: boolean;
  providers: string[];
  developmentHint: string | null;
  authenticated: boolean;
  user: { id: string; name: string | null; email: string | null } | null;
}

const EMPTY_AUTH: AuthStatus = {
  configured: false,
  providers: [],
  developmentHint: null,
  authenticated: false,
  user: null,
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const [mounted, setMounted] = React.useState(false);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [authStatus, setAuthStatus] = React.useState<AuthStatus>(EMPTY_AUTH);
  const [profileAuthenticated, setProfileAuthenticated] = React.useState(false);
  const [exportNotice, setExportNotice] = React.useState(false);
  const [importPreviewState, setImportPreviewState] = React.useState<ImportPreview | null>(null);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importMode, setImportMode] = React.useState<"merge" | "replace">("merge");
  const [importNotice, setImportNotice] = React.useState<string | null>(null);
  const [storageBytes, setStorageBytes] = React.useState<number>(0);
  const [mergeSummary, setMergeSummary] = React.useState<MergeSummary | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mergeAttempted = React.useRef(false);

  const { status, pendingCount, conflictCount, lastSuccessfulSync, refresh: refreshSync, syncNow } =
    useSyncStatus();
  const { conflicts, resolve: resolveConflict, refetch: refreshConflicts } = useConflicts();

  const refreshIdentity = React.useCallback(async () => {
    const id = await getOrCreateDeviceId();
    setDeviceId(id);
    const profile = await getLocalProfile();
    setProfileAuthenticated(Boolean(profile?.isAuthenticated));
    const bytes = await estimateLocalStorageBytes();
    setStorageBytes(bytes);
  }, []);

  const loadAuthStatus = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/status", { cache: "no-store" });
      const json = (await response.json()) as AuthStatus;
      setAuthStatus(json);
      return json;
    } catch {
      setAuthStatus(EMPTY_AUTH);
      return EMPTY_AUTH;
    }
  }, []);

  React.useEffect(() => {
    setMounted(true);
    void (async () => {
      await refreshIdentity();
      const auth = await loadAuthStatus();
      const profile = await getLocalProfile();

      if (auth.authenticated && !profile?.isAuthenticated) {
        // First sign-in on this device (or fresh browser with no local
        // profile yet): keep guest data, merge cloud state.
        await markAuthenticated(auth.user?.email ?? null, auth.user?.name ?? null);
        setProfileAuthenticated(true);
        if (!mergeAttempted.current) {
          mergeAttempted.current = true;
          try {
            const summary = await mergeOnSignIn();
            if (!("skipped" in summary)) setMergeSummary(summary);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Initial sync failed");
          }
        }
        await refreshIdentity();
        await refreshSync();
        await refreshConflicts();
      } else if (!auth.authenticated && profile?.isAuthenticated) {
        await markGuest();
        setProfileAuthenticated(false);
      }
    })();
  }, [loadAuthStatus, refreshConflicts, refreshIdentity, refreshSync]);

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const data: ExportData = await exportProgress();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-engineer-os-export-${new Date().toISOString().split("T")[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportNotice(true);
      setTimeout(() => setExportNotice(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const preview = await previewImport(file);
      setImportPreviewState(preview);
      setImportFile(file);
      setImportNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import preview failed");
    } finally {
      setBusy(false);
    }
  };

  const handleImportApply = async () => {
    if (!importFile) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importProgress(importFile, importMode);
      if (!result.success) {
        setError(result.errors.join("; ") || "Import rejected");
        return;
      }
      setImportNotice(`Import applied (${importMode}). A backup of your previous data was saved.`);
      setImportPreviewState(null);
      setImportFile(null);
      await refreshIdentity();
      await refreshSync();
      await refreshConflicts();
      setTimeout(() => setImportNotice(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("This will delete all local learning data. A backup is kept. Continue?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetLocalLearningData();
      setExportNotice(false);
      setImportNotice("Local learning data reset. A pre-reset backup was retained locally.");
      await refreshIdentity();
      await refreshSync();
      await refreshConflicts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCloudAccount = async () => {
    if (
      !window.confirm(
        "Delete your cloud account and all synchronized learning data? This cannot be undone."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Account deletion failed");
      }
      await resetLocalLearningData();
      await signOut({ callbackUrl: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account deletion failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (provider: "github" | "google") => {
    setError(null);
    try {
      await signIn(provider, { callbackUrl: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut({ redirect: false });
      await markGuest();
      setProfileAuthenticated(false);
      setMergeSummary(null);
      await loadAuthStatus();
      await refreshSync();
    } finally {
      setBusy(false);
    }
  };

  const syncBadgeVariant =
    status === "synced"
      ? "success"
      : status === "conflict" || status === "sync_error"
        ? "warning"
        : status === "offline"
          ? "secondary"
          : "default";

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8 max-w-5xl">
        <div className="pb-4 border-b border-border">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your learning data, sync status, and account preferences.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-xs flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="grid gap-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Appearance &amp; Theme</CardTitle>
              <CardDescription>Customize how AI Engineer OS renders on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              {mounted ? (
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {[
                    { id: "dark", label: "Dark Theme", Icon: Moon },
                    { id: "light", label: "Light Theme", Icon: Sun },
                    { id: "system", label: "System Sync", Icon: Laptop },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setTheme(id as "dark" | "light" | "system")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        theme === id
                          ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan ring-1 ring-accent-cyan"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-20" />
              )}
            </CardContent>
          </Card>

          {/* Account */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Account</CardTitle>
                  <CardDescription>
                    Sign in to access all features and sync your learning progress.
                  </CardDescription>
                </div>
                <Badge variant={profileAuthenticated ? "success" : "muted"}>
                  {profileAuthenticated ? "Authenticated" : "Not Signed In"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Display Name
                  </label>
                  <Input
                    readOnly
                    value={
                      authStatus.user?.name ??
                      authStatus.user?.email ??
                      (profileAuthenticated ? "Authenticated learner" : "Guest Learner")
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Device ID</label>
                  <Input
                    readOnly
                    data-testid="device-id"
                    value={deviceId ? `${shortenDeviceId(deviceId)}…` : "Loading…"}
                  />
                </div>
              </div>

              {!profileAuthenticated ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    data-testid="sign-in-github"
                    disabled={!authStatus.configured || !authStatus.providers.includes("github") || busy}
                    onClick={() => void handleSignIn("github")}
                  >
                    <GitBranch className="w-4 h-4" /> Sign in with GitHub
                  </Button>
                  <Button
                    variant="outline"
                    data-testid="sign-in-google"
                    disabled={!authStatus.configured || !authStatus.providers.includes("google") || busy}
                    onClick={() => void handleSignIn("google")}
                  >
                    <Globe className="w-4 h-4" /> Sign in with Google
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-xs text-muted-foreground">Signed in as:</span>
                    <span className="text-xs font-semibold text-foreground">
                      {authStatus.user?.email || authStatus.user?.name || "User"}
                    </span>
                  </div>
                  <Button variant="outline" onClick={() => void handleSignOut()} disabled={busy}>
                    <LogOut className="w-4 h-4" /> Sign out
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDeleteCloudAccount()}
                    disabled={busy}
                    data-testid="delete-cloud-account"
                  >
                    Delete cloud account and learning data
                  </Button>
                </div>
              )}

              {!authStatus.configured && (
                <p
                  data-testid="auth-config-hint"
                  className="text-xs text-muted-foreground rounded-lg border border-border bg-surface p-3"
                >
                  {authStatus.developmentHint ??
                    "OAuth is not configured. Set AUTH_SECRET plus GitHub and/or Google client credentials to enable sign-in."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Merge summary */}
          {mergeSummary && (
            <Card data-testid="merge-summary">
              <CardHeader>
                <CardTitle className="text-lg">Cloud merge complete</CardTitle>
                <CardDescription>
                  Your guest progress was kept and merged with your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <h4 className="font-semibold text-foreground">Synced from this device</h4>
                  <p>Lessons: {mergeSummary.localUploaded.lessonProgress}</p>
                  <p>Resources: {mergeSummary.localUploaded.resourceProgress}</p>
                  <p>Notes: {mergeSummary.localUploaded.notes}</p>
                  <p>Bookmarks: {mergeSummary.localUploaded.bookmarks}</p>
                  <p>Study sessions: {mergeSummary.localUploaded.studySessions}</p>
                  <p>Quiz attempts: {mergeSummary.localUploaded.quizAttempts}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-foreground">Cloud records preserved</h4>
                  <p>Lessons: {mergeSummary.cloudPreserved.lessonProgress}</p>
                  <p>Notes: {mergeSummary.cloudPreserved.notes}</p>
                  <p>Bookmarks: {mergeSummary.cloudPreserved.bookmarks}</p>
                  <p>Study sessions: {mergeSummary.cloudPreserved.studySessions}</p>
                  <p>Quiz attempts: {mergeSummary.cloudPreserved.quizAttempts}</p>
                  {mergeSummary.conflicts > 0 && (
                    <p className="text-status-warning">
                      Conflicts preserved: {mergeSummary.conflicts}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sync */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Sync</CardTitle>
                  <CardDescription>
                    {profileAuthenticated
                      ? "Your learning data is synchronized with your account."
                      : "Your progress is stored on this device."}
                  </CardDescription>
                </div>
                <Badge variant={syncBadgeVariant} className="gap-1" data-testid="sync-status-badge">
                  {status === "synced" ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <Cloud className="w-3 h-3" />
                  )}
                  {status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <span className="text-xs text-muted-foreground">Device</span>
                  <p className="font-mono text-xs text-foreground pt-1">
                    {deviceId ? shortenDeviceId(deviceId) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <span className="text-xs text-muted-foreground">Last successful sync</span>
                  <p className="text-xs text-foreground pt-1" data-testid="last-sync">
                    {formatTime(lastSuccessfulSync)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <span className="text-xs text-muted-foreground">Pending mutations</span>
                  <p className="text-xs text-foreground pt-1" data-testid="pending-mutations">
                    {pendingCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <span className="text-xs text-muted-foreground">Conflicts</span>
                  <p className="text-xs text-foreground pt-1" data-testid="conflict-count">
                    {conflictCount}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid="sync-now"
                  onClick={() => void syncNow()}
                >
                  <RefreshCw className="w-4 h-4" /> Sync now
                </Button>
              </div>

              {!profileAuthenticated && (
                <p className="text-xs text-muted-foreground">
                  Offline changes are queued on this device and will upload after you sign in.
                </p>
              )}

              {conflicts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground">Unresolved conflicts</h4>
                  {conflicts.map((conflict) => {
                    const remote = conflict.remoteData as { content?: string } | null;
                    const local = conflict.localData as { content?: string } | null;
                    return (
                      <div
                        key={conflict.id}
                        className="rounded-lg border border-status-warning/40 bg-status-warning/5 p-3 space-y-2"
                        data-testid="conflict-item"
                      >
                        <p className="text-xs text-muted-foreground">
                          {conflict.entityType} · {conflict.entityId.slice(0, 8)}
                        </p>
                        <div className="grid sm:grid-cols-2 gap-2 text-xs">
                          <p className="text-foreground">
                            <span className="font-semibold">Local: </span>
                            {(local?.content ?? "—").slice(0, 120)}
                          </p>
                          <p className="text-foreground">
                            <span className="font-semibold">Cloud: </span>
                            {(remote?.content ?? "—").slice(0, 120)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void resolveConflict(conflict.id, "keep_local")}
                          >
                            Keep local
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void resolveConflict(conflict.id, "keep_remote")}
                          >
                            Keep cloud
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void resolveConflict(conflict.id, "manual_merge", {
                                ...(conflict.localData as Record<string, unknown>),
                                content: `${local?.content ?? ""}\n\n---\n\n${remote?.content ?? ""}`,
                              })
                            }
                          >
                            Merge both
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Data</CardTitle>
                  <CardDescription>Export, import, and reset your local learning data.</CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <HardDrive className="w-3 h-3" /> {formatBytes(storageBytes)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-surface border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-accent-cyan" />
                    <div>
                      <h4 className="text-sm font-medium">Export Progress</h4>
                      <p className="text-xs text-muted-foreground">
                        Versioned JSON backup of all local learning data
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => void handleExport()}
                    disabled={busy}
                    variant="default"
                    className="gap-2"
                    data-testid="export-progress"
                  >
                    Export
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5 text-accent-violet" />
                    <div>
                      <h4 className="text-sm font-medium">Import Backup</h4>
                      <p className="text-xs text-muted-foreground">
                        Validate a JSON export, then merge or replace local data
                      </p>
                    </div>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="sr-only"
                      data-testid="import-file-input"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleImportFile(file);
                      }}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy}
                      variant="outline"
                      className="gap-2"
                      data-testid="import-choose-file"
                    >
                      Choose File
                    </Button>
                  </div>
                </div>

                {importPreviewState && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border mt-3 space-y-2">
                    <h4 className="text-sm font-medium">Import Preview</h4>
                    {!importPreviewState.valid ? (
                      <div className="text-xs text-status-error">
                        {importPreviewState.errors.join("; ")}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Schema v{importPreviewState.schemaVersion} · Exported{" "}
                          {formatTime(importPreviewState.exportedAt)}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>Lessons: {importPreviewState.counts.lessonProgress}</div>
                          <div>Resources: {importPreviewState.counts.resourceProgress}</div>
                          <div>Notes: {importPreviewState.counts.notes}</div>
                          <div>Bookmarks: {importPreviewState.counts.bookmarks}</div>
                          <div>Study sessions: {importPreviewState.counts.studySessions}</div>
                          <div>Quiz attempts: {importPreviewState.counts.quizAttempts}</div>
                          <div>Projects: {importPreviewState.counts.projectProgress}</div>
                          <div>Roadmap: {importPreviewState.counts.roadmapState}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            onClick={() => setImportMode("merge")}
                            variant={importMode === "merge" ? "default" : "outline"}
                            size="sm"
                          >
                            Merge
                          </Button>
                          <Button
                            onClick={() => setImportMode("replace")}
                            variant={importMode === "replace" ? "default" : "outline"}
                            size="sm"
                          >
                            Replace local data
                          </Button>
                          <Button
                            onClick={() => void handleImportApply()}
                            variant="secondary"
                            size="sm"
                            data-testid="import-apply"
                          >
                            Apply Import
                          </Button>
                          <Button
                            onClick={() => {
                              setImportPreviewState(null);
                              setImportFile(null);
                            }}
                            variant="ghost"
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h4 className="text-sm font-medium">Reset Local Data</h4>
                      <p className="text-xs text-muted-foreground">
                        Delete local learning progress but keep a backup snapshot
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => void handleReset()}
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    data-testid="reset-local-data"
                  >
                    Reset All
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Local storage: {formatBytes(storageBytes)} used by this browser origin.
              </p>

              {exportNotice && (
                <div className="p-3 rounded-lg bg-status-success/15 border border-status-success/30 text-status-success text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Export downloaded successfully.
                </div>
              )}
              {importNotice && (
                <div className="p-3 rounded-lg bg-status-success/15 border border-status-success/30 text-status-success text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {importNotice}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Privacy</CardTitle>
              <CardDescription>Understand how your learning data is handled.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-surface border border-border">
                <h4 className="text-sm font-semibold text-foreground">Data Privacy</h4>
                <p className="text-xs text-muted-foreground">
                  Your learning data is synchronized to PostgreSQL so it survives device changes.
                  OAuth tokens are never stored in IndexedDB. Your data is private to your account.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <h4 className="text-sm font-semibold text-foreground">Device Identity</h4>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  Device ID: {deviceId ?? "Not available"}
                </p>
                <p className="text-xs text-muted-foreground">
                  A random UUID is generated on first use for sync provenance and deduplication.
                  No hardware, browser, IP, or screen fingerprinting is used.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
