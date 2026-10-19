import metadataJson from "../../../roadmaps/metadata/lesson-metadata.json";
import graphJson from "../../../roadmaps/metadata/graph.json";
import taxonomyJson from "../../../roadmaps/skills/taxonomy.json";
import generalAi from "../../../roadmaps/tracks/general-ai.json";
import llmApp from "../../../roadmaps/tracks/llm-app-engineer.json";
import rag from "../../../roadmaps/tracks/rag-engineer.json";
import agent from "../../../roadmaps/tracks/agent-engineer.json";
import ml from "../../../roadmaps/tracks/ml-engineer.json";
import mlops from "../../../roadmaps/tracks/mlops-engineer.json";
import research from "../../../roadmaps/tracks/research-ai-engineer.json";
import {
  GraphConfigSchema,
  LessonMetadataFileSchema,
  SkillTaxonomySchema,
  TrackSchema,
  type GraphConfig,
  type LessonMetadataFile,
  type OccurrenceMetadata,
  type Skill,
  type SkillTaxonomy,
  type Track,
  type TrackId,
} from "./types";

/**
 * Configuration is validated at module load. A malformed track file, an unknown
 * importance level, or an invalid metadata entry fails loudly instead of
 * producing a silently wrong schedule.
 */
export const lessonMetadata: LessonMetadataFile = LessonMetadataFileSchema.parse(metadataJson);
export const graphConfig: GraphConfig = GraphConfigSchema.parse(graphJson);
export const taxonomy: SkillTaxonomy = SkillTaxonomySchema.parse(taxonomyJson);

export const tracks: Track[] = [
  TrackSchema.parse(generalAi),
  TrackSchema.parse(llmApp),
  TrackSchema.parse(rag),
  TrackSchema.parse(agent),
  TrackSchema.parse(ml),
  TrackSchema.parse(mlops),
  TrackSchema.parse(research),
];

export const trackById: Record<TrackId, Track> = Object.fromEntries(
  tracks.map((track) => [track.id, track])
) as Record<TrackId, Track>;

export const occurrences: OccurrenceMetadata[] = lessonMetadata.occurrences;

export const occurrenceById: Map<string, OccurrenceMetadata> = new Map(
  occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence])
);

export const occurrenceIndex: Map<string, number> = new Map(
  occurrences.map((occurrence, index) => [occurrence.occurrenceId, index])
);

export const canonicalOccurrences: Map<string, OccurrenceMetadata[]> = new Map();
for (const occurrence of occurrences) {
  const list = canonicalOccurrences.get(occurrence.canonicalLessonKey) ?? [];
  list.push(occurrence);
  canonicalOccurrences.set(occurrence.canonicalLessonKey, list);
}

export const skillsById: Map<string, Skill> = new Map(
  taxonomy.skills.map((skill) => [skill.id, skill])
);

export const skillGroupsById = new Map(taxonomy.groups.map((group) => [group.id, group]));

export const skillsByGroup = taxonomy.groups.map((group) => ({
  group,
  skills: taxonomy.skills.filter((skill) => skill.group === group.id),
}));

/** Phase order as it appears in the curriculum metadata. */
export const phaseOrder: string[] = Array.from(
  new Set(occurrences.map((occurrence) => occurrence.phaseSlug))
);

export function getTrack(trackId: TrackId): Track {
  const track = trackById[trackId];
  if (!track) throw new Error(`Unknown track "${trackId}"`);
  return track;
}

export function getOccurrence(occurrenceId: string): OccurrenceMetadata {
  const occurrence = occurrenceById.get(occurrenceId);
  if (!occurrence) throw new Error(`Unknown roadmap occurrence "${occurrenceId}"`);
  return occurrence;
}

export function getSkill(skillId: string): Skill {
  const skill = skillsById.get(skillId);
  if (!skill) throw new Error(`Unknown skill "${skillId}"`);
  return skill;
}

export function importanceFor(
  occurrence: OccurrenceMetadata,
  trackId: TrackId
): OccurrenceMetadata["importance"][TrackId] {
  return occurrence.importance[trackId];
}

export function phaseNumberFor(phaseSlug: string): number {
  const index = phaseOrder.indexOf(phaseSlug);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function canonicalKeyOf(occurrenceId: string): string {
  return occurrenceById.get(occurrenceId)?.canonicalLessonKey ?? occurrenceId;
}

/**
 * The lesson href used by the curriculum workspace. Progress records store this
 * href, which is how roadmap completion is resolved without duplicating state.
 */
export function lessonHrefFor(occurrence: OccurrenceMetadata): string {
  return `/curriculum/${occurrence.occurrenceId}`;
}

export function resolveOccurrencesForHref(href: string | null | undefined): string[] {
  if (!href) return [];
  const cleaned = href.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "");
  const match = /^\/curriculum\/(.+)$/.exec(cleaned);
  if (!match) return [];
  const occurrenceId = match[1];
  const direct = occurrenceById.get(occurrenceId);
  if (direct) return [direct.occurrenceId];
  // Progress may point at a canonical slug while the roadmap node is an alias.
  const canonical = occurrences.find((o) => o.canonicalLessonKey === occurrenceId);
  return canonical ? [canonical.occurrenceId] : [];
}

export const DEFAULT_DURATION_MINUTES = graphConfig.durationFallbacks;

/** Human-friendly estimate. Values are rounded, never shown with false precision. */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0h";
  const rounded = Math.round(minutes / 5) * 5;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}
