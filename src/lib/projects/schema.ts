import { z } from "zod";

/** Project levels map to effort and scope tiers, not rigid hour ranges. */
export const PROJECT_LEVELS = ["beginner", "intermediate", "advanced", "capstone"] as const;
export type ProjectLevel = (typeof PROJECT_LEVELS)[number];

/** Where a project definition came from (attribution-safe). */
export const PROJECT_SOURCES = ["upstream", "platform", "community"] as const;
export type ProjectSource = (typeof PROJECT_SOURCES)[number];

export const PROJECT_STATUSES = ["active", "draft", "deprecated"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** §7 — supported deliverable kinds. Not every project needs every kind. */
export const DELIVERABLE_KINDS = [
  "github_repo",
  "source_code",
  "readme",
  "architecture_diagram",
  "test_results",
  "evaluation_results",
  "deployment_url",
  "api_documentation",
  "notebook",
  "benchmark_report",
  "demo_video",
  "reflection",
  "other",
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

/** §8 — evidence learners attach. `self` evidence is never labelled verified. */
export const EVIDENCE_KINDS = [
  "github_repo_url",
  "pull_request_url",
  "commit_url",
  "deployment_url",
  "documentation_url",
  "screenshot",
  "markdown_reflection",
  "evaluation_result",
  "test_result",
  "benchmark_report",
  "notebook",
  "repository_directory",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EvidenceRequirementSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  kind: z.enum(EVIDENCE_KINDS),
  description: z.string().min(1),
  /** Milestone-level requirement (checked when that milestone completes) or project-level. */
  required: z.boolean().default(true),
});
export type EvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;

export const DeliverableSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  kind: z.enum(DELIVERABLE_KINDS),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
});
export type Deliverable = z.infer<typeof DeliverableSchema>;

export const MilestoneSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  objective: z.string().min(1),
  expectedOutput: z.string().min(1),
  requiredEvidence: z.array(z.string().min(1)).default([]),
  estimatedMinutes: z.number().int().positive(),
  required: z.boolean().default(true),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

/** §12 — rubric category. Weights must total 100 across categories. */
export const RubricCategorySchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  category: z.string().min(1),
  weight: z.number().int().min(1).max(100),
  criteria: z.array(z.string().min(1)).min(1),
  minimumExpectation: z.string().min(1),
  excellentExpectation: z.string().min(1),
});
export type RubricCategory = z.infer<typeof RubricCategorySchema>;

export const RubricSchema = z
  .object({
    categories: z.array(RubricCategorySchema).min(2).max(10),
    /** Minimum self-assessed total (out of 100) treated as "completed" evidence. */
    completionThreshold: z.number().int().min(0).max(100).default(60),
    /** Minimum self-assessed total treated as mastery evidence (§15). */
    masteryThreshold: z.number().int().min(0).max(100).default(75),
  })
  .superRefine((rubric, ctx) => {
    const total = rubric.categories.reduce((sum, category) => sum + category.weight, 0);
    if (total !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categories"],
        message: `Rubric weights must total 100 (got ${total}).`,
      });
    }
    const ids = new Set<string>();
    for (const category of rubric.categories) {
      if (ids.has(category.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categories"],
          message: `Duplicate rubric category id: ${category.id}.`,
        });
      }
      ids.add(category.id);
    }
  });
export type Rubric = z.infer<typeof RubricSchema>;

export const ProjectDefinitionSchema = z
  .object({
    id: z.string().min(1).regex(/^proj-[a-z0-9-]+$/),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    description: z.string().min(20),
    level: z.enum(PROJECT_LEVELS),
    source: z.enum(PROJECT_SOURCES),
    /** Required attribution/source URL for upstream + community projects. */
    sourceUrl: z.string().url().optional(),
    estimatedHours: z.number().min(0.5).max(120),
    /** Curriculum phases this project belongs to (canonical phase slugs, e.g. "03-deep-learning"). */
    phaseSlugs: z.array(z.string().min(1)).min(1),
    /** Roadmap occurrences this project exercises (see docs/ROADMAP_ENGINE.md §2). */
    associatedOccurrences: z.array(z.string().min(1)).min(1),
    associatedCanonicalLessons: z.array(z.string().min(1)).default([]),
    /** Skill IDs from roadmaps/skills/taxonomy.json. */
    skills: z.array(z.string().min(1)).min(1),
    prerequisites: z.array(z.string().min(1)).default([]),
    learningObjectives: z.array(z.string().min(1)).min(1),
    deliverables: z.array(DeliverableSchema).min(1),
    milestones: z.array(MilestoneSchema).min(1),
    /** Optional for beginner projects; required for intermediate and above. */
    rubric: RubricSchema.optional(),
    suggestedStack: z.array(z.string()).default([]),
    starterRepo: z.string().url().optional(),
    referenceResources: z.array(z.string().url()).default([]),
    /** §17 build guide: suggested architecture, constraints, implementation hints. */
    buildGuide: z
      .object({
        architecture: z.array(z.string().min(1)).min(1),
        constraints: z.array(z.string().min(1)).default([]),
        hints: z.array(z.string().min(1)).default([]),
      })
      .optional(),
    requiredEvidence: z.array(EvidenceRequirementSchema).default([]),
    status: z.enum(PROJECT_STATUSES).default("active"),
    /** §16: deterministic track relevance (track ids from roadmaps/tracks). */
    relevantTracks: z.array(z.string().min(1)).default([]),
    /** True when a project ships a bundled starter template (see projects/templates). */
    hasStarterTemplate: z.boolean().default(false),
  })
  .superRefine((project, ctx) => {
    const milestoneIds = new Set<string>();
    for (const milestone of project.milestones) {
      if (milestoneIds.has(milestone.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["milestones"],
          message: `Duplicate milestone id: ${milestone.id}.`,
        });
      }
      milestoneIds.add(milestone.id);
    }
    // Every milestone evidence reference must point at a project-level evidence requirement.
    for (const milestone of project.milestones) {
      for (const evidenceId of milestone.requiredEvidence) {
        if (!project.requiredEvidence.some((requirement) => requirement.id === evidenceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["milestones"],
            message: `Milestone ${milestone.id} references unknown evidence id: ${evidenceId}.`,
          });
        }
      }
    }
    // Intermediate and above always carry a rubric.
    if (project.level !== "beginner" && !project.rubric) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rubric"],
        message: `Non-beginner projects must include a rubric.`,
      });
    }
    if (!project.rubric && project.level === "beginner" && project.milestones.some((m) => m.required)) {
      // Allowed: beginners grade via milestones + evidence only.
    }
  });
export type ProjectDefinition = z.infer<typeof ProjectDefinitionSchema>;

export const PHASE_19_SLUG = "19-capstone-projects";
