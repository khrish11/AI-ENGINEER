/**
 * Generates `roadmaps/metadata/lesson-metadata.json` from the active curriculum.
 *
 * The output is deterministic: the same curriculum revision and the same
 * configuration files always produce byte-identical JSON (no timestamps, stable
 * ordering). Run with `npm run roadmap:metadata` after changing a track or the
 * skill taxonomy.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { getDbClient } from "../db/index";
import {
  GraphConfigSchema,
  LessonMetadataFileSchema,
  SkillTaxonomySchema,
  TrackSchema,
  TRACK_IDS,
  type Difficulty,
  type Importance,
  type OccurrenceMetadata,
  type Track,
  type TrackId,
} from "../lib/roadmap/types";

const ROOT = process.cwd();
const TRACKS_DIR = path.join(ROOT, "roadmaps", "tracks");
const TAXONOMY_PATH = path.join(ROOT, "roadmaps", "skills", "taxonomy.json");
const GRAPH_PATH = path.join(ROOT, "roadmaps", "metadata", "graph.json");
const OUTPUT_PATH = path.join(ROOT, "roadmaps", "metadata", "lesson-metadata.json");

interface LessonRow {
  id: string;
  canonical_phase_id: string;
  current_slug: string;
  default_title: string;
  difficulty: string;
  estimated_minutes: number;
  phase_slug: string;
  phase_number: number;
}

interface AliasRow {
  alias_slug: string;
  canonical_slug: string;
  phase_slug: string;
  phase_number: number;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function normalizeDifficulty(raw: string): Difficulty {
  const value = raw.toLowerCase();
  if (value.startsWith("adv")) return "advanced";
  if (value.startsWith("int")) return "intermediate";
  return "beginner";
}

function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesKeyword(text: string, tokens: string[], keyword: string): boolean {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return false;
  if (normalized.includes(" ")) return text.includes(normalized);
  if (normalized.length <= 2) return tokens.includes(normalized);
  return tokens.some((token) => token === normalized || token.startsWith(normalized));
}

function lessonOrder(slug: string): number {
  const match = /^(\d+)-/.exec(slug);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function lastOccurrenceOfPhase(
  occurrences: OccurrenceMetadata[],
  phaseSlug: string
): string | null {
  const inPhase = occurrences.filter((o) => o.phaseSlug === phaseSlug);
  if (inPhase.length === 0) return null;
  return inPhase[inPhase.length - 1].occurrenceId;
}

async function main() {
  const tracks: Track[] = fs
    .readdirSync(TRACKS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => TrackSchema.parse(readJson(path.join(TRACKS_DIR, file))));

  const ids = tracks.map((t) => t.id).sort();
  const expected = [...TRACK_IDS].sort();
  if (ids.length !== expected.length || ids.some((id, i) => id !== expected[i])) {
    throw new Error(
      `Track configuration mismatch. Expected ${expected.join(", ")} but found ${ids.join(", ")}`
    );
  }

  const taxonomy = SkillTaxonomySchema.parse(readJson(TAXONOMY_PATH));
  const graph = GraphConfigSchema.parse(readJson(GRAPH_PATH));
  const knownSkills = new Set(taxonomy.skills.map((s) => s.id));

  for (const track of tracks) {
    for (const skill of track.coreSkills) {
      if (!knownSkills.has(skill)) {
        throw new Error(`Track ${track.id} references unknown skill "${skill}"`);
      }
    }
  }

  const sql = getDbClient();
  const lessons = await sql<LessonRow[]>`
    select l.id,
           l.canonical_phase_id,
           l.current_slug,
           l.default_title,
           l.difficulty,
           l.estimated_minutes,
           p.default_slug as phase_slug,
           p.phase_number
    from canonical_lessons l
    join canonical_phases p on p.id = l.canonical_phase_id
    where l.is_deprecated = false
    order by p.phase_number asc, l.current_slug asc
  `;

  const aliases = await sql<AliasRow[]>`
    select a.alias_slug,
           c.current_slug as canonical_slug,
           p.default_slug as phase_slug,
           p.phase_number
    from lesson_aliases a
    join canonical_lessons c on c.id = a.canonical_lesson_id
    join canonical_phases p on p.id = c.canonical_phase_id
    order by a.alias_slug asc
  `;

  const [activeRev] = await sql<{ commit_sha: string }[]>`
    select commit_sha from curriculum_revisions where is_active = true limit 1
  `;

  const canonicalRows = [...lessons].sort((a, b) => {
    if (a.phase_number !== b.phase_number) return a.phase_number - b.phase_number;
    return lessonOrder(slugOf(a.current_slug)) - lessonOrder(slugOf(b.current_slug));
  });

  const occurrences: OccurrenceMetadata[] = [];

  for (const row of canonicalRows) {
    const canonicalKey = row.current_slug;
    const lessonSlug = slugOf(canonicalKey);
    const override = graph.occurrenceOverrides[canonicalKey];
    const difficulty = override?.difficulty ?? normalizeDifficulty(row.difficulty);
    const estimatedMinutes =
      override?.estimatedMinutes ??
      (row.estimated_minutes > 0 ? row.estimated_minutes : null);
    const fallbackMinutes =
      graph.durationFallbacks[difficulty] ?? graph.durationFallbacks.intermediate;

    occurrences.push({
        occurrenceId: canonicalKey,
        canonicalLessonKey: canonicalKey,
        phaseSlug: row.phase_slug,
        lessonSlug,
        title: row.default_title,
        difficulty,
        estimatedMinutes: estimatedMinutes ?? fallbackMinutes,
        estimateSource: estimatedMinutes ? "upstream" : "fallback",
        skillTags: resolveSkills(row.current_slug, row.default_title, row.phase_slug),
        projectRelevant: resolveProjectRelevance(row.current_slug, row.default_title),
        importance: resolveImportance(row.phase_slug, canonicalKey, tracks),
        prerequisites: [],
        recommendedBefore: [],
        isAlias: false,
      });
  }

  for (const alias of aliases) {
    const canonical = lessons.find((l) => l.current_slug === alias.canonical_slug);
    if (!canonical) continue;
    // An alias is a *curriculum occurrence* at its historical location, so its
    // phase comes from the alias slug, not from the canonical lesson's phase.
    const aliasPhaseSlug = alias.alias_slug.split("/")[0];
    const override = graph.occurrenceOverrides[alias.alias_slug];
    const difficulty = override?.difficulty ?? normalizeDifficulty(canonical.difficulty);
    const estimatedMinutes =
      override?.estimatedMinutes ??
      (canonical.estimated_minutes > 0 ? canonical.estimated_minutes : null);
    const fallbackMinutes =
      graph.durationFallbacks[difficulty] ?? graph.durationFallbacks.intermediate;

    occurrences.push({
        occurrenceId: alias.alias_slug,
        canonicalLessonKey: alias.canonical_slug,
        phaseSlug: aliasPhaseSlug,
        lessonSlug: slugOf(alias.alias_slug),
        title: canonical.default_title,
        difficulty,
        estimatedMinutes: estimatedMinutes ?? fallbackMinutes,
        estimateSource: estimatedMinutes ? "upstream" : "fallback",
        skillTags: resolveSkills(alias.alias_slug, canonical.default_title, aliasPhaseSlug),
        projectRelevant: resolveProjectRelevance(alias.alias_slug, canonical.default_title),
        importance: resolveImportance(aliasPhaseSlug, alias.alias_slug, tracks),
        prerequisites: [],
        recommendedBefore: [],
        isAlias: true,
      });
  }

  occurrences.sort((a, b) => {
    const phaseA = phaseNumberOf(a.phaseSlug, canonicalRows);
    const phaseB = phaseNumberOf(b.phaseSlug, canonicalRows);
    if (phaseA !== phaseB) return phaseA - phaseB;
    return lessonOrder(a.lessonSlug) - lessonOrder(b.lessonSlug);
  });

  // Hard prerequisites: previous occurrence inside the same phase. Cross-phase
  // relationships are recorded as soft `recommendedBefore` hints so a track can
  // omit an entire phase without pulling it back in.
  const byPhase = new Map<string, OccurrenceMetadata[]>();
  for (const occurrence of occurrences) {
    const list = byPhase.get(occurrence.phaseSlug) ?? [];
    list.push(occurrence);
    byPhase.set(occurrence.phaseSlug, list);
  }
  for (const list of byPhase.values()) {
    list.sort((a, b) => lessonOrder(a.lessonSlug) - lessonOrder(b.lessonSlug));
    list.forEach((occurrence, index) => {
      occurrence.prerequisites = index === 0 ? [] : [list[index - 1].occurrenceId];
    });
  }

  for (const occurrence of occurrences) {
    const phasePrereqs = graph.phasePrerequisites[occurrence.phaseSlug] ?? [];
    occurrence.recommendedBefore = phasePrereqs
      .map((phase) => lastOccurrenceOfPhase(occurrences, phase))
      .filter((value): value is string => Boolean(value));
  }

  // Explicit edges are additive and must reference known occurrences.
  const occurrenceIds = new Set(occurrences.map((o) => o.occurrenceId));
  for (const [target, prerequisites] of Object.entries(graph.extraEdges)) {
    const occurrence = occurrences.find((o) => o.occurrenceId === target);
    if (!occurrence) {
      throw new Error(`Graph edge references unknown occurrence "${target}"`);
    }
    for (const prerequisite of prerequisites) {
      if (!occurrenceIds.has(prerequisite)) {
        throw new Error(`Graph edge "${target}" references unknown prerequisite "${prerequisite}"`);
      }
      if (prerequisite !== target && !occurrence.prerequisites.includes(prerequisite)) {
        occurrence.prerequisites.push(prerequisite);
      }
    }
  }

  const payload = LessonMetadataFileSchema.parse({
    version: 1,
    generatedFrom: {
      phases: new Set(lessons.map((l) => l.phase_slug)).size,
      canonicalLessons: lessons.length,
      occurrences: occurrences.length,
      activeCommit: activeRev?.commit_sha ?? null,
    },
    occurrences,
  });

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await sql.end();

  console.log(`Wrote ${occurrences.length} occurrences to ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(
    `Canonical lessons: ${lessons.length} · aliases: ${aliases.length} · tracks: ${tracks.length} · skills: ${taxonomy.skills.length}`
  );

  function resolveSkills(slug: string, title: string, phaseSlug: string): string[] {
    const text = `${slug} ${title}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    const tokens = tokensOf(text);
    const matched = taxonomy.skills
      .filter((skill) => skill.match.some((keyword) => matchesKeyword(text, tokens, keyword)))
      .map((skill) => skill.id);

    const defaults = graph.phaseSkills[phaseSlug] ?? [];
    const merged = [...new Set([...matched, ...defaults])];
    return merged.filter((skill) => knownSkills.has(skill)).slice(0, 6);
  }

  function resolveProjectRelevance(slug: string, title: string): boolean {
    const text = `${slug} ${title}`.toLowerCase();
    return graph.projectKeywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  function resolveImportance(
    phaseSlug: string,
    occurrenceId: string,
    allTracks: Track[]
  ): Record<TrackId, Importance> {
    const result = {} as Record<TrackId, Importance>;
    for (const track of allTracks) {
      const base = track.phaseImportance[phaseSlug];
      if (!base) {
        throw new Error(`Track ${track.id} is missing phase importance for "${phaseSlug}"`);
      }
      result[track.id] = track.overrides[occurrenceId] ?? base;
    }
    return result;
  }
}

function slugOf(fullSlug: string): string {
  const parts = fullSlug.split("/");
  return parts[parts.length - 1];
}

function phaseNumberOf(phaseSlug: string, rows: LessonRow[]): number {
  const row = rows.find((r) => r.phase_slug === phaseSlug);
  return row ? row.phase_number : 99;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
