import { occurrences, skillsById, trackById } from "@/lib/roadmap/config";
import type { ProjectDefinition } from "./schema";
import { EVIDENCE_KINDS } from "./schema";

export interface ProjectValidationIssue {
  field: string;
  message: string;
}

export interface ProjectValidationResult {
  ok: boolean;
  issues: ProjectValidationIssue[];
}

const phaseSlugsValid = new Set(occurrences.map((item) => item.phaseSlug));
const occurrenceIdsValid = new Set(occurrences.map((item) => item.occurrenceId));

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // Allow localhost http for development; everything else must be https.
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:") {
      const host = url.hostname;
      return host === "localhost" || host === "127.0.0.1";
    }
    return false;
  } catch {
    return false;
  }
}

/** Only run at build/CI time — catalog is validated on load. */
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/, // AWS access key
  /sk-[a-zA-Z0-9]{20,}/, // OpenAI-style key
  /ghp_[a-zA-Z0-9]{20,}/, // GitHub PAT
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
];

export function validateProject(project: ProjectDefinition): ProjectValidationResult {
  const issues: ProjectValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });

  // Phase slugs and occurrence references must exist in the imported curriculum.
  for (const phaseSlug of project.phaseSlugs) {
    if (!phaseSlugsValid.has(phaseSlug)) add("phaseSlugs", `Unknown phase slug: ${phaseSlug}`);
  }
  for (const occurrenceId of project.associatedOccurrences) {
    if (!occurrenceIdsValid.has(occurrenceId)) {
      add("associatedOccurrences", `Unknown curriculum occurrence: ${occurrenceId}`);
    }
  }

  // Skill IDs must exist in the taxonomy.
  for (const skillId of project.skills) {
    if (!skillsById.has(skillId)) add("skills", `Unknown skill id: ${skillId}`);
  }

  // Track IDs must exist in the track configuration.
  for (const trackId of project.relevantTracks) {
    if (!(trackId in trackById)) add("relevantTracks", `Unknown track id: ${trackId}`);
  }

  // URLs must be https (or localhost dev http) and unlisted secrets are forbidden.
  for (const [key, value] of Object.entries({ starterRepo: project.starterRepo, sourceUrl: project.sourceUrl })) {
    if (value && !isValidUrl(value)) add(key, `URL must be https: ${value}`);
  }
  for (const [index, url] of project.referenceResources.entries()) {
    if (!isValidUrl(url)) add(`referenceResources[${index}]`, `URL must be https: ${url}`);
  }
  const serialized = JSON.stringify(project);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      add("secrets", "Project definition appears to contain an API key or private key material.");
      break;
    }
  }

  // Prerequisites must reference other projects by id (string format proj-*).
  for (const prerequisite of project.prerequisites) {
    if (!prerequisite.startsWith("proj-")) {
      add("prerequisites", `Prerequisite should be a project id (proj-*): ${prerequisite}`);
    }
  }

  // Evidence requirements must use known kinds.
  for (const requirement of project.requiredEvidence) {
    if (!EVIDENCE_KINDS.includes(requirement.kind)) {
      add("requiredEvidence", `Unknown evidence kind: ${requirement.kind}`);
    }
  }

  return { ok: issues.length === 0, issues };
}
