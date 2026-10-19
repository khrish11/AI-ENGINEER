import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownViewer } from "@/components/curriculum/markdown-viewer";
import { QuizRunner } from "@/components/curriculum/quiz-runner";
import { CodeViewer } from "@/components/curriculum/code-viewer";
import { NotesWorkspace } from "@/components/curriculum/notes-workspace";
import { ResourceList } from "@/components/resources/resource-list";
import {
  LessonOverviewProgress,
  LessonProgressControls,
} from "@/components/curriculum/lesson-progress-controls";
import { LessonProjectsPanel } from "@/components/curriculum/lesson-projects-panel";
import { getLessonDetails, getPhaseDetails } from "@/lib/curriculum/service";
import { getResourcesForLesson } from "@/lib/resources/service";
import { getProjectsForPhase } from "@/lib/projects/catalog";
import {
  BookOpen,
  Clock,
  Code2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Video,
  FileText,
  HelpCircle,
  FolderKanban,
  FileCode2,
  CheckCircle2,
  Library,
} from "lucide-react";

interface LessonPageProps {
  params: Promise<{
    phaseSlug: string;
    lessonSlug: string;
  }>;
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { phaseSlug, lessonSlug } = await params;
  const lesson = await getLessonDetails(phaseSlug, lessonSlug);
  if (!lesson) return { title: "Lesson Not Found | AI Engineer OS" };
  return {
    title: `${lesson.title} | AI Engineer OS`,
    description: lesson.tagline ?? lesson.title,
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { phaseSlug, lessonSlug } = await params;

  const lesson = await getLessonDetails(phaseSlug, lessonSlug);
  if (!lesson) {
    notFound();
  }

  const phaseInfo = await getPhaseDetails(phaseSlug);
  const lessonsList = phaseInfo?.lessons || [];
  const currentIndex = lessonsList.findIndex((l) => l.lessonSlug === lessonSlug);
  const prevLesson = currentIndex > 0 ? lessonsList[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < lessonsList.length - 1
      ? lessonsList[currentIndex + 1]
      : null;

  // Curated learning resources attached to this lesson (Phase 3 registry).
  const lessonResources = await getResourcesForLesson(lesson.id);
  const videoResources = lessonResources.filter(
    (r) => r.type === "youtube_video" || r.type === "youtube_playlist"
  );
  const repoResources = lessonResources.filter(
    (r) => r.type === "github_repo" || r.type === "project_starter"
  );
  const mappedProjects = getProjectsForPhase(phaseSlug);
  const legacyNumberedProjects = mappedProjects.length > 0 ? mappedProjects : [];

  // Completion rules adapt to what this specific lesson actually contains.
  const availability = {
    hasVideo: videoResources.length > 0,
    hasQuiz: lesson.quizzes.length > 0,
    hasProject: mappedProjects.length > 0,
    hasResources: lessonResources.length > 0,
  };

  const lessonHref = `/curriculum/${phaseSlug}/${lessonSlug}`;

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 space-y-6 max-w-6xl">
        {/* Sticky Lesson Workspace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/curriculum/${phaseSlug}`}
                className="text-xs font-mono font-semibold text-accent-cyan hover:underline"
              >
                Phase {String(lesson.phaseNumber).padStart(2, "0")}
              </Link>
              <span className="text-muted-foreground/60">•</span>
              <Badge
                variant={
                  lesson.difficulty === "Beginner"
                    ? "success"
                    : lesson.difficulty === "Intermediate"
                      ? "info"
                      : "warning"
                }
              >
                {lesson.difficulty}
              </Badge>
              <Badge variant="muted">{lesson.lessonType}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {lesson.estimatedMinutes} mins
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {lesson.title}
            </h1>
            {lesson.tagline && (
              <p className="text-xs sm:text-sm text-muted-foreground italic">
                {lesson.tagline}
              </p>
            )}
          </div>

          {/* Navigation Controls (Prev / Next) */}
          <div className="flex items-center gap-2 shrink-0">
            {prevLesson ? (
              <Link href={`/curriculum/${phaseSlug}/${prevLesson.lessonSlug}`}>
                <Button size="sm" variant="secondary" className="gap-1 text-xs">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="secondary" disabled className="gap-1 text-xs">
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
            )}

            {nextLesson ? (
              <Link href={`/curriculum/${phaseSlug}/${nextLesson.lessonSlug}`}>
                <Button size="sm" variant="default" className="gap-1 text-xs">
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Link href={`/curriculum/${phaseSlug}`}>
                <Button size="sm" variant="default" className="gap-1 text-xs">
                  Finish Phase <CheckCircle2 className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Upstream Attribution Banner */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-accent-cyan shrink-0" />
            <div className="text-muted-foreground">
              <span>Source: </span>
              <strong className="text-foreground">{lesson.upstreamAttribution.author}</strong>
              <span> ({lesson.upstreamAttribution.license})</span>
              <span className="hidden sm:inline"> • Commit: </span>
              <code className="hidden sm:inline font-mono px-1 py-0.5 rounded bg-surface border border-border text-[10px]">
                {lesson.upstreamAttribution.commitSha.slice(0, 8)}
              </code>
            </div>
          </div>
          <a
            href={lesson.upstreamAttribution.sourceFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-cyan hover:underline font-medium shrink-0"
          >
            <span>View Upstream Markdown on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <LessonProgressControls
          lessonId={lesson.id}
          title={lesson.title}
          phaseSlug={phaseSlug}
          phaseNumber={lesson.phaseNumber}
          href={lessonHref}
          availability={availability}
        />

        {/* Tabbed Lesson Workspace: Overview, Read, Videos, GitHub, Practice, Projects, Notes */}
        <Tabs defaultValue="read" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
              <BookOpen className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="read" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5" /> Read
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5 text-xs sm:text-sm">
              <Video className="w-3.5 h-3.5" /> Videos
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-1.5 text-xs sm:text-sm">
              <FileCode2 className="w-3.5 h-3.5" /> GitHub Code ({lesson.codeFiles.length})
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5 text-xs sm:text-sm">
              <Library className="w-3.5 h-3.5" /> Resources ({lessonResources.length})
            </TabsTrigger>
            <TabsTrigger value="practice" className="gap-1.5 text-xs sm:text-sm">
              <HelpCircle className="w-3.5 h-3.5" /> Practice ({lesson.quizzes.length})
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5 text-xs sm:text-sm">
              <FolderKanban className="w-3.5 h-3.5" /> Projects
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 text-xs sm:text-sm">
              <Code2 className="w-3.5 h-3.5" /> Notes
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="space-y-6">
            <LessonOverviewProgress lessonId={lesson.id} availability={availability} />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Learning Objectives</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lesson.learningObjectives.length > 0 ? (
                  <ul className="space-y-2">
                    {lesson.learningObjectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Master the core concepts presented in this lesson module.
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Languages & Frameworks
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {lesson.languages.length > 0 ? (
                        lesson.languages.map((lang) => (
                          <span
                            key={lang}
                            className="text-xs px-2 py-0.5 rounded bg-muted font-mono"
                          >
                            {lang}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Python, Shell</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Permanent Canonical Identity
                    </span>
                    <p className="text-xs font-mono text-muted-foreground pt-1 truncate">
                      UUID: {lesson.id}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Read (Markdown with Math, Headings, and Code blocks) */}
          <TabsContent value="read" className="space-y-6">
            <Card className="p-6 md:p-8">
              <MarkdownViewer content={lesson.markdownContent} />
            </Card>
          </TabsContent>

          {/* Tab 3: Videos (curated) */}
          <TabsContent value="videos" className="space-y-6">
            {videoResources.length > 0 ? (
              <ResourceList
                resources={videoResources}
                columns={2}
                emptyIcon={Video}
                lessonId={lesson.id}
              />
            ) : (
              <Card variant="surface" className="text-center p-12 border-dashed">
                <Video className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">
                  No Curated Videos For This Lesson
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Video resources for this lesson are still being curated. Browse
                  the full registry for alternatives across the curriculum.
                </p>
                <Link href="/resources?type=youtube_video">
                  <Button variant="secondary" size="sm">
                    Browse Video Library
                  </Button>
                </Link>
              </Card>
            )}
          </TabsContent>

          {/* Tab 4: GitHub Code Viewer */}
          <TabsContent value="github" className="space-y-6">
            {repoResources.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Referenced Repositories
                </h3>
                <ResourceList
                  resources={repoResources}
                  columns={2}
                  lessonId={lesson.id}
                />
              </div>
            )}
            <CodeViewer files={lesson.codeFiles} />
          </TabsContent>

          {/* Tab 5: All Curated Resources */}
          <TabsContent value="resources" className="space-y-6">
            <ResourceList
              resources={lessonResources}
              columns={3}
              emptyIcon={Library}
              lessonId={lesson.id}
              emptyTitle="No Resources Curated Yet"
              emptyMessage="This lesson has no attached resources in the registry yet. Resources are added continuously as the catalog grows."
            />
          </TabsContent>

          {/* Tab 6: Practice (Interactive Quiz) */}
          <TabsContent value="practice" className="space-y-6">
            <QuizRunner
              quizzes={lesson.quizzes}
              lessonId={lesson.id}
              availability={availability}
            />
          </TabsContent>

          {/* Tab 7: Projects */}
          <TabsContent value="projects" className="space-y-6">
            <LessonProjectsPanel
              lessonId={lesson.id}
              phaseSlug={phaseSlug}
              availability={availability}
            />
          </TabsContent>

          {/* Tab 8: Notes */}
          <TabsContent value="notes" className="space-y-6">
            <NotesWorkspace lessonId={lesson.id} lessonTitle={lesson.title} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
