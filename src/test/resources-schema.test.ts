import { describe, it, expect } from "vitest";
import { validateCatalogFile } from "@/lib/resources/schema";

const validDoc = {
  id: "pytorch-docs",
  type: "official_documentation",
  title: "PyTorch Documentation",
  canonical_url: "https://pytorch.org/docs/stable/",
  editorial_status: "verified",
  associated_lessons: ["03-deep-learning-core/01-tensors"],
};

describe("Resource catalog schema", () => {
  it("accepts a minimal valid resource and applies defaults", () => {
    const { resources, issues } = validateCatalogFile("test.json", validDoc);
    expect(issues).toEqual([]);
    expect(resources).toHaveLength(1);
    const r = resources[0];
    expect(r.language).toBe("en");
    expect(r.difficulty).toBe("all_levels");
    expect(r.verification_status).toBe("unverified");
    expect(r.tags).toEqual([]);
    expect(r.associated_lessons[0]).toMatchObject({
      lesson: "03-deep-learning-core/01-tensors",
      role: "supplementary",
      relevance_score: 50,
      order_index: 0,
      recommended: false,
    });
  });

  it("accepts a JSON array of resources", () => {
    const { resources, issues } = validateCatalogFile("multi.json", [
      validDoc,
      { ...validDoc, id: "numpy-docs", title: "NumPy Docs", canonical_url: "https://numpy.org/doc/stable/" },
    ]);
    expect(issues).toEqual([]);
    expect(resources).toHaveLength(2);
  });

  it("preserves explicit lesson-link objects", () => {
    const { resources } = validateCatalogFile("test.json", {
      ...validDoc,
      associated_lessons: [
        {
          lesson: "03-deep-learning-core/01-tensors",
          role: "primary",
          relevance_score: 95,
          order_index: 1,
          recommended: true,
          notes: "Core reference",
        },
      ],
    });
    expect(resources[0].associated_lessons[0]).toMatchObject({
      role: "primary",
      relevance_score: 95,
      order_index: 1,
      recommended: true,
      notes: "Core reference",
    });
  });

  it("rejects an invalid kebab-case id", () => {
    const { issues, resources } = validateCatalogFile("bad.json", {
      ...validDoc,
      id: "PyTorch_Docs",
    });
    expect(resources).toHaveLength(0);
    expect(issues.some((i) => i.path === "id")).toBe(true);
  });

  it("rejects a youtube_video without a youtube block", () => {
    const { issues } = validateCatalogFile("yt.json", {
      ...validDoc,
      id: "some-video",
      type: "youtube_video",
    });
    expect(issues.some((i) => i.message.includes('requires a "youtube" metadata block'))).toBe(
      true
    );
  });

  it("rejects a youtube_video missing video_id", () => {
    const { issues } = validateCatalogFile("yt.json", {
      ...validDoc,
      id: "some-video",
      type: "youtube_video",
      youtube: { channel_name: "Some Channel" },
    });
    expect(issues.some((i) => i.path === "youtube.video_id")).toBe(true);
  });

  it("accepts a fully specified youtube_video", () => {
    const { resources, issues } = validateCatalogFile("yt.json", {
      ...validDoc,
      id: "karpathy-gpt",
      type: "youtube_video",
      title: "Let's build GPT",
      canonical_url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
      youtube: { video_id: "kCc8FmEb1nY", channel_name: "Andrej Karpathy" },
    });
    expect(issues).toEqual([]);
    expect(resources[0].youtube?.video_id).toBe("kCc8FmEb1nY");
  });

  it("rejects a github_repo without a github block", () => {
    const { issues } = validateCatalogFile("gh.json", {
      ...validDoc,
      id: "some-repo",
      type: "github_repo",
    });
    expect(issues.some((i) => i.message.includes('requires a "github" metadata block'))).toBe(
      true
    );
  });

  it("rejects a research_paper without a paper block", () => {
    const { issues } = validateCatalogFile("paper.json", {
      ...validDoc,
      id: "some-paper",
      type: "research_paper",
    });
    expect(issues.some((i) => i.message.includes('requires a "paper" metadata block'))).toBe(
      true
    );
  });

  it("rejects an invalid lesson key in associated_lessons", () => {
    const { issues } = validateCatalogFile("lk.json", {
      ...validDoc,
      associated_lessons: ["not-a-valid-key"],
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].path.startsWith("associated_lessons")).toBe(true);
  });

  it("rejects a non-URL canonical_url", () => {
    const { issues } = validateCatalogFile("url.json", {
      ...validDoc,
      canonical_url: "pytorch.org/docs",
    });
    expect(issues.some((i) => i.path === "canonical_url")).toBe(true);
  });
});
