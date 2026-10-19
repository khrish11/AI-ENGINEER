import { z } from "zod";

/**
 * §24/§26 — everything in a portfolio is PRIVATE by default. Publication is
 * explicit configuration, never derived from mere existence of data: an
 * unlisted project or a skill with evidence is not public until the learner
 * selects it here.
 */

export const PortfolioVisibilityKeySchema = z.enum([
  "careerTrack",
  "skills",
  "projects",
  "achievements",
  "curriculumProgress",
  "studyTime",
  "assessments",
]);
export type PortfolioVisibilityKey = z.infer<typeof PortfolioVisibilityKeySchema>;

/** §24 — every key defaults to false (private). */
export const PublicVisibilitySchema = z.object({
  careerTrack: z.boolean().default(false),
  skills: z.boolean().default(false),
  projects: z.boolean().default(false),
  achievements: z.boolean().default(false),
  curriculumProgress: z.boolean().default(false),
  studyTime: z.boolean().default(false),
  assessments: z.boolean().default(false),
}).strict();

export type PortfolioVisibility = z.infer<typeof PublicVisibilitySchema>;

export function defaultVisibility(): PortfolioVisibility {
  return {
    careerTrack: false,
    skills: false,
    projects: false,
    achievements: false,
    curriculumProgress: false,
    studyTime: false,
    assessments: false,
  };
}

/** §28 — self-assessed rubric scores are shown only when explicitly exposed. */
export const VisibilitySchema = z
  .object({
    careerTrack: z.boolean(),
    skills: z.boolean(),
    projects: z.boolean(),
    achievements: z.boolean(),
    curriculumProgress: z.boolean(),
    studyTime: z.boolean(),
    assessments: z.boolean(),
    /** Learner explicitly chooses to expose self-assessed rubric totals. */
    exposeSelfAssessment: z.boolean(),
    /** Learner explicitly chooses to expose repo/demo links on published projects. */
    exposeProjectLinks: z.boolean(),
  })
  .strict();

export interface PortfolioSettingsPublic {
  portfolioEnabled: boolean;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  visibility: PortfolioVisibility;
  publicProjectIds: string[];
  publicEvidenceIds: string[];
  publicAchievementIds: string[];
  publicSkillIds: string[];
  showSelfAssessment: boolean;
  showProjectLinks: boolean;
  published: boolean;
  updatedAt: string | null;
}

export interface PortfolioSettings extends PortfolioSettingsPublic {
  careerTrackId: string | null;
}

/**
 * §26 — the stored publication configuration. `publicity` jsonb in
 * portfolio_profiles holds everything except slug/display name/bio/published.
 */
export const PublicityJsonSchema = z
  .object({
    visibility: VisibilitySchema,
    publicProjectIds: z.array(z.string().min(1)).max(50).default([]),
    publicEvidenceIds: z.array(z.string().min(1)).max(200).default([]),
    publicAchievementIds: z.array(z.string().min(1)).max(50).default([]),
    publicSkillIds: z.array(z.string().min(1)).max(200).default([]),
    careerTrackId: z.string().nullable().default(null),
  })
  .strict();

export type PublicityJson = z.infer<typeof PublicityJsonSchema>;

export function defaultPublicity(): PublicityJson {
  return {
    visibility: {
      careerTrack: false,
      skills: false,
      projects: false,
      achievements: false,
      curriculumProgress: false,
      studyTime: false,
      assessments: false,
      exposeSelfAssessment: false,
      exposeProjectLinks: false,
    },
    publicProjectIds: [],
    publicEvidenceIds: [],
    publicAchievementIds: [],
    publicSkillIds: [],
    careerTrackId: null,
  };
}

export interface PortfolioPutRequest {
  portfolioEnabled?: boolean;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  visibility?: PortfolioVisibility;
  publicProjectIds?: string[];
  publicEvidenceIds?: string[];
  publicAchievementIds?: string[];
  publicSkillIds?: string[];
  careerTrackId?: string | null;
  published?: boolean;
}

export const SLUG_MAX_LENGTH = 40;
export const SLUG_MIN_LENGTH = 3;
