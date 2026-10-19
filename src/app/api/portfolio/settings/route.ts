import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import {
  loadPortfolioSettings,
  savePortfolioSettings,
  usernameTakenByOther,
} from "@/lib/portfolio/profile";
import { validateSlug } from "@/lib/portfolio/slug";
import type { PublicityJson } from "@/lib/portfolio/types";

export const runtime = "nodejs";

const PutSchema = z.object({
  portfolioEnabled: z.boolean().optional(),
  username: z.string().max(40).nullable().optional(),
  displayName: z.string().max(120).nullable().optional(),
  bio: z.string().max(400).nullable().optional(),
  visibility: z.record(z.string(), z.boolean()).optional(),
  publicProjectIds: z.array(z.string().max(200)).max(50).optional(),
  publicEvidenceIds: z.array(z.string().max(200)).max(200).optional(),
  publicAchievementIds: z.array(z.string().max(200)).max(50).optional(),
  publicSkillIds: z.array(z.string().max(120)).max(200).optional(),
  careerTrackId: z.string().max(100).nullable().optional(),
  published: z.boolean().optional(),
});

/** GET /api/portfolio/settings — current learner's publication settings. */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ authenticated: false, settings: null }, { status: 200 });
  }
  try {
    const settings = await loadPortfolioSettings(userId);
    return NextResponse.json({ authenticated: true, settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

/** PUT /api/portfolio/settings — update publication configuration. */
export async function PUT(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    // §34 — guests cannot persist cloud portfolio settings.
    return NextResponse.json(
      { error: "Sign in to save portfolio settings. Guests can keep a local draft." },
      { status: 401 }
    );
  }
  const parsed = PutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsed.data;
  try {
    if (body.username) {
      const validation = validateSlug(body.username);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }
    }
    if (body.username && (await usernameTakenByOther(body.username, userId))) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    const publicity: PublicityJson | undefined = body.visibility
      ? {
          visibility: {
            careerTrack: body.visibility.careerTrack ?? false,
            skills: body.visibility.skills ?? false,
            projects: body.visibility.projects ?? false,
            achievements: body.visibility.achievements ?? false,
            curriculumProgress: body.visibility.curriculumProgress ?? false,
            studyTime: body.visibility.studyTime ?? false,
            assessments: body.visibility.assessments ?? false,
            exposeSelfAssessment: body.visibility.exposeSelfAssessment ?? false,
            exposeProjectLinks: body.visibility.exposeProjectLinks ?? false,
          },
          publicProjectIds: body.publicProjectIds ?? [],
          publicEvidenceIds: body.publicEvidenceIds ?? [],
          publicAchievementIds: body.publicAchievementIds ?? [],
          publicSkillIds: body.publicSkillIds ?? [],
          careerTrackId: body.careerTrackId ?? null,
        }
      : undefined;
    const settings = await savePortfolioSettings(userId, {
      portfolioEnabled: body.portfolioEnabled,
      username: body.username,
      displayName: body.displayName,
      bio: body.bio,
      publicity,
      published: body.published,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status }
    );
  }
}
