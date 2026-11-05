import { occurrenceById, occurrences } from "./config";
import type { CapstoneSelection, OccurrenceMetadata } from "./types";

const PHASE = "19-capstone-projects";

export const REQUIRED_CAPSTONE_IDS = [
  "19-capstone-projects/01-terminal-native-coding-agent",
  "19-capstone-projects/02-rag-over-codebase",
  "19-capstone-projects/08-production-rag-chatbot",
  "19-capstone-projects/11-llm-observability-dashboard",
] as const;

const PRODUCT_IDS = occurrences
  .filter((item) => item.phaseSlug === PHASE && lessonNumber(item) >= 1 && lessonNumber(item) <= 17)
  .map((item) => item.occurrenceId);

export const OPTIONAL_CAPSTONE_PRODUCTS = PRODUCT_IDS.filter(
  (id) => !REQUIRED_CAPSTONE_IDS.includes(id as (typeof REQUIRED_CAPSTONE_IDS)[number])
).map(requiredItem);

const TRACK_DEFINITIONS = [
  ["agent-harness", "Agent harness", 20, 29],
  ["nlp-llm", "NLP & LLM from scratch", 30, 41],
  ["training", "End-to-end training", 42, 49],
  ["research", "Automated research", 50, 57],
  ["multimodal", "Multimodal VLM", 58, 63],
  ["advanced-rag", "Advanced RAG", 64, 69],
  ["evaluation", "Evaluation framework", 70, 75],
  ["distributed", "Distributed training", 76, 81],
  ["safety", "Safety harness", 82, 87],
] as const;

export const CAPSTONE_TRACKS = TRACK_DEFINITIONS.map(([id, name, first, last]) => {
  const items = occurrences.filter(
    (item) => item.phaseSlug === PHASE && lessonNumber(item) >= first && lessonNumber(item) <= last
  );
  return {
    id,
    name,
    occurrenceIds: items.map((item) => item.occurrenceId),
    minutes: sumMinutes(items),
    skillTags: [...new Set(items.flatMap((item) => item.skillTags))].sort(),
  };
});

export const REQUIRED_CAPSTONES = REQUIRED_CAPSTONE_IDS.map(requiredItem);

export function selectedCapstoneIds(selection: CapstoneSelection): Set<string> {
  const selected = new Set<string>(REQUIRED_CAPSTONE_IDS);
  for (const id of selection.selectedProductIds) {
    if (OPTIONAL_CAPSTONE_PRODUCTS.some((item) => item.occurrenceId === id)) selected.add(id);
  }
  for (const id of selection.selectedTrackIds) {
    const track = CAPSTONE_TRACKS.find((item) => item.id === id);
    track?.occurrenceIds.forEach((occurrenceId) => selected.add(occurrenceId));
  }
  return selected;
}

export function selectionMinutes(selection: CapstoneSelection): number {
  return [...selectedCapstoneIds(selection)].reduce(
    (sum, id) => sum + (occurrenceById.get(id)?.estimatedMinutes ?? 0),
    0
  );
}

export const CAPSTONE_OVERLAP_NOTICES: Record<string, string> = {
  "19-capstone-projects/01-terminal-native-coding-agent":
    "Overlaps with the Agent harness track in tool dispatch, evaluation, sandboxing, and observability.",
  "19-capstone-projects/02-rag-over-codebase":
    "Overlaps with the Advanced RAG track in retrieval and evaluation practice.",
  "19-capstone-projects/08-production-rag-chatbot":
    "Overlaps with the Advanced RAG track in retrieval, reranking, and RAG evaluation.",
  "19-capstone-projects/11-llm-observability-dashboard":
    "Overlaps with the Evaluation framework and Agent harness observability work.",
  "agent-harness":
    "Reinforces competencies also practiced by the required Terminal-Native Coding Agent.",
  "advanced-rag":
    "Reinforces competencies also practiced by the required RAG products.",
  evaluation:
    "Reinforces competencies also practiced by the required observability dashboard.",
};

function lessonNumber(item: OccurrenceMetadata): number {
  return Number(item.lessonSlug.slice(0, 2));
}

function requiredItem(id: string): OccurrenceMetadata {
  const item = occurrenceById.get(id);
  if (!item) throw new Error(`Missing capstone metadata for ${id}`);
  return item;
}

function sumMinutes(items: OccurrenceMetadata[]): number {
  return items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
}
