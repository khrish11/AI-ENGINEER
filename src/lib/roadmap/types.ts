import { z } from "zod";

export const TRACK_IDS = [
  "general-ai",
  "llm-app",
  "rag",
  "agent",
  "ml",
  "mlops",
  "research",
] as const;

export type TrackId = (typeof TRACK_IDS)[number];

export const IMPORTANCE_LEVELS = ["core", "important", "optional", "skip"] as const;
export type Importance = (typeof IMPORTANCE_LEVELS)[number];

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const BUFFER_PREFERENCES = ["none", "monthly", "manual"] as const;
export type BufferPreference = (typeof BUFFER_PREFERENCES)[number];

export const ImportanceSchema = z.enum(IMPORTANCE_LEVELS);
export const DifficultySchema = z.enum(DIFFICULTIES);
export const BufferPreferenceSchema = z.enum(BUFFER_PREFERENCES);
export const TrackIdSchema = z.enum(TRACK_IDS);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  group: z.string().min(1),
  description: z.string().optional(),
  match: z.array(z.string().min(1)).default([]),
});

export const SkillGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const SkillTaxonomySchema = z.object({
  version: z.literal(1),
  groups: z.array(SkillGroupSchema).min(1),
  skills: z.array(SkillSchema).min(1),
});

export const TrackSchema = z.object({
  id: TrackIdSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  targetRoles: z.array(z.string().min(1)).min(1),
  coreSkills: z.array(z.string().min(1)).min(1),
  phaseImportance: z.record(z.string(), ImportanceSchema),
  overrides: z.record(z.string(), ImportanceSchema).default({}),
  phaseRationale: z.record(z.string(), z.string()).default({}),
  majorProjects: z.array(z.string().min(1)).default([]),
});

export const GraphConfigSchema = z.object({
  version: z.literal(1),
  description: z.string().optional(),
  durationFallbacks: z.object({
    beginner: z.number().int().positive(),
    intermediate: z.number().int().positive(),
    advanced: z.number().int().positive(),
    project: z.number().int().positive(),
  }),
  projectKeywords: z.array(z.string().min(1)).default([]),
  phaseSkills: z.record(z.string(), z.array(z.string())).default({}),
  phasePrerequisites: z.record(z.string(), z.array(z.string())).default({}),
  extraEdges: z.record(z.string(), z.array(z.string())).default({}),
  occurrenceOverrides: z
    .record(
      z.string(),
      z.object({
        skills: z.array(z.string()).optional(),
        projectRelevant: z.boolean().optional(),
        estimatedMinutes: z.number().int().positive().optional(),
        difficulty: DifficultySchema.optional(),
      })
    )
    .default({}),
});

export const OccurrenceMetadataSchema = z.object({
  occurrenceId: z.string().min(1),
  canonicalLessonKey: z.string().min(1),
  phaseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
  title: z.string().min(1),
  difficulty: DifficultySchema,
  estimatedMinutes: z.number().int().positive().nullable(),
  estimateSource: z.enum(["upstream", "fallback"]),
  skillTags: z.array(z.string()),
  projectRelevant: z.boolean(),
  importance: z.record(TrackIdSchema, ImportanceSchema),
  prerequisites: z.array(z.string()),
  recommendedBefore: z.array(z.string()).default([]),
  isAlias: z.boolean().default(false),
});

export const LessonMetadataFileSchema = z.object({
  version: z.literal(1),
  generatedFrom: z.object({
    phases: z.number().int(),
    canonicalLessons: z.number().int(),
    occurrences: z.number().int(),
    activeCommit: z.string().nullable(),
  }),
  occurrences: z.array(OccurrenceMetadataSchema),
});

export type Skill = z.infer<typeof SkillSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type SkillTaxonomy = z.infer<typeof SkillTaxonomySchema>;
export type Track = z.infer<typeof TrackSchema>;
export type GraphConfig = z.infer<typeof GraphConfigSchema>;
export type OccurrenceMetadata = z.infer<typeof OccurrenceMetadataSchema>;
export type LessonMetadataFile = z.infer<typeof LessonMetadataFileSchema>;

// ---------------------------------------------------------------------------
// Learner profile and onboarding
// ---------------------------------------------------------------------------

export const BACKGROUNDS = [
  "cs-student",
  "software-engineer",
  "ml-data",
  "self-taught",
  "researcher",
  "other",
] as const;
export type Background = (typeof BACKGROUNDS)[number];

export const PROFICIENCY_LEVELS = ["none", "basic", "comfortable", "strong"] as const;
export type Proficiency = (typeof PROFICIENCY_LEVELS)[number];

export const PROGRAMMING_SKILLS = ["python", "javascript", "git", "linux", "sql", "docker"] as const;
export type ProgrammingSkill = (typeof PROGRAMMING_SKILLS)[number];

export const MATH_SKILLS = ["linear-algebra", "calculus", "probability", "statistics"] as const;
export type MathSkill = (typeof MATH_SKILLS)[number];

export const MATH_LEVELS = ["weak", "okay", "comfortable", "strong"] as const;
export type MathLevel = (typeof MATH_LEVELS)[number];
export const MathLevelSchema = z.enum(MATH_LEVELS);

export const AI_SKILLS = [
  "classical-ml",
  "neural-networks",
  "pytorch",
  "transformers",
  "llm-applications",
  "rag",
  "agents",
  "deployment",
] as const;
export type AiSkill = (typeof AI_SKILLS)[number];

export const SkillLevelSchema = z.enum(PROFICIENCY_LEVELS);

export const LearnerProfileSchema = z.object({
  background: z.enum(BACKGROUNDS),
  programming: z.record(z.enum(PROGRAMMING_SKILLS), SkillLevelSchema),
  math: z.record(z.enum(MATH_SKILLS), MathLevelSchema),
  ai: z.record(z.enum(AI_SKILLS), SkillLevelSchema),
  knownTopicSkillIds: z.array(z.string()).default([]),
  goalTrackId: TrackIdSchema,
  updatedAt: z.string(),
});

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;

export const PlacementResultSchema = z.object({
  recommendedStartPhaseSlug: z.string().min(1),
  recommendedStartPhaseTitle: z.string().min(1),
  reviewSkillIds: z.array(z.string()),
  reviewTopics: z.array(z.string()),
  skimOccurrenceIds: z.array(z.string()),
  estimatedMinutesSaved: z.number().int().nonnegative(),
  summary: z.string(),
  source: z.enum(["self-assessment", "quiz", "combined"]),
});

export type PlacementResult = z.infer<typeof PlacementResultSchema>;

// ---------------------------------------------------------------------------
// Generation settings and plan
// ---------------------------------------------------------------------------

export const RoadmapSettingsSchema = z.object({
  trackId: TrackIdSchema,
  availableHoursPerWeek: z.number().int().min(1).max(60),
  startDate: z.string().min(10),
  targetDate: z.string().min(10).nullable(),
  studyDays: z.array(z.number().int().min(0).max(6)).min(1),
  bufferPreference: BufferPreferenceSchema,
  includeOptionalTopics: z.boolean(),
  bufferWeeks: z.array(z.number().int().nonnegative()).default([]),
  manuallyIncluded: z.array(z.string()).default([]),
  manuallyExcluded: z.array(z.string()).default([]),
  manualWeekAssignments: z.record(z.string(), z.number().int().nonnegative()).default({}),
});

export type RoadmapSettings = z.infer<typeof RoadmapSettingsSchema>;

export const PlanItemSchema = z.object({
  occurrenceId: z.string().min(1),
  canonicalLessonKey: z.string().min(1),
  phaseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
  title: z.string().min(1),
  difficulty: DifficultySchema,
  importance: ImportanceSchema,
  minutes: z.number().int().positive(),
  allocatedMinutes: z.number().int().positive(),
  part: z.number().int().positive(),
  totalParts: z.number().int().positive(),
  dayOfWeek: z.number().int().min(0).max(6),
  prerequisites: z.array(z.string()),
  projectRelevant: z.boolean(),
  skillTags: z.array(z.string()),
});

export const RoadmapWeekSchema = z.object({
  index: z.number().int().nonnegative(),
  weekNumber: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string(),
  kind: z.enum(["study", "buffer"]),
  capacityMinutes: z.number().int().nonnegative(),
  scheduledMinutes: z.number().int().nonnegative(),
  items: z.array(PlanItemSchema),
  bufferReason: z.enum(["automatic", "manual", "holiday"]).nullable().optional(),
  label: z.string().nullable().optional(),
});

export const PlanSummarySchema = z.object({
  totalMinutes: z.number().int().nonnegative(),
  scheduledMinutes: z.number().int().nonnegative(),
  remainingMinutes: z.number().int().nonnegative(),
  totalOccurrences: z.number().int().nonnegative(),
  scheduledOccurrences: z.number().int().nonnegative(),
  completedOccurrences: z.number().int().nonnegative(),
  coreTotal: z.number().int().nonnegative(),
  coreCompleted: z.number().int().nonnegative(),
  optionalMinutesExcluded: z.number().int().nonnegative(),
  skippedOccurrences: z.number().int().nonnegative(),
});

export const RoadmapPlanSchema = z.object({
  version: z.literal(1),
  trackId: TrackIdSchema,
  startDate: z.string(),
  targetDate: z.string().nullable(),
  hoursPerWeek: z.number().int().positive(),
  studyDays: z.array(z.number().int().min(0).max(6)),
  bufferWeeks: z.array(z.number().int().nonnegative()),
  weeks: z.array(RoadmapWeekSchema),
  completedOccurrenceIds: z.array(z.string()),
  skipped: z.array(
    z.object({
      occurrenceId: z.string(),
      importance: ImportanceSchema,
      reason: z.string(),
    })
  ),
  summary: PlanSummarySchema,
});

export type PlanItem = z.infer<typeof PlanItemSchema>;
export type RoadmapWeek = z.infer<typeof RoadmapWeekSchema>;
export type PlanSummary = z.infer<typeof PlanSummarySchema>;
export type RoadmapPlan = z.infer<typeof RoadmapPlanSchema>;

export const RoadmapStoreSchema = z.object({
  version: z.literal(1),
  profile: LearnerProfileSchema.nullable(),
  settings: RoadmapSettingsSchema.nullable(),
  plan: RoadmapPlanSchema.nullable(),
  overrides: z.object({
    included: z.array(z.string()),
    excluded: z.array(z.string()),
    manualWeeks: z.record(z.string(), z.number().int().nonnegative()),
    deferred: z.array(z.string()),
    dropped: z.array(z.string()),
  }),
  placement: PlacementResultSchema.nullable(),
  history: z.array(
    z.object({
      at: z.string(),
      action: z.string(),
      summary: z.string(),
    })
  ),
});

export type RoadmapStore = z.infer<typeof RoadmapStoreSchema>;

// ---------------------------------------------------------------------------
// Capacity, scheduling and rescheduling
// ---------------------------------------------------------------------------

export const FeasibilitySchema = z.enum(["comfortable", "achievable", "tight", "unrealistic"]);
export type Feasibility = z.infer<typeof FeasibilitySchema>;

export interface CapacityAnalysis {
  requiredMinutes: number;
  availableMinutes: number;
  differenceMinutes: number;
  feasibility: Feasibility;
  studyWeeks: number;
  weeklyMinutes: number;
  requiredWeeks: number;
  options: string[];
  shortfallMinutes: number;
}

export interface SchedulerInput {
  trackId: TrackId;
  startDate: string;
  targetDate: string | null;
  availableHoursPerWeek: number;
  studyDays: number[];
  bufferPreference: BufferPreference;
  manualBufferWeeks?: number[];
  includeOptionalTopics?: boolean;
  completedCanonicalLessonKeys?: string[];
  masteredCanonicalLessonKeys?: string[];
  manuallyIncluded?: string[];
  manuallyExcluded?: string[];
  manualWeekAssignments?: Record<string, number>;
  maxWeeks?: number;
}

export interface ScheduledOccurrence {
  occurrenceId: string;
  canonicalLessonKey: string;
  phaseSlug: string;
  lessonSlug: string;
  title: string;
  difficulty: Difficulty;
  importance: Importance;
  minutes: number;
  prerequisites: string[];
  projectRelevant: boolean;
  skillTags: string[];
}

export interface RescheduleInput {
  plan: RoadmapPlan;
  settings: RoadmapSettings;
  today: string;
  completedCanonicalLessonKeys: string[];
  masteredCanonicalLessonKeys?: string[];
  hoursPerWeek?: number;
  targetDate?: string | null;
  studyDays?: number[];
  droppedOccurrenceIds?: string[];
  bufferPreference?: BufferPreference;
}

export interface RescheduleResult {
  plan: RoadmapPlan;
  backlog: ScheduledOccurrence[];
  preservedWeeks: number;
  movedItems: number;
  projectedEndDate: string | null;
  previousEndDate: string | null;
  summary: string;
}

export interface TrackComparison {
  trackA: TrackId;
  trackB: TrackId;
  sharedCoreOccurrenceIds: string[];
  uniqueCoreA: string[];
  uniqueCoreB: string[];
  additionalHoursB: number;
  sharedHours: number;
  projectDifference: string[];
}
