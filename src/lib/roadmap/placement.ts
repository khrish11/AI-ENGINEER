import { occurrences, trackById, skillsById } from "./config";
import type {
  LearnerProfile,
  MathLevel,
  MathSkill,
  PlacementResult,
  Proficiency,
  TrackId,
} from "./types";
import { MATH_SKILLS, AI_SKILLS, PROGRAMMING_SKILLS } from "./types";

const LEVEL_VALUE: Record<Proficiency, number> = {
  none: 0,
  basic: 1,
  comfortable: 2,
  strong: 3,
};

const MATH_VALUE: Record<MathLevel, number> = {
  weak: 0,
  okay: 1,
  comfortable: 2,
  strong: 3,
};

/**
 * Curriculum skill tags that are not part of the onboarding self-assessment are
 * scored through the assessed skill they most closely follow. Placement stays
 * deterministic and readable: a learner comfortable with classical ML does not
 * look like they know nothing about "regression" merely because regression was
 * not one of the assessment checkboxes.
 */
const SOURCE_BY_SKILL: Record<string, string> = {
  // ML fundamentals ← classical ML
  regression: "classical-ml",
  classification: "classical-ml",
  "feature-engineering": "classical-ml",
  "model-evaluation": "classical-ml",
  ensembles: "classical-ml",
  "hyperparameter-tuning": "classical-ml",
  "ml-pipelines": "classical-ml",
  "time-series": "classical-ml",
  "anomaly-detection": "classical-ml",
  "ml-system-design": "classical-ml",
  "reinforcement-learning": "classical-ml",
  // Deep learning ← neural networks / PyTorch
  perceptron: "neural-networks",
  backpropagation: "neural-networks",
  cnn: "neural-networks",
  rnn: "neural-networks",
  optimizers: "neural-networks",
  regularization: "neural-networks",
  jax: "pytorch",
  // Transformers and LLM applications ← the AI/ML assessment entries
  tokenization: "transformers",
  attention: "transformers",
  pretraining: "transformers",
  rlhf: "transformers",
  "fine-tuning": "transformers",
  embeddings: "llm-applications",
  "structured-output": "llm-applications",
  prompting: "llm-applications",
  "llm-evaluation": "llm-applications",
  retrieval: "rag",
  chunking: "llm-applications",
  "vector-search": "llm-applications",
  "hybrid-search": "llm-applications",
  reranking: "llm-applications",
  quantization: "llm-applications",
  "inference-optimization": "llm-applications",
  // Agentic vocabulary ← agents
  "agent-orchestration": "agents",
  "agent-memory": "agents",
  planning: "agents",
  mcp: "agents",
  "tool-calling": "agents",
  "multi-agent": "agents",
  "agent-evaluation": "agents",
  "human-approval": "agents",
  // Serving vocabulary ← deployment/MLOps
  serving: "deployment",
  observability: "deployment",
  reliability: "deployment",
  security: "deployment",
  finops: "deployment",
  compliance: "deployment",
};

/** Which skills gate each early phase. Used only for placement, never for scheduling. */
const PHASE_SKILLS: Record<string, string[]> = {
  "00-setup-and-tooling": ["python", "git", "linux", "docker"],
  "01-math-foundations": ["linear-algebra", "calculus", "probability", "statistics"],
  "02-ml-fundamentals": ["regression", "classification", "model-evaluation"],
  "03-deep-learning-core": ["backpropagation", "pytorch", "optimizers"],
  "05-nlp-foundations-to-advanced": ["tokenization", "embeddings", "retrieval"],
  "07-transformers-deep-dive": ["transformers", "attention"],
  "11-llm-engineering": ["prompting", "rag", "tool-calling"],
  "13-tools-and-protocols": ["mcp", "tool-calling"],
  "14-agent-engineering": ["agent-orchestration", "planning", "agent-memory"],
};

const PHASE_ORDER = [
  "00-setup-and-tooling",
  "01-math-foundations",
  "02-ml-fundamentals",
  "03-deep-learning-core",
  "05-nlp-foundations-to-advanced",
  "07-transformers-deep-dive",
  "11-llm-engineering",
  "13-tools-and-protocols",
  "14-agent-engineering",
];

const PHASE_TITLES: Record<string, string> = {
  "00-setup-and-tooling": "Phase 00 — Setup & Tooling",
  "01-math-foundations": "Phase 01 — Math Foundations",
  "02-ml-fundamentals": "Phase 02 — ML Fundamentals",
  "03-deep-learning-core": "Phase 03 — Deep Learning Core",
  "05-nlp-foundations-to-advanced": "Phase 05 — NLP Foundations",
  "07-transformers-deep-dive": "Phase 07 — Transformers Deep Dive",
  "11-llm-engineering": "Phase 11 — LLM Engineering",
  "13-tools-and-protocols": "Phase 13 — Tools & Protocols",
  "14-agent-engineering": "Phase 14 — Agent Engineering",
};

export interface PlacementQuizSignals {
  correct: number;
  total: number;
  weakSkillIds: string[];
}

function proficiencyForSkill(
  profile: LearnerProfile,
  skillId: string
): Proficiency | MathLevel {
  if (
    (PROGRAMMING_SKILLS as readonly string[]).includes(skillId) &&
    skillId in profile.programming
  ) {
    return profile.programming[skillId as keyof LearnerProfile["programming"]] ?? "none";
  }
  const source = SOURCE_BY_SKILL[skillId];
  if (source && source in profile.ai) {
    return profile.ai[source as keyof LearnerProfile["ai"]] ?? "none";
  }
  if (skillId in profile.ai) {
    return profile.ai[skillId as keyof LearnerProfile["ai"]] ?? "none";
  }
  return "none";
}

function skillStrength(profile: LearnerProfile, skillId: string): number {
  if (profile.knownTopicSkillIds.includes(skillId)) return 3;
  if (MATH_SKILLS.includes(skillId as MathSkill)) {
    return MATH_VALUE[profile.math[skillId as MathSkill] ?? "weak"];
  }
  const level = proficiencyForSkill(profile, skillId);
  const value = (LEVEL_VALUE as Record<string, number>)[level];
  return value ?? 0;
}

function phaseReadiness(profile: LearnerProfile, phaseSlug: string): number {
  const skills = PHASE_SKILLS[phaseSlug] ?? [];
  if (skills.length === 0) return 0;
  const total = skills.reduce((sum, skill) => sum + skillStrength(profile, skill), 0);
  return total / skills.length;
}

export function recommendPlacement(
  profile: LearnerProfile,
  quiz?: PlacementQuizSignals
): PlacementResult {
  const weakFromQuiz = new Set(quiz?.weakSkillIds ?? []);
  const quizRate = quiz && quiz.total > 0 ? quiz.correct / quiz.total : null;

  // Start at the first gated phase the learner is not yet past. A phase is
  // behind the learner when their average self-assessed strength for its gate
  // skills is at least "basic" (1.0); re-studying a phase they already know at
  // that level would waste their limited study hours, while a phase below
  // basic is always started from.
  let startPhase = PHASE_ORDER[PHASE_ORDER.length - 1];
  for (const phase of PHASE_ORDER) {
    const readiness = phaseReadiness(profile, phase);
    if (readiness < 1) {
      startPhase = phase;
      break;
    }
  }

  // A weak placement quiz keeps the learner earlier rather than skipping ahead.
  if (quizRate !== null && quizRate < 0.5) {
    const earlier = PHASE_ORDER[Math.max(0, PHASE_ORDER.indexOf(startPhase) - 1)];
    startPhase = earlier ?? startPhase;
  }

  const reviewSkillIds = new Set<string>(weakFromQuiz);
  for (const skill of PHASE_SKILLS[startPhase] ?? []) {
    if (skillStrength(profile, skill) < 2) reviewSkillIds.add(skill);
  }

  // "Safe to skim" only counts skills the learner model can actually speak
  // about: assessment profile entries plus topics the learner explicitly
  // marked as known during onboarding.
  const assessable = new Set<string>([
    ...PROGRAMMING_SKILLS,
    ...MATH_SKILLS,
    ...AI_SKILLS,
    ...profile.knownTopicSkillIds,
  ]);

  const skim = occurrences.filter((occurrence) => {
    if (occurrence.isAlias) return false;
    const phaseSkills = PHASE_SKILLS[occurrence.phaseSlug];
    if (!phaseSkills) return false;
    if (PHASE_ORDER.indexOf(occurrence.phaseSlug) > PHASE_ORDER.indexOf(startPhase)) return false;
    const relevant = occurrence.skillTags.filter((skill) => assessable.has(skill));
    if (relevant.length === 0) return false;
    return relevant.every(
      (skill) => skillStrength(profile, skill) >= 2 && !reviewSkillIds.has(skill)
    );
  });

  const skimIds = skim.slice(0, 60).map((occurrence) => occurrence.occurrenceId);
  const estimatedMinutesSaved = skim
    .slice(0, 60)
    .reduce((sum, occurrence) => sum + (occurrence.estimatedMinutes ?? 0), 0);

  const reviewTopics = [...reviewSkillIds]
    .filter((skill) => skillsById.has(skill))
    .map((skill) => skillsById.get(skill)!.name);

  const summary =
    `Recommended starting point: ${PHASE_TITLES[startPhase] ?? startPhase}. ` +
    (reviewTopics.length > 0
      ? `Review ${reviewTopics.join(", ")} first. `
      : "No prerequisite gaps detected. ") +
    (skimIds.length > 0
      ? `You can skim or skip about ${skimIds.length} lesson${skimIds.length === 1 ? "" : "s"} you already know.`
      : "No lessons look safe to skim yet.");

  return {
    recommendedStartPhaseSlug: startPhase,
    recommendedStartPhaseTitle: PHASE_TITLES[startPhase] ?? startPhase,
    reviewSkillIds: [...reviewSkillIds].sort(),
    reviewTopics,
    skimOccurrenceIds: skimIds,
    estimatedMinutesSaved,
    summary,
    source: quiz ? "combined" : "self-assessment",
  };
}

export function placementSummaryForTrack(
  profile: LearnerProfile,
  quiz?: PlacementQuizSignals
): PlacementResult {
  return recommendPlacement(profile, quiz);
}

export function phaseTitle(phaseSlug: string): string {
  return PHASE_TITLES[phaseSlug] ?? phaseSlug;
}

export function phaseSkillRequirements(phaseSlug: string): string[] {
  return PHASE_SKILLS[phaseSlug] ?? [];
}

export function trackFocusSkills(trackId: TrackId): string[] {
  return trackById[trackId]?.coreSkills ?? [];
}
