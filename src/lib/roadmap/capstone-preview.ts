import { occurrenceById } from "./config";
import {
  CAPSTONE_TRACKS,
  OPTIONAL_CAPSTONE_PRODUCTS,
  REQUIRED_CAPSTONE_IDS,
  selectedCapstoneIds,
} from "./capstones";
import { generateForSettings, type CompletionInput } from "./store";
import { CapstoneSelectionSchema, type OccurrenceMetadata, type RoadmapSettings } from "./types";

const PHASE = "19-capstone-projects";

export interface CapstonePreview {
  totalRoadmapOccurrences: number;
  totalRoadmapMinutes: number;
  estimatedWeeks: number;
  directSelectedCapstones: number;
  requiredCoreSelected: number;
  optionalSelected: number;
  availableOptionalCapstones: number;
  selectedStandaloneProducts: number;
  selectedDeepBuildTracks: number;
  requiredCoreMinutes: number;
  selectedOptionalMinutes: number;
  scheduledCapstones: number;
  scheduledCapstoneMinutes: number;
  additionalPrerequisites: number;
  additionalPrerequisiteMinutes: number;
  knownCapstonesExcluded: number;
  manuallyRestoredCapstones: number;
}

export function calculateCapstonePreview(
  settings: RoadmapSettings,
  completion: CompletionInput = { completed: [] }
): CapstonePreview {
  const parsedSelection = CapstoneSelectionSchema.safeParse(settings.capstoneSelection);
  if (!parsedSelection.success) {
    throw new Error("Capstone preview requires versioned V2 selection settings.");
  }
  const selection = parsedSelection.data;

  const result = generateForSettings(settings, completion);
  const coreResult = generateForSettings(
    {
      ...settings,
      capstoneSelection: { version: 1, selectedProductIds: [], selectedTrackIds: [] },
    },
    completion
  );

  const scheduledCapstones = uniqueCanonical(
    result.selection.allSelected.filter((item) => item.phaseSlug === PHASE)
  );
  const coreScheduled = scheduledCapstones.filter((item) =>
    REQUIRED_CAPSTONE_IDS.includes(item.occurrenceId as (typeof REQUIRED_CAPSTONE_IDS)[number])
  );
  const directIds = selectedCapstoneIds(selection);
  const directOptional = uniqueCanonical(
    [...directIds]
      .filter((id) => !REQUIRED_CAPSTONE_IDS.includes(id as (typeof REQUIRED_CAPSTONE_IDS)[number]))
      .map((id) => occurrenceById.get(id))
      .filter((item): item is OccurrenceMetadata => Boolean(item))
      .filter((item) => scheduledCapstones.some((scheduled) => scheduled.canonicalLessonKey === item.canonicalLessonKey))
  );

  const baselineCanonical = new Set(
    coreResult.selection.allSelected.map((item) => item.canonicalLessonKey)
  );
  const directOptionalCanonical = new Set(
    directOptional.map((item) => item.canonicalLessonKey)
  );
  const additionalPrerequisites = uniqueCanonical(
    result.selection.allSelected.filter(
      (item) =>
        !baselineCanonical.has(item.canonicalLessonKey) &&
        !directOptionalCanonical.has(item.canonicalLessonKey)
    )
  );

  const validProducts = new Set(OPTIONAL_CAPSTONE_PRODUCTS.map((item) => item.occurrenceId));
  const validTracks = new Set<string>(CAPSTONE_TRACKS.map((track) => track.id));
  const selectedProducts = new Set(
    selection.selectedProductIds.filter((id) => validProducts.has(id))
  );
  const selectedTracks = new Set(
    selection.selectedTrackIds.filter((id) => validTracks.has(id))
  );
  const scheduledIds = new Set(scheduledCapstones.map((item) => item.occurrenceId));

  return {
    totalRoadmapOccurrences: result.plan.summary.totalOccurrences,
    totalRoadmapMinutes: result.plan.summary.totalMinutes,
    estimatedWeeks: result.plan.weeks.length,
    directSelectedCapstones: coreScheduled.length + directOptional.length,
    requiredCoreSelected: coreScheduled.length,
    optionalSelected: directOptional.length,
    availableOptionalCapstones: OPTIONAL_CAPSTONE_PRODUCTS.length + CAPSTONE_TRACKS.reduce((sum, track) => sum + track.occurrenceIds.length, 0),
    selectedStandaloneProducts: selectedProducts.size,
    selectedDeepBuildTracks: selectedTracks.size,
    requiredCoreMinutes: sumMinutes(coreScheduled),
    selectedOptionalMinutes: sumMinutes(directOptional),
    scheduledCapstones: scheduledCapstones.length,
    scheduledCapstoneMinutes: sumMinutes(scheduledCapstones),
    additionalPrerequisites: additionalPrerequisites.length,
    additionalPrerequisiteMinutes: sumMinutes(additionalPrerequisites),
    knownCapstonesExcluded: settings.knownOccurrenceIds.filter(
      (id) => occurrenceById.get(id)?.phaseSlug === PHASE && !scheduledIds.has(id)
    ).length,
    manuallyRestoredCapstones: settings.manuallyIncluded.filter(
      (id) => occurrenceById.get(id)?.phaseSlug === PHASE && scheduledIds.has(id)
    ).length,
  };
}

function uniqueCanonical(items: OccurrenceMetadata[]): OccurrenceMetadata[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.canonicalLessonKey)) return false;
    seen.add(item.canonicalLessonKey);
    return true;
  });
}

function sumMinutes(items: OccurrenceMetadata[]): number {
  return items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
}
