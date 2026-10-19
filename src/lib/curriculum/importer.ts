import { db } from "@/db";
import {
  curriculumSources,
  curriculumRevisions,
  canonicalPhases,
  phaseRevisions,
  canonicalLessons,
  lessonRevisions,
  lessonAliases,
  quizzes,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parseAllPhases } from "./parser";

export interface ImportOptions {
  repoPath: string;
  commitSha: string;
  versionTag?: string;
  sourceUrl?: string;
  authorAttribution?: string;
}

export interface ImportResult {
  commitSha: string;
  sourceId: string;
  revisionId: string;
  phaseCount: number;
  lessonCount: number;
  quizCount: number;
  codeFilesCount: number;
  isIdempotentRun: boolean;
  durationMs: number;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 600): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const errorObj = err as { message?: string; code?: string } | undefined;
      const message = errorObj?.message || "";
      const code = errorObj?.code || "";
      if (
        attempt >= retries ||
        (!message.includes("ECONNRESET") &&
          !message.includes("connection") &&
          !message.includes("timeout") &&
          !code.includes("ECONNRESET"))
      ) {
        throw err;
      }
      console.warn(`Database connection dropped. Retrying (attempt ${attempt}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

export async function importCurriculum(
  options: ImportOptions
): Promise<ImportResult> {
  const startTime = Date.now();
  const {
    repoPath,
    commitSha,
    versionTag = "pinned-mvp",
    sourceUrl = "https://github.com/rohitg00/ai-engineering-from-scratch.git",
    authorAttribution = "Rohit Ghumare (MIT License)",
  } = options;

  console.log(`Starting curriculum import for commit ${commitSha.slice(0, 8)}...`);

  // 1. Ensure curriculum_sources record
  const existingSources = await withRetry(() =>
    db
      .select()
      .from(curriculumSources)
      .where(eq(curriculumSources.repositoryUrl, sourceUrl))
      .limit(1)
  );

  let sourceId: string;
  if (existingSources.length > 0) {
    sourceId = existingSources[0].id;
  } else {
    const [newSource] = await withRetry(() =>
      db
        .insert(curriculumSources)
        .values({
          name: "ai-engineering-from-scratch",
          repositoryUrl: sourceUrl,
          defaultBranch: "main",
          licenseSpdx: "MIT",
          authorAttribution,
        })
        .returning()
    );
    sourceId = newSource.id;
  }

  // 2. Check if curriculum revision already exists
  const existingRevs = await withRetry(() =>
    db
      .select()
      .from(curriculumRevisions)
      .where(
        and(
          eq(curriculumRevisions.sourceId, sourceId),
          eq(curriculumRevisions.commitSha, commitSha)
        )
      )
      .limit(1)
  );

  let revisionId: string;
  let isIdempotentRun = false;

  if (existingRevs.length > 0) {
    isIdempotentRun = true;
    revisionId = existingRevs[0].id;
    console.log(`Revision ${commitSha.slice(0, 8)} already registered.`);
  } else {
    const [newRev] = await withRetry(() =>
      db
        .insert(curriculumRevisions)
        .values({
          sourceId,
          commitSha,
          versionTag,
          isActive: true,
        })
        .returning()
    );
    revisionId = newRev.id;
  }

  // 3. Parse phases & lessons from disk
  const parsedPhases = parseAllPhases(repoPath);
  console.log(`Parsed ${parsedPhases.length} phases from disk.`);

  let totalLessons = 0;
  let totalQuizzes = 0;
  let totalCodeFiles = 0;

  // Process each phase
  for (const phase of parsedPhases) {
    console.log(
      `Processing Phase ${String(phase.phaseNumber).padStart(2, "0")}: ${phase.title} (${phase.lessons.length} lessons)...`
    );

    // Upsert canonical_phases
    const existingPhases = await withRetry(() =>
      db
        .select()
        .from(canonicalPhases)
        .where(eq(canonicalPhases.permanentKey, phase.permanentKey))
        .limit(1)
    );

    let canonicalPhaseId: string;
    if (existingPhases.length > 0) {
      canonicalPhaseId = existingPhases[0].id;
      await withRetry(() =>
        db
          .update(canonicalPhases)
          .set({
            defaultSlug: phase.slug,
            defaultTitle: phase.title,
            updatedAt: new Date(),
          })
          .where(eq(canonicalPhases.id, canonicalPhaseId))
      );
    } else {
      const [newP] = await withRetry(() =>
        db
          .insert(canonicalPhases)
          .values({
            phaseNumber: phase.phaseNumber,
            permanentKey: phase.permanentKey,
            defaultSlug: phase.slug,
            defaultTitle: phase.title,
          })
          .returning()
      );
      canonicalPhaseId = newP.id;
    }

    // Upsert phase_revisions
    const existingPhaseRev = await withRetry(() =>
      db
        .select()
        .from(phaseRevisions)
        .where(
          and(
            eq(phaseRevisions.revisionId, revisionId),
            eq(phaseRevisions.canonicalPhaseId, canonicalPhaseId)
          )
        )
        .limit(1)
    );

    if (existingPhaseRev.length > 0) {
      await withRetry(() =>
        db
          .update(phaseRevisions)
          .set({
            slug: phase.slug,
            title: phase.title,
            description: phase.description,
            orderIndex: phase.phaseNumber,
          })
          .where(eq(phaseRevisions.id, existingPhaseRev[0].id))
      );
    } else {
      await withRetry(() =>
        db.insert(phaseRevisions).values({
          revisionId,
          canonicalPhaseId,
          slug: phase.slug,
          title: phase.title,
          description: phase.description,
          orderIndex: phase.phaseNumber,
        })
      );
    }

    // Process lessons within this phase
    for (const lesson of phase.lessons) {
      totalLessons++;
      totalCodeFiles += lesson.codeFiles.length;

      // Match within a phase. Identical content can intentionally represent
      // distinct curriculum lessons in different phases.
      const existingLessons = await withRetry(() =>
        db
          .select()
          .from(canonicalLessons)
          .where(
            and(
              eq(canonicalLessons.contentHash, lesson.contentHash),
              eq(canonicalLessons.canonicalPhaseId, canonicalPhaseId)
            )
          )
          .limit(1)
      );

      let canonicalLessonId: string;

      if (existingLessons.length > 0) {
        // RETAIN PERMANENT IMMUTABLE UUID
        canonicalLessonId = existingLessons[0].id;

        // If slug changed, record historical alias
        if (existingLessons[0].currentSlug !== lesson.slug) {
          const existingAlias = await withRetry(() =>
            db
              .select()
              .from(lessonAliases)
              .where(eq(lessonAliases.aliasSlug, existingLessons[0].currentSlug))
              .limit(1)
          );

          if (existingAlias.length === 0) {
            await withRetry(() =>
              db.insert(lessonAliases).values({
                canonicalLessonId,
                aliasSlug: existingLessons[0].currentSlug,
              })
            );
          }
        }

        // Update mutable attributes
        await withRetry(() =>
          db
            .update(canonicalLessons)
            .set({
              canonicalPhaseId,
              currentSlug: lesson.slug,
              defaultTitle: lesson.title,
              tagline: lesson.tagline,
              difficulty: lesson.difficulty,
              estimatedMinutes: lesson.estimatedMinutes,
              updatedAt: new Date(),
            })
            .where(eq(canonicalLessons.id, canonicalLessonId))
        );
      } else {
        // Insert new canonical lesson with immutable UUID
        const [newL] = await withRetry(() =>
          db
            .insert(canonicalLessons)
            .values({
              canonicalPhaseId,
              contentHash: lesson.contentHash,
              currentSlug: lesson.slug,
              defaultTitle: lesson.title,
              tagline: lesson.tagline,
              difficulty: lesson.difficulty,
              estimatedMinutes: lesson.estimatedMinutes,
            })
            .returning()
        );
        canonicalLessonId = newL.id;
      }

      // Upsert lesson_revisions
      const existingLessonRev = await withRetry(() =>
        db
          .select()
          .from(lessonRevisions)
          .where(
            and(
              eq(lessonRevisions.revisionId, revisionId),
              eq(lessonRevisions.canonicalLessonId, canonicalLessonId)
            )
          )
          .limit(1)
      );

      if (existingLessonRev.length > 0) {
        await withRetry(() =>
          db
            .update(lessonRevisions)
            .set({
              title: lesson.title,
              markdownContent: lesson.markdownContent,
              markdownHash: lesson.markdownHash,
              lessonType: lesson.lessonType,
              languages: lesson.languages,
              learningObjectives: lesson.learningObjectives,
              hasCode: lesson.hasCode,
              hasQuiz: lesson.hasQuiz,
              hasNotebook: lesson.hasNotebook,
              codeFiles: lesson.codeFiles,
              outputs: lesson.outputs,
            })
            .where(eq(lessonRevisions.id, existingLessonRev[0].id))
        );
      } else {
        await withRetry(() =>
          db.insert(lessonRevisions).values({
            revisionId,
            canonicalLessonId,
            title: lesson.title,
            markdownContent: lesson.markdownContent,
            markdownHash: lesson.markdownHash,
            lessonType: lesson.lessonType,
            languages: lesson.languages,
            learningObjectives: lesson.learningObjectives,
            hasCode: lesson.hasCode,
            hasQuiz: lesson.hasQuiz,
            hasNotebook: lesson.hasNotebook,
            codeFiles: lesson.codeFiles,
            outputs: lesson.outputs,
          })
        );
      }

      // Handle Quizzes
      if (lesson.quizzes.length > 0) {
        await withRetry(() =>
          db.delete(quizzes).where(eq(quizzes.canonicalLessonId, canonicalLessonId))
        );

        for (const q of lesson.quizzes) {
          totalQuizzes++;
          await withRetry(() =>
            db.insert(quizzes).values({
              canonicalLessonId,
              stage: q.stage,
              questionOrder: q.questionOrder,
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
            })
          );
        }
      }
    }
  }

  // 4. Update curriculum_revisions totals
  await withRetry(() =>
    db
      .update(curriculumRevisions)
      .set({
        phaseCount: parsedPhases.length,
        lessonCount: totalLessons,
        rawTotals: {
          phases: parsedPhases.length,
          lessons: totalLessons,
          quizzes: totalQuizzes,
          codeFiles: totalCodeFiles,
        },
      })
      .where(eq(curriculumRevisions.id, revisionId))
  );

  const durationMs = Date.now() - startTime;
  console.log(
    `Import finished in ${durationMs}ms: ${parsedPhases.length} phases, ${totalLessons} lessons, ${totalQuizzes} quizzes, ${totalCodeFiles} code files.`
  );

  return {
    commitSha,
    sourceId,
    revisionId,
    phaseCount: parsedPhases.length,
    lessonCount: totalLessons,
    quizCount: totalQuizzes,
    codeFilesCount: totalCodeFiles,
    isIdempotentRun,
    durationMs,
  };
}
