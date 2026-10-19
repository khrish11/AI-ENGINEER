import { describe, it, expect } from "vitest";
import {
  scoreResourceSignals,
  scoreResource,
  rankItems,
  type RankableItem,
} from "@/lib/resources/ranking";
import type { CatalogResource } from "@/lib/resources/types";

function makeResource(overrides: Partial<CatalogResource> = {}): CatalogResource {
  return {
    id: "res",
    type: "official_documentation",
    title: "Resource",
    canonical_url: "https://example.com",
    editorial_status: "verified",
    associated_lessons: [],
    ...overrides,
  };
}

const now = new Date();

describe("Resource ranking", () => {
  it("awards the full signal stack for a primary, verified, original-author doc", () => {
    const breakdown = scoreResourceSignals(
      makeResource({ author: { name: "Anthropic" } }),
      {
        role: "primary",
        relevanceScore: 90,
        editorialStatus: "verified",
        verificationStatus: "verified",
        lastVerifiedAt: now,
      }
    );
    expect(breakdown).toMatchObject({
      primary: 40,
      officialDocumentation: 35,
      originalAuthor: 30,
      verified: 25,
      highRelevance: 20,
      recentlyVerified: 10,
      practical: 0,
      deprecated: 0,
      unverified: 0,
    });
    expect(breakdown.total).toBe(160);
  });

  it("penalizes deprecated and unverified resources", () => {
    const breakdown = scoreResourceSignals(makeResource(), {
      role: "reference",
      relevanceScore: 40,
      editorialStatus: "deprecated",
      verificationStatus: "unverified",
    });
    expect(breakdown.deprecated).toBe(-100);
    expect(breakdown.unverified).toBe(-20);
    expect(breakdown.total).toBe(35 - 120);
  });

  it("awards the practical bonus for repos, starters and labs", () => {
    for (const type of ["github_repo", "project_starter", "interactive_lab"] as const) {
      const breakdown = scoreResourceSignals(makeResource({ type }), {
        role: "supplementary",
        relevanceScore: 50,
        editorialStatus: "pending_review",
        verificationStatus: "reachable",
      });
      expect(breakdown.practical).toBe(15);
    }
  });

  it("recognizes original authors via organization and channel name", () => {
    expect(
      scoreResourceSignals(makeResource({ author: { name: "X", organization: "OpenAI" } }), {
        role: "supplementary",
        relevanceScore: 0,
        editorialStatus: "verified",
        verificationStatus: "reachable",
      }).originalAuthor
    ).toBe(30);

    expect(
      scoreResourceSignals(makeResource({ youtube: { channel_name: "3Blue1Brown" } }), {
        role: "supplementary",
        relevanceScore: 0,
        editorialStatus: "verified",
        verificationStatus: "reachable",
      }).originalAuthor
    ).toBe(30);
  });

  it("ignores stale verification dates", () => {
    const stale = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const breakdown = scoreResourceSignals(makeResource(), {
      role: "supplementary",
      relevanceScore: 0,
      editorialStatus: "verified",
      verificationStatus: "verified",
      lastVerifiedAt: stale,
    });
    expect(breakdown.recentlyVerified).toBe(0);
  });

  it("scoreResource equals the breakdown total", () => {
    const resource = makeResource({ author: { name: "OpenAI" } });
    const signals = {
      role: "primary" as const,
      relevanceScore: 85,
      editorialStatus: "verified",
      verificationStatus: "verified" as const,
      lastVerifiedAt: now,
    };
    expect(scoreResource(resource, signals)).toBe(
      scoreResourceSignals(resource, signals).total
    );
  });

  it("rankItems orders by recommended, then order_index, then score, then title", () => {
    const items: RankableItem<{ title: string }>[] = [
      { resource: { title: "A" }, role: "supplementary", relevanceScore: 0, orderIndex: 2, recommended: false, score: 10, title: "A" },
      { resource: { title: "B" }, role: "supplementary", relevanceScore: 0, orderIndex: 5, recommended: true, score: 0, title: "B" },
      { resource: { title: "C" }, role: "supplementary", relevanceScore: 0, orderIndex: 1, recommended: false, score: 50, title: "C" },
      { resource: { title: "D" }, role: "supplementary", relevanceScore: 0, orderIndex: 0, recommended: false, score: 999, title: "D" },
    ];
    const ordered = rankItems(items).map((i) => i.title);
    expect(ordered).toEqual(["B", "C", "A", "D"]);
  });

  it("rankItems breaks order_index ties by score descending then title", () => {
    const items: RankableItem<{ title: string }>[] = [
      { resource: { title: "low" }, role: "reference", relevanceScore: 0, orderIndex: 0, recommended: false, score: 5, title: "low" },
      { resource: { title: "high" }, role: "reference", relevanceScore: 0, orderIndex: 0, recommended: false, score: 7, title: "high" },
      { resource: { title: "alpha" }, role: "reference", relevanceScore: 0, orderIndex: 0, recommended: false, score: 7, title: "alpha" },
    ];
    const ordered = rankItems(items).map((i) => i.title);
    expect(ordered).toEqual(["alpha", "high", "low"]);
  });
});
