import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  bookmarks,
  devices,
  notes,
  portfolioProfiles,
  projectEvidence,
  projectProgress,
  projectSelfAssessments,
  quizAttempts,
  roadmapState,
  reviewHistory,
  sessions,
  studySessions,
  syncBatches,
  syncConflicts,
  tombstones,
  userLessonProgress,
  userResourceProgress,
  users,
} from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function DELETE() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(projectEvidence).where(eq(projectEvidence.userId, userId));
      await tx.delete(projectSelfAssessments).where(eq(projectSelfAssessments.userId, userId));
      await tx.delete(projectProgress).where(eq(projectProgress.userId, userId));
      await tx.delete(userLessonProgress).where(eq(userLessonProgress.userId, userId));
      await tx.delete(userResourceProgress).where(eq(userResourceProgress.userId, userId));
      await tx.delete(notes).where(eq(notes.userId, userId));
      await tx.delete(bookmarks).where(eq(bookmarks.userId, userId));
      await tx.delete(studySessions).where(eq(studySessions.userId, userId));
      await tx.delete(quizAttempts).where(eq(quizAttempts.userId, userId));
      await tx.delete(roadmapState).where(eq(roadmapState.userId, userId));
      await tx.delete(reviewHistory).where(eq(reviewHistory.userId, userId));
      await tx.delete(syncBatches).where(eq(syncBatches.userId, userId));
      await tx.delete(syncConflicts).where(eq(syncConflicts.userId, userId));
      await tx.delete(tombstones).where(eq(tombstones.userId, userId));
      await tx.delete(portfolioProfiles).where(eq(portfolioProfiles.userId, userId));
      await tx.delete(devices).where(eq(devices.userId, userId));
      await tx.delete(accounts).where(eq(accounts.userId, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Account deletion failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Account deletion failed" }, { status: 500 });
  }
}
