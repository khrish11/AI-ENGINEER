export type ResourceLifecycle = "not_started" | "started" | "completed";
export type GithubResourceState = "opened" | "explored" | "completed_exercise";

const LIFECYCLE_RANK: Record<ResourceLifecycle, number> = {
  not_started: 0,
  started: 1,
  completed: 2,
};

const GITHUB_RANK: Record<GithubResourceState, number> = {
  opened: 0,
  explored: 1,
  completed_exercise: 2,
};

export function resourceLifecycle(started: boolean, completed: boolean): ResourceLifecycle {
  if (completed) return "completed";
  if (started) return "started";
  return "not_started";
}

export function monotonicResourceLifecycle(
  current: ResourceLifecycle,
  candidate: ResourceLifecycle
): ResourceLifecycle {
  return LIFECYCLE_RANK[candidate] > LIFECYCLE_RANK[current] ? candidate : current;
}

export function mergeResourceProgress(a: {
  started: boolean;
  completed: boolean;
  githubState?: GithubResourceState | null;
  lastOpenedAt?: string | null;
  completedAt?: string | null;
}, b: {
  started: boolean;
  completed: boolean;
  githubState?: GithubResourceState | null;
  lastOpenedAt?: string | null;
  completedAt?: string | null;
}) {
  const lifecycle = monotonicResourceLifecycle(
    resourceLifecycle(a.started, a.completed),
    resourceLifecycle(b.started, b.completed)
  );
  return {
    started: lifecycle !== "not_started",
    completed: lifecycle === "completed",
    githubState: mergeGithubState(a.githubState ?? null, b.githubState ?? null),
    lastOpenedAt: laterTimestamp(a.lastOpenedAt ?? null, b.lastOpenedAt ?? null),
    completedAt:
      lifecycle === "completed"
        ? earlierTimestamp(a.completedAt ?? null, b.completedAt ?? null)
        : null,
  };
}

export function mergeGithubState(
  a: GithubResourceState | null,
  b: GithubResourceState | null
): GithubResourceState | null {
  if (!a) return b;
  if (!b) return a;
  return GITHUB_RANK[b] > GITHUB_RANK[a] ? b : a;
}

export function openingRepositoryDoesNotComplete(): boolean {
  return resourceLifecycle(true, false) !== "completed";
}

function laterTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function earlierTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
