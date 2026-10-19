import { db, type PortfolioDraft } from "@/lib/progress/db";
import { bumpRevision, createBase, nowIso } from "@/lib/progress/records";
import type { PortfolioSettings } from "./types";
import { defaultVisibility } from "./types";

/**
 * §37/§34 — guests keep portfolio settings as a local draft (Dexie, single
 * record). No sync engine changes: drafts do not join the Phase 4 mutation
 * queue because guest drafts are device-local previews only.
 */
const DRAFT_ID = "local-portfolio-draft";

export const LocalPortfolioDraft = {
  async load(): Promise<PortfolioSettings | null> {
    const row: PortfolioDraft | undefined = await db.portfolioDraft.get(DRAFT_ID);
    if (!row) return null;
    const draft = row.draft as Partial<PortfolioSettings> | null;
    if (!draft) return null;
    return {
      portfolioEnabled: false,
      username: draft.username ?? null,
      displayName: draft.displayName ?? null,
      bio: draft.bio ?? null,
      careerTrackId: draft.careerTrackId ?? null,
      visibility: { ...defaultVisibility(), ...(draft.visibility ?? {}) },
      publicProjectIds: draft.publicProjectIds ?? [],
      publicEvidenceIds: draft.publicEvidenceIds ?? [],
      publicAchievementIds: draft.publicAchievementIds ?? [],
      publicSkillIds: draft.publicSkillIds ?? [],
      published: false,
      showSelfAssessment: draft.showSelfAssessment ?? false,
      showProjectLinks: draft.showProjectLinks ?? false,
      updatedAt: row.updatedAt,
    };
  },

  async save(settings: PortfolioSettings): Promise<void> {
    const existing = await db.portfolioDraft.get(DRAFT_ID);
    const row: PortfolioDraft = {
      ...(existing ?? createBase()),
      ...(existing ? bumpRevision(existing.localRevision) : {}),
      syncStatus: existing?.syncStatus ?? "pending",
      id: DRAFT_ID,
      draft: settings,
    } as PortfolioDraft;
    row.updatedAt = nowIso();
    await db.portfolioDraft.put(row);
  },
};
