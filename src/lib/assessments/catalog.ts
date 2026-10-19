import { AssessmentSchema, type Assessment } from "./schema";
import { validateAssessment } from "./validation";
import checkpoint02 from "../../../assessments/catalog/checkpoint-02-ml-fundamentals.json";
import checkpoint07 from "../../../assessments/catalog/checkpoint-07-transformers.json";
import checkpoint11 from "../../../assessments/catalog/checkpoint-11-llm-engineering.json";
import checkpoint14 from "../../../assessments/catalog/checkpoint-14-agent-engineering.json";
import checkpoint17 from "../../../assessments/catalog/checkpoint-17-infrastructure.json";

const rawAssessments: unknown[] = [
  checkpoint02,
  checkpoint07,
  checkpoint11,
  checkpoint14,
  checkpoint17,
];

function buildCatalog(): Assessment[] {
  const parsed: Assessment[] = [];
  for (const raw of rawAssessments) {
    const result = AssessmentSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(`Invalid assessment definition: ${result.error.message}`);
    }
    const validation = validateAssessment(result.data);
    if (!validation.ok) {
      throw new Error(`Invalid assessment ${result.data.id}: ${validation.issues.join("; ")}`);
    }
    parsed.push(result.data);
  }
  return parsed;
}

export const assessmentCatalog: Assessment[] = buildCatalog();

const byId = new Map(assessmentCatalog.map((a) => [a.id, a]));

export function getAssessmentById(assessmentId: string): Assessment | undefined {
  return byId.get(assessmentId);
}

export function getCheckpoints(): Assessment[] {
  return assessmentCatalog.filter((a) => a.kind === "phase_checkpoint");
}

export function getCheckpointForPhase(phaseSlug: string): Assessment | undefined {
  return assessmentCatalog.find((a) => a.kind === "phase_checkpoint" && a.phaseSlug === phaseSlug);
}
