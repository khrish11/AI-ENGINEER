import type {
  EditorialStatus,
  ResourceRole,
  ResourceType,
  VerificationStatus,
} from "./types";

/**
 * Pure coverage analysis for the resource registry.
 *
 * The function is DB-agnostic so it can be unit tested directly and reused by
 * `npm run resources:coverage`.
 */

export interface CoverageLesson {
  lessonId: string;
  phaseSlug: string;
  phaseNumber: number;
  title: string;
}

export interface CoverageMapping {
  lessonId: string;
  resourceType: ResourceType;
  resourceRole: ResourceRole;
  verificationStatus: VerificationStatus;
  editorialStatus: EditorialStatus;
}

export interface PhaseCoverage {
  phaseSlug: string;
  phaseNumber: number;
  totalLessons: number;
  lessonsWithResources: number;
  lessonsWithoutResources: number;
  lessonsWithoutVideo: number;
  lessonsWithoutPractical: number;
  lessonsWithoutPrimary: number;
  lessonsWithoutReference: number;
  totalResources: number;
  coveragePct: number;
  byType: Partial<Record<ResourceType, number>>;
}

export interface CoverageReport {
  generatedAt: string;
  totalLessons: number;
  lessonsWithResources: number;
  lessonsWithoutResources: number;
  lessonsWithoutVideo: number;
  lessonsWithoutPractical: number;
  lessonsWithoutPrimary: number;
  lessonsWithoutReference: number;
  coveragePct: number;
  totalResources: number;
  uniqueResources: number;
  byType: Partial<Record<ResourceType, number>>;
  verification: Record<VerificationStatus, number>;
  editorial: Record<EditorialStatus, number>;
  coverageByPhase: PhaseCoverage[];
  lessonsWithoutResources_list: { phaseSlug: string; title: string }[];
}

const VIDEO_TYPES: ReadonlySet<ResourceType> = new Set([
  "youtube_video",
  "youtube_playlist",
]);

const PRACTICAL_TYPES: ReadonlySet<ResourceType> = new Set([
  "github_repo",
  "project_starter",
  "interactive_lab",
]);

const REFERENCE_TYPES: ReadonlySet<ResourceType> = new Set([
  "official_documentation",
  "research_paper",
  "book",
]);

export function isVideoResource(type: ResourceType, role?: ResourceRole): boolean {
  if (VIDEO_TYPES.has(type)) return true;
  return role === "supplementary" && VIDEO_TYPES.has(type);
}

export function isPracticalResource(type: ResourceType, role: ResourceRole): boolean {
  return role === "practical" || PRACTICAL_TYPES.has(type);
}

export function isReferenceResource(type: ResourceType, role: ResourceRole): boolean {
  return role === "reference" || REFERENCE_TYPES.has(type);
}

function emptyVerification(): Record<VerificationStatus, number> {
  return {
    unverified: 0,
    reachable: 0,
    partially_verified: 0,
    verified: 0,
    unavailable: 0,
    regional: 0,
    unknown: 0,
  };
}

function emptyEditorial(): Record<EditorialStatus, number> {
  return { pending_review: 0, verified: 0, rejected: 0, deprecated: 0 };
}

export function computeCoverage(
  lessons: CoverageLesson[],
  mappings: CoverageMapping[]
): CoverageReport {
  const mappingsByLesson = new Map<string, CoverageMapping[]>();
  for (const mapping of mappings) {
    const bucket = mappingsByLesson.get(mapping.lessonId) ?? [];
    bucket.push(mapping);
    mappingsByLesson.set(mapping.lessonId, bucket);
  }

  const byType: Partial<Record<ResourceType, number>> = {};
  const verification = emptyVerification();
  const editorial = emptyEditorial();
  for (const m of mappings) {
    byType[m.resourceType] = (byType[m.resourceType] ?? 0) + 1;
    verification[m.verificationStatus] = (verification[m.verificationStatus] ?? 0) + 1;
    editorial[m.editorialStatus] = (editorial[m.editorialStatus] ?? 0) + 1;
  }

  const phaseMap = new Map<string, PhaseCoverage>();
  const lessonsWithoutResources_list: { phaseSlug: string; title: string }[] = [];

  let withResources = 0;
  let withoutVideo = 0;
  let withoutPractical = 0;
  let withoutPrimary = 0;
  let withoutReference = 0;

  for (const lesson of lessons) {
    const bucket = mappingsByLesson.get(lesson.lessonId) ?? [];
    const hasResources = bucket.length > 0;
    const hasVideo = bucket.some((m) => isVideoResource(m.resourceType, m.resourceRole));
    const hasPractical = bucket.some((m) => isPracticalResource(m.resourceType, m.resourceRole));
    const hasPrimary = bucket.some((m) => m.resourceRole === "primary");
    const hasReference = bucket.some((m) => isReferenceResource(m.resourceType, m.resourceRole));

    if (hasResources) withResources += 1;
    else lessonsWithoutResources_list.push({ phaseSlug: lesson.phaseSlug, title: lesson.title });
    if (!hasVideo) withoutVideo += 1;
    if (!hasPractical) withoutPractical += 1;
    if (!hasPrimary) withoutPrimary += 1;
    if (!hasReference) withoutReference += 1;

    const phase =
      phaseMap.get(lesson.phaseSlug) ??
      ({
        phaseSlug: lesson.phaseSlug,
        phaseNumber: lesson.phaseNumber,
        totalLessons: 0,
        lessonsWithResources: 0,
        lessonsWithoutResources: 0,
        lessonsWithoutVideo: 0,
        lessonsWithoutPractical: 0,
        lessonsWithoutPrimary: 0,
        lessonsWithoutReference: 0,
        totalResources: bucket.length,
        coveragePct: 0,
        byType: {},
      } satisfies PhaseCoverage);

    phase.totalLessons += 1;
    phase.totalResources += bucket.length;
    if (hasResources) phase.lessonsWithResources += 1;
    else phase.lessonsWithoutResources += 1;
    if (!hasVideo) phase.lessonsWithoutVideo += 1;
    if (!hasPractical) phase.lessonsWithoutPractical += 1;
    if (!hasPrimary) phase.lessonsWithoutPrimary += 1;
    if (!hasReference) phase.lessonsWithoutReference += 1;
    for (const m of bucket) {
      phase.byType[m.resourceType] = (phase.byType[m.resourceType] ?? 0) + 1;
    }
    phaseMap.set(lesson.phaseSlug, phase);
  }

  const coverageByPhase = [...phaseMap.values()]
    .map((p) => ({
      ...p,
      coveragePct:
        p.totalLessons === 0
          ? 0
          : Math.round((p.lessonsWithResources / p.totalLessons) * 1000) / 10,
    }))
    .sort((a, b) => a.phaseNumber - b.phaseNumber);

  const uniqueResources = new Set(mappings.map((m) => `${m.resourceType}:${m.lessonId}`)).size;

  return {
    generatedAt: new Date().toISOString(),
    totalLessons: lessons.length,
    lessonsWithResources: withResources,
    lessonsWithoutResources: lessons.length - withResources,
    lessonsWithoutVideo: withoutVideo,
    lessonsWithoutPractical: withoutPractical,
    lessonsWithoutPrimary: withoutPrimary,
    lessonsWithoutReference: withoutReference,
    coveragePct:
      lessons.length === 0 ? 0 : Math.round((withResources / lessons.length) * 1000) / 10,
    totalResources: mappings.length,
    uniqueResources,
    byType,
    verification,
    editorial,
    coverageByPhase,
    lessonsWithoutResources_list,
  };
}
