import { describe, it, expect } from "vitest";
import { tracks, occurrences, getOccurrence, trackById } from "@/lib/roadmap/config";
import { allTrackStats, canonicalTrackOccurrences, compareTracks, trackStats } from "@/lib/roadmap/tracks";
import { explainItem, explainSkipped, explainImportance } from "@/lib/roadmap/explain";
import { TRACK_IDS } from "@/lib/roadmap/types";

describe("career track configuration", () => {
  it("defines exactly the seven supported tracks", () => {
    expect(tracks).toHaveLength(7);
    expect(tracks.map((track) => track.id).sort()).toEqual([...TRACK_IDS].sort());
  });

  it("classifies every canonical lesson for every track", () => {
    const canonical = new Map<string, (typeof occurrences)[number]>();
    for (const occurrence of occurrences) {
      if (!canonical.has(occurrence.canonicalLessonKey)) {
        canonical.set(occurrence.canonicalLessonKey, occurrence);
      }
    }
    for (const trackId of TRACK_IDS) {
      const stats = trackStats(trackId);
      expect(stats.core + stats.important + stats.optional + stats.skip).toBe(542);
      expect(stats.core).toBeGreaterThan(0);
      expect(stats.coverage).toBe(100);
      expect(stats.phases.length).toBeGreaterThan(0);
    }
  });

  it("produces coherent statistics for every track", () => {
    const all = allTrackStats();
    expect(all).toHaveLength(7);
    for (const stats of all) {
      expect(stats.requiredHours).toBeGreaterThan(0);
      expect(stats.allHours).toBeGreaterThanOrEqual(stats.requiredHours);
      expect(stats.coreHours).toBeLessThanOrEqual(stats.requiredHours);
      expect(stats.majorProjects.length).toBeGreaterThan(0);
    }
  });

  it("never deletes skipped lessons from the curriculum", () => {
    const before = occurrences.length;
    canonicalTrackOccurrences("llm-app", false);
    canonicalTrackOccurrences("mlops", false);
    expect(occurrences).toHaveLength(before);
    const skipStats = trackStats("llm-app").skip;
    expect(skipStats).toBeGreaterThan(0);
    expect(getOccurrence("04-computer-vision/14-vision-transformers")).toBeTruthy();
  });

  it("applies per-track importance to the same lesson", () => {
    const rag = getOccurrence("11-llm-engineering/06-rag");
    expect(rag.importance.rag).toBe("core");
    expect(rag.importance.mlops).toBe("important");

    const speech = getOccurrence("06-speech-and-audio/01-audio-fundamentals");
    expect(speech.importance.rag).toBe("skip");
    expect(speech.importance["general-ai"]).toBe("optional");
  });

  it("allows new tracks through configuration alone", () => {
    for (const track of tracks) {
      expect(Object.keys(track.phaseImportance).length).toBe(20);
      expect(typeof track.description).toBe("string");
      expect(track.targetRoles.length).toBeGreaterThan(0);
    }
    expect(trackById.rag.coreSkills).toContain("vector-search");
    expect(trackById.mlops.coreSkills).toContain("serving");
  });
});

describe("track comparison", () => {
  it("compares shared and unique core lessons between two tracks", () => {
    const comparison = compareTracks("rag", "agent");
    expect(comparison.sharedCoreOccurrenceIds.length).toBeGreaterThan(0);
    expect(comparison.uniqueCoreA.length).toBeGreaterThan(0);
    expect(comparison.uniqueCoreB.length).toBeGreaterThan(0);
    const overlap = comparison.uniqueCoreA.filter((key) => comparison.uniqueCoreB.includes(key));
    expect(overlap).toHaveLength(0);
    expect(comparison.sharedHours).toBeGreaterThan(0);
    expect(typeof comparison.additionalHoursB).toBe("number");
  });

  it("is symmetric for the shared core set", () => {
    const forward = compareTracks("rag", "agent");
    const backward = compareTracks("agent", "rag");
    expect(forward.sharedCoreOccurrenceIds).toEqual(backward.sharedCoreOccurrenceIds);
    expect(forward.uniqueCoreA).toEqual(backward.uniqueCoreB);
  });
});

describe("explainability", () => {
  it("explains why a lesson is scheduled", () => {
    const explanation = explainItem("11-llm-engineering/06-rag", "rag");
    expect(explanation.importance).toBe("core");
    expect(explanation.reasons.length).toBeGreaterThan(0);
    expect(explanation.reasons.join(" ")).toContain("RAG Engineer");
    expect(explanation.summary).toContain("Core");
  });

  it("explains why a lesson was skipped and reports saved time", () => {
    const skipped = explainSkipped("09-reinforcement-learning/01-mdps-states-actions-rewards", "rag");
    expect(skipped.importance).toBe("skip");
    expect(skipped.text).toContain("RAG Engineer");
    expect(skipped.minutesSaved).toBeGreaterThan(0);
  });

  it("does not claim savings for lessons that are still scheduled", () => {
    const core = explainSkipped("11-llm-engineering/06-rag", "rag");
    expect(core.importance).toBe("core");
    expect(core.minutesSaved).toBe(0);
  });

  it("describes each importance level", () => {
    expect(explainImportance("core")).toMatch(/block/i);
    expect(explainImportance("important")).toMatch(/deferred/i);
    expect(explainImportance("optional")).toMatch(/specialization|depth/i);
    expect(explainImportance("skip")).toMatch(/curriculum/i);
  });
});
