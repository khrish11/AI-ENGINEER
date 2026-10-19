import { roadmapStateRepo } from "@/lib/progress/repositories/roadmap-state";
import { todayIso } from "./dates";
import { generateRoadmap, type GenerationResult } from "./scheduler";
import { rescheduleRoadmap } from "./rescheduler";
import { RoadmapStoreSchema, type RoadmapSettings, type RoadmapStore } from "./types";

export interface CompletionInput {
  completed: Iterable<string>;
  mastered?: Iterable<string>;
}

export function emptyStore(): RoadmapStore {
  return {
    version: 1,
    profile: null,
    settings: null,
    plan: null,
    overrides: {
      included: [],
      excluded: [],
      manualWeeks: {},
      deferred: [],
      dropped: [],
    },
    placement: null,
    history: [],
  };
}

export function defaultSettings(): RoadmapSettings {
  return {
    trackId: "general-ai",
    availableHoursPerWeek: 10,
    startDate: todayIso(),
    targetDate: null,
    studyDays: [1, 3, 5],
    bufferPreference: "monthly",
    includeOptionalTopics: false,
    bufferWeeks: [],
    manuallyIncluded: [],
    manuallyExcluded: [],
    manualWeekAssignments: {},
  };
}

export async function loadRoadmapStore(): Promise<RoadmapStore> {
  const record = await roadmapStateRepo.get();
  if (!record) return emptyStore();
  const parsed = RoadmapStoreSchema.safeParse(record.state);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Ignoring unreadable roadmap state:", parsed.error.message);
    }
    return emptyStore();
  }
  return parsed.data;
}

export async function saveRoadmapStore(store: RoadmapStore): Promise<RoadmapStore> {
  const parsed = RoadmapStoreSchema.parse(store);
  await roadmapStateRepo.set(parsed);
  return parsed;
}

export function buildSettings(
  base: RoadmapSettings,
  changes: Partial<RoadmapSettings>
): RoadmapSettings {
  return {
    ...base,
    ...changes,
    studyDays: [...(changes.studyDays ?? base.studyDays)].sort((a, b) => a - b),
    manuallyIncluded: changes.manuallyIncluded ?? base.manuallyIncluded,
    manuallyExcluded: changes.manuallyExcluded ?? base.manuallyExcluded,
    manualWeekAssignments: changes.manualWeekAssignments ?? base.manualWeekAssignments,
  };
}

export function generateForSettings(
  settings: RoadmapSettings,
  completion: CompletionInput
): GenerationResult {
  return generateRoadmap({
    trackId: settings.trackId,
    startDate: settings.startDate,
    targetDate: settings.targetDate,
    availableHoursPerWeek: settings.availableHoursPerWeek,
    studyDays: settings.studyDays,
    bufferPreference: settings.bufferPreference,
    manualBufferWeeks: settings.bufferWeeks,
    includeOptionalTopics: settings.includeOptionalTopics,
    completedCanonicalLessonKeys: [...completion.completed],
    masteredCanonicalLessonKeys: [...(completion.mastered ?? [])],
    manuallyIncluded: settings.manuallyIncluded,
    manuallyExcluded: settings.manuallyExcluded,
    manualWeekAssignments: settings.manualWeekAssignments,
  });
}

export async function generateAndSave(
  store: RoadmapStore,
  settings: RoadmapSettings,
  completion: CompletionInput
): Promise<{ store: RoadmapStore; result: GenerationResult }> {
  const result = generateForSettings(settings, completion);
  const next: RoadmapStore = {
    ...store,
    settings,
    plan: result.plan,
    overrides: {
      ...store.overrides,
      included: settings.manuallyIncluded,
      excluded: settings.manuallyExcluded,
    },
    history: [
      ...store.history,
      {
        at: new Date().toISOString(),
        action: "generate",
        summary: `Generated a ${result.plan.weeks.length}-week ${settings.trackId} plan at ${settings.availableHoursPerWeek}h/week.`,
      },
    ].slice(-20),
  };
  await saveRoadmapStore(next);
  return { store: next, result };
}

export async function rescheduleAndSave(
  store: RoadmapStore,
  completion: CompletionInput,
  changes: {
    hoursPerWeek?: number;
    targetDate?: string | null;
    droppedOccurrenceIds?: string[];
    today?: string;
  } = {}
): Promise<{ store: RoadmapStore; result: ReturnType<typeof rescheduleRoadmap> }> {
  if (!store.plan || !store.settings) {
    throw new Error("Cannot reschedule before a roadmap plan exists.");
  }
  const settings = buildSettings(store.settings, {
    availableHoursPerWeek: changes.hoursPerWeek ?? store.settings.availableHoursPerWeek,
    targetDate:
      changes.targetDate !== undefined ? changes.targetDate : store.settings.targetDate,
    manuallyExcluded: [
      ...new Set([
        ...store.settings.manuallyExcluded,
        ...(changes.droppedOccurrenceIds ?? []),
      ]),
    ],
  });

  const result = rescheduleRoadmap({
    plan: store.plan,
    settings,
    today: changes.today ?? todayIso(),
    completedCanonicalLessonKeys: [...completion.completed],
    masteredCanonicalLessonKeys: [...(completion.mastered ?? [])],
    droppedOccurrenceIds: changes.droppedOccurrenceIds,
  });

  const next: RoadmapStore = {
    ...store,
    settings,
    plan: result.plan,
    overrides: {
      ...store.overrides,
      excluded: settings.manuallyExcluded,
    },
    history: [
      ...store.history,
      { at: new Date().toISOString(), action: "reschedule", summary: result.summary },
    ].slice(-20),
  };
  await saveRoadmapStore(next);
  return { store: next, result };
}

/** The set of canonical lessons the active plan expects, for progress display. */
export function plannedCanonicalKeys(store: RoadmapStore): Set<string> {
  const keys = new Set<string>();
  if (!store.plan) return keys;
  for (const week of store.plan.weeks) {
    for (const item of week.items) keys.add(item.canonicalLessonKey);
  }
  return keys;
}

export function isRoadmapReady(store: RoadmapStore): boolean {
  return Boolean(store.settings && store.plan && store.plan.weeks.length > 0);
}
