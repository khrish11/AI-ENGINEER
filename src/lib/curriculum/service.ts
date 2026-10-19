import { db } from "@/db";
import {
  canonicalPhases,
  canonicalLessons,
  lessonRevisions,
  curriculumRevisions,
  quizzes,
  lessonAliases,
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";

export interface PhaseSummary {
  id: string;
  phaseNumber: number;
  permanentKey: string;
  slug: string;
  title: string;
  description: string;
  lessonCount: number;
  lessonIds: string[];
  totalEstimatedMinutes: number;
  status: "Completed" | "In Progress" | "Not Started";
}

export interface LessonSummary {
  id: string;
  canonicalPhaseId: string;
  phaseNumber: number;
  phaseSlug: string;
  slug: string;
  lessonSlug: string;
  title: string;
  tagline: string | null;
  difficulty: string;
  estimatedMinutes: number;
  lessonType: string;
  languages: string[];
  hasCode: boolean;
  hasQuiz: boolean;
  hasNotebook: boolean;
}

export interface LessonDetail extends LessonSummary {
  markdownContent: string;
  markdownHash: string;
  contentHash: string;
  learningObjectives: string[];
  codeFiles: Array<{
    filename: string;
    relativePath: string;
    language: string;
    sizeBytes: number;
    content?: string;
  }>;
  quizzes: Array<{
    id: string;
    stage: string;
    questionOrder: number;
    questionText: string;
    options: string[];
    correctAnswer: number;
    explanation: string | null;
  }>;
  upstreamAttribution: {
    repoUrl: string;
    commitSha: string;
    sourceFileUrl: string;
    author: string;
    license: string;
  };
}

export async function getCurriculumStats() {
  try {
    const [phaseCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(canonicalPhases);

    const [lessonCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(canonicalLessons);

    const [quizCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizzes);

    const activeRev = await db
      .select()
      .from(curriculumRevisions)
      .where(eq(curriculumRevisions.isActive, true))
      .limit(1);

    return {
      phaseCount: phaseCountRes?.count ?? 20,
      lessonCount: lessonCountRes?.count ?? 0,
      quizCount: quizCountRes?.count ?? 0,
      activeRevision: activeRev[0] ?? null,
    };
  } catch (error) {
    console.warn("Failed to fetch curriculum stats from database:", error);
    return {
      phaseCount: 20,
      lessonCount: 0,
      quizCount: 0,
      activeRevision: null,
    };
  }
}

export async function getAllPhases(): Promise<PhaseSummary[]> {
  try {
    const phases = await db
      .select()
      .from(canonicalPhases)
      .orderBy(asc(canonicalPhases.phaseNumber));

    // Get lesson counts and hours per phase dynamically
    const phaseSummaries: PhaseSummary[] = [];

    for (const p of phases) {
      const lessons = await db
        .select({
          id: canonicalLessons.id,
          estimatedMinutes: canonicalLessons.estimatedMinutes,
        })
        .from(canonicalLessons)
        .where(eq(canonicalLessons.canonicalPhaseId, p.id));

      const totalMinutes = lessons.reduce(
        (sum, l) => sum + (l.estimatedMinutes || 45),
        0
      );

      phaseSummaries.push({
        id: p.id,
        phaseNumber: p.phaseNumber,
        permanentKey: p.permanentKey,
        slug: p.defaultSlug,
        title: p.defaultTitle,
        description: "",
        lessonCount: lessons.length,
        lessonIds: lessons.map((l) => l.id),
        totalEstimatedMinutes: totalMinutes,
        status: "Not Started",
      });
    }

    return phaseSummaries;
  } catch (error) {
    console.warn("Failed to fetch phases from database:", error);
    return [];
  }
}

export async function getPhaseDetails(phaseSlug: string) {
  try {
    const [phase] = await db
      .select()
      .from(canonicalPhases)
      .where(eq(canonicalPhases.defaultSlug, phaseSlug))
      .limit(1);

    if (!phase) return null;

    const lessons = await db
      .select({
        id: canonicalLessons.id,
        canonicalPhaseId: canonicalLessons.canonicalPhaseId,
        currentSlug: canonicalLessons.currentSlug,
        defaultTitle: canonicalLessons.defaultTitle,
        tagline: canonicalLessons.tagline,
        difficulty: canonicalLessons.difficulty,
        estimatedMinutes: canonicalLessons.estimatedMinutes,
      })
      .from(canonicalLessons)
      .where(eq(canonicalLessons.canonicalPhaseId, phase.id));

    // Get revision metadata for these lessons
    const activeRev = await db
      .select()
      .from(curriculumRevisions)
      .where(eq(curriculumRevisions.isActive, true))
      .limit(1);

    const lessonSummaries: LessonSummary[] = [];

    for (const l of lessons) {
      const slugParts = l.currentSlug.split("/");
      const lessonFolder = slugParts[slugParts.length - 1];

      let revData: {
        lessonType: string;
        languages: string[];
        hasCode: boolean;
        hasQuiz: boolean;
        hasNotebook: boolean;
      } | null = null;
      if (activeRev[0]) {
        const [rev] = await db
          .select({
            lessonType: lessonRevisions.lessonType,
            languages: lessonRevisions.languages,
            hasCode: lessonRevisions.hasCode,
            hasQuiz: lessonRevisions.hasQuiz,
            hasNotebook: lessonRevisions.hasNotebook,
          })
          .from(lessonRevisions)
          .where(
            and(
              eq(lessonRevisions.revisionId, activeRev[0].id),
              eq(lessonRevisions.canonicalLessonId, l.id)
            )
          )
          .limit(1);
        revData = rev ?? null;
      }

      lessonSummaries.push({
        id: l.id,
        canonicalPhaseId: l.canonicalPhaseId,
        phaseNumber: phase.phaseNumber,
        phaseSlug: phase.defaultSlug,
        slug: l.currentSlug,
        lessonSlug: lessonFolder,
        title: l.defaultTitle,
        tagline: l.tagline,
        difficulty: l.difficulty,
        estimatedMinutes: l.estimatedMinutes,
        lessonType: revData?.lessonType || "Build",
        languages: revData?.languages || [],
        hasCode: revData?.hasCode ?? false,
        hasQuiz: revData?.hasQuiz ?? false,
        hasNotebook: revData?.hasNotebook ?? false,
      });
    }

    // Sort lessons by lessonSlug or order
    lessonSummaries.sort((a, b) => a.slug.localeCompare(b.slug));

    return {
      phase: {
        id: phase.id,
        phaseNumber: phase.phaseNumber,
        permanentKey: phase.permanentKey,
        slug: phase.defaultSlug,
        title: phase.defaultTitle,
        lessonCount: lessonSummaries.length,
      },
      lessons: lessonSummaries,
    };
  } catch (error) {
    console.warn("Failed to get phase details:", error);
    return null;
  }
}

export async function getLessonDetails(
  phaseSlug: string,
  lessonSlug: string
): Promise<LessonDetail | null> {
  try {
    const fullSlug = `${phaseSlug}/${lessonSlug}`;

    // 1. Look up canonical lesson by current_slug or lesson_aliases
    let [lesson] = await db
      .select()
      .from(canonicalLessons)
      .where(eq(canonicalLessons.currentSlug, fullSlug))
      .limit(1);

    if (!lesson) {
      // Check aliases
      const [alias] = await db
        .select()
        .from(lessonAliases)
        .where(eq(lessonAliases.aliasSlug, fullSlug))
        .limit(1);

      if (alias) {
        [lesson] = await db
          .select()
          .from(canonicalLessons)
          .where(eq(canonicalLessons.id, alias.canonicalLessonId))
          .limit(1);
      }
    }

    if (!lesson) return null;

    // 2. Look up phase
    const [phase] = await db
      .select()
      .from(canonicalPhases)
      .where(eq(canonicalPhases.id, lesson.canonicalPhaseId))
      .limit(1);

    // 3. Look up active revision
    const [activeRev] = await db
      .select()
      .from(curriculumRevisions)
      .where(eq(curriculumRevisions.isActive, true))
      .limit(1);

    // 4. Look up lesson revision
    const [rev] = await db
      .select()
      .from(lessonRevisions)
      .where(
        and(
          activeRev ? eq(lessonRevisions.revisionId, activeRev.id) : sql`true`,
          eq(lessonRevisions.canonicalLessonId, lesson.id)
        )
      )
      .limit(1);

    // 5. Look up quizzes
    const quizList = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.canonicalLessonId, lesson.id))
      .orderBy(asc(quizzes.questionOrder));

    const commitSha = activeRev?.commitSha || "c81651a83aff5f7bf307ffe4392f0d97f3b27ad6";
    const sourceFileUrl = `https://github.com/rohitg00/ai-engineering-from-scratch/blob/${commitSha}/phases/${fullSlug}/docs/en.md`;

    return {
      id: lesson.id,
      canonicalPhaseId: lesson.canonicalPhaseId,
      phaseNumber: phase?.phaseNumber ?? 0,
      phaseSlug: phase?.defaultSlug ?? phaseSlug,
      slug: lesson.currentSlug,
      lessonSlug,
      title: rev?.title || lesson.defaultTitle,
      tagline: lesson.tagline,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      lessonType: rev?.lessonType || "Build",
      languages: rev?.languages || [],
      markdownContent: rev?.markdownContent || "# " + lesson.defaultTitle,
      markdownHash: rev?.markdownHash || "",
      contentHash: lesson.contentHash,
      learningObjectives: rev?.learningObjectives || [],
      hasCode: rev?.hasCode ?? false,
      hasQuiz: rev?.hasQuiz ?? false,
      hasNotebook: rev?.hasNotebook ?? false,
      codeFiles: (rev?.codeFiles as LessonDetail["codeFiles"]) || [],
      quizzes: quizList.map((q) => ({
        id: q.id,
        stage: q.stage,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        options: (q.options as string[]) || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
      upstreamAttribution: {
        repoUrl: "https://github.com/rohitg00/ai-engineering-from-scratch",
        commitSha,
        sourceFileUrl,
        author: "Rohit Ghumare",
        license: "MIT License",
      },
    };
  } catch (error) {
    console.warn("Failed to get lesson details:", error);
    return null;
  }
}
