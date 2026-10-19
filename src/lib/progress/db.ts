import Dexie, { type Table } from "dexie";
import type { GithubResourceState } from "./resource-rules";

export type SyncStatus = "synced" | "pending" | "conflict" | "failed";
export type ConflictState = "none" | "local_wins" | "remote_wins" | "unresolved";

export interface LocalBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  localRevision: number;
  syncStatus: SyncStatus;
}

export interface LocalProfile extends LocalBase {
  deviceId: string;
  guestId: string;
  displayName: string | null;
  email: string | null;
  isAuthenticated: boolean;
  lastSyncAt: string | null;
}

export interface LessonProgress extends LocalBase {
  lessonId: string;
  lessonTitle?: string | null;
  lessonHref?: string | null;
  phaseSlug?: string | null;
  phaseNumber?: number | null;
  status: "not_started" | "in_progress" | "completed" | "mastered";
  readingComplete: boolean;
  requiredResourcesComplete: boolean;
  practiceComplete: boolean;
  projectComplete: boolean;
  masteryScore: number | null;
  needsReview: boolean;
  startedAt: string | null;
  completedAt: string | null;
  masteredAt: string | null;
}

export interface ResourceProgress extends LocalBase {
  resourceId: string;
  resourceType?: string | null;
  resourceTitle?: string | null;
  href?: string | null;
  started: boolean;
  completed: boolean;
  bookmarked: boolean;
  githubState: GithubResourceState | null;
  completedAt: string | null;
  lastOpenedAt: string | null;
  notes: string | null;
}

export interface Note extends LocalBase {
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
  content: string;
  contentRevision: number;
  conflictState: ConflictState;
  conflictBackup: string | null;
}

export interface Bookmark extends LocalBase {
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
  targetType: "lesson" | "video" | "github" | "docs" | "papers" | "datasets" | "projects";
  title: string | null;
  href: string | null;
  note: string | null;
  deletedAt: string | null;
}

export interface StudySession extends LocalBase {
  clientSessionId: string;
  deviceId: string;
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
}

export interface QuizAttempt extends LocalBase {
  attemptId: string;
  quizId: string;
  lessonId: string;
  answers: unknown;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  startedAt: string;
  submittedAt: string | null;
  attemptNumber: number;
}

export interface ProjectProgress extends LocalBase {
  projectId: string;
  milestoneId: string | null;
  completed: boolean;
  completedAt: string | null;
  evidenceUrl: string | null;
  notes: string | null;
}

export type EvidenceKind =
  | "github_repo_url"
  | "pull_request_url"
  | "commit_url"
  | "deployment_url"
  | "documentation_url"
  | "screenshot"
  | "markdown_reflection"
  | "evaluation_result"
  | "test_result"
  | "benchmark_report"
  | "notebook"
  | "repository_directory";

export type MilestoneProjectStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "completed"
  | "mastered";

/** §8 — evidence the learner attaches; selfReported is always true in Phase 6
 * (evidence is never labelled externally verified without an integration). */
export interface ProjectEvidence extends LocalBase {
  projectId: string;
  kind: EvidenceKind;
  /** https URL, note text, or in-repo path depending on kind. */
  value: string;
  title: string | null;
  /** Optional extra metadata (branch, commit SHA, directory) for GitHub evidence. */
  details: {
    branch?: string | null;
    commitSha?: string | null;
    prUrl?: string | null;
    directory?: string | null;
  } | null;
  selfReported: true;
  deletedAt: string | null;
}

/** §13 — one record per project holding rubric self-assessment scores. */
export interface ProjectSelfAssessment extends LocalBase {
  projectId: string;
  /** rubricCategoryId -> score (0..weight). */
  scores: Record<string, number>;
  totalEarned: number | null;
  totalMax: number | null;
  updatedAt: string;
}

export interface SyncQueueItem extends LocalBase {
  mutationId: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  payload: unknown;
  baseRevision: number;
  retryCount: number;
}

export interface SyncMetadata extends LocalBase {
  lastSyncCursor: string | null;
  lastSuccessfulSync: string | null;
  pendingCount: number;
  deviceId: string;
}

export interface ConflictRecord extends LocalBase {
  entityType: string;
  entityId: string;
  localData: unknown | null;
  remoteData: unknown | null;
  conflictState: ConflictState;
  resolvedAt: string | null;
}

export interface RoadmapState extends LocalBase {
  state: unknown;
}

/** Phase 7: deterministic review scheduling state per skill. */
export interface ReviewHistory extends LocalBase {
  skillId: string;
  successfulReviews: number;
  lastReviewedAt: string | null;
  snoozedUntil: string | null;
}

export interface TombstoneRecord extends LocalBase {
  entityId: string;
  entityType: string;
  deletedAt: string;
  revision: number;
}

export interface ImportBackup extends LocalBase {
  payload: unknown;
}

/** Phase 7 §37 — guests save a local portfolio preview draft. */
export interface PortfolioDraft extends LocalBase {
  draft: unknown;
}

class AiEngineerDb extends Dexie {
  localProfile!: Table<LocalProfile, string>;
  lessonProgress!: Table<LessonProgress, string>;
  resourceProgress!: Table<ResourceProgress, string>;
  notes!: Table<Note, string>;
  bookmarks!: Table<Bookmark, string>;
  studySessions!: Table<StudySession, string>;
  quizAttempts!: Table<QuizAttempt, string>;
  projectProgress!: Table<ProjectProgress, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  conflicts!: Table<ConflictRecord, string>;
  roadmapState!: Table<RoadmapState, string>;
  projectEvidence!: Table<ProjectEvidence, string>;
  projectSelfAssessments!: Table<ProjectSelfAssessment, string>;
  reviewHistory!: Table<ReviewHistory, string>;
  deviceMetadata!: Table<{ id: string; deviceId: string; createdAt: string }, string>;
  tombstones!: Table<TombstoneRecord, string>;
  importBackups!: Table<ImportBackup, string>;
  portfolioDraft!: Table<PortfolioDraft, string>;

  constructor() {
    super("aiEngineerOsDb");
    this.version(1).stores({
      localProfile: "id",
      lessonProgress: "id,lessonId",
      resourceProgress: "id,resourceId",
      notes: "id,lessonId,resourceId,projectId",
      bookmarks: "id,lessonId,resourceId,projectId",
      studySessions: "id,clientSessionId,deviceId,lessonId,resourceId,projectId",
      quizAttempts: "id,attemptId,quizId,lessonId",
      projectProgress: "id,projectId,milestoneId",
      syncQueue: "id",
      syncMetadata: "id",
      conflicts: "id,entityType,entityId",
      roadmapState: "id",
      deviceMetadata: "id,deviceId",
    });
    this.version(2).stores({
      localProfile: "id",
      lessonProgress: "id,lessonId,status,needsReview",
      resourceProgress: "id,resourceId",
      notes: "id,lessonId,resourceId,projectId",
      bookmarks: "id,lessonId,resourceId,projectId,targetType,deletedAt",
      studySessions: "id,clientSessionId,deviceId,lessonId,resourceId,projectId",
      quizAttempts: "id,attemptId,quizId,lessonId",
      projectProgress: "id,projectId,milestoneId",
      syncQueue: "id,mutationId,[entityType+entityId],syncStatus",
      syncMetadata: "id",
      conflicts: "id,entityType,entityId,conflictState",
      roadmapState: "id",
      deviceMetadata: "id,deviceId",
      tombstones: "id,entityId,entityType",
      importBackups: "id",
    });
    this.version(4).stores({
      localProfile: "id",
      lessonProgress: "id,lessonId,status,needsReview,phaseSlug,phaseNumber",
      resourceProgress: "id,resourceId,resourceType",
      notes: "id,lessonId,resourceId,projectId,conflictState",
      bookmarks: "id,lessonId,resourceId,projectId,targetType,deletedAt",
      studySessions: "id,clientSessionId,deviceId,lessonId,resourceId,projectId",
      quizAttempts: "id,attemptId,quizId,lessonId",
      projectProgress: "id,projectId,milestoneId",
      syncQueue: "id,mutationId,[entityType+entityId],syncStatus",
      syncMetadata: "id",
      conflicts: "id,entityType,entityId,conflictState",
      roadmapState: "id",
      deviceMetadata: "id,deviceId",
      tombstones: "id,entityId,entityType",
      importBackups: "id",
      projectEvidence: "id,projectId,kind",
      projectSelfAssessments: "id,projectId",
      reviewHistory: "id,skillId",
    });
    this.version(5).stores({
      localProfile: "id",
      lessonProgress: "id,lessonId,status,needsReview,phaseSlug,phaseNumber",
      resourceProgress: "id,resourceId,resourceType",
      notes: "id,lessonId,resourceId,projectId,conflictState",
      bookmarks: "id,lessonId,resourceId,projectId,targetType,deletedAt",
      studySessions: "id,clientSessionId,deviceId,lessonId,resourceId,projectId",
      quizAttempts: "id,attemptId,quizId,lessonId",
      projectProgress: "id,projectId,milestoneId",
      syncQueue: "id,mutationId,[entityType+entityId],syncStatus",
      syncMetadata: "id",
      conflicts: "id,entityType,entityId,conflictState",
      roadmapState: "id",
      deviceMetadata: "id,deviceId",
      tombstones: "id,entityId,entityType",
      importBackups: "id",
      projectEvidence: "id,projectId,kind",
      projectSelfAssessments: "id,projectId",
      reviewHistory: "id,skillId",
    });
    this.version(6).stores({
      localProfile: "id",
      lessonProgress: "id,lessonId,status,needsReview,phaseSlug,phaseNumber",
      resourceProgress: "id,resourceId,resourceType",
      notes: "id,lessonId,resourceId,projectId,conflictState",
      bookmarks: "id,lessonId,resourceId,projectId,targetType,deletedAt",
      studySessions: "id,clientSessionId,deviceId,lessonId,resourceId,projectId",
      quizAttempts: "id,attemptId,quizId,lessonId",
      projectProgress: "id,projectId,milestoneId",
      syncQueue: "id,mutationId,[entityType+entityId],syncStatus",
      syncMetadata: "id",
      conflicts: "id,entityType,entityId,conflictState",
      roadmapState: "id",
      deviceMetadata: "id,deviceId",
      tombstones: "id,entityId,entityType",
      importBackups: "id",
      projectEvidence: "id,projectId,kind",
      projectSelfAssessments: "id,projectId",
      reviewHistory: "id,skillId",
      portfolioDraft: "id",
    });
    this.version(3).stores({
      localProfile: "id",
      lessonProgress: "id,lessonId,status,needsReview,phaseSlug,phaseNumber",
      resourceProgress: "id,resourceId,resourceType",
      notes: "id,lessonId,resourceId,projectId,conflictState",
      bookmarks: "id,lessonId,resourceId,projectId,targetType,deletedAt",
      studySessions: "id,clientSessionId,deviceId,lessonId,resourceId,projectId",
      quizAttempts: "id,attemptId,quizId,lessonId",
      projectProgress: "id,projectId,milestoneId",
      syncQueue: "id,mutationId,[entityType+entityId],syncStatus",
      syncMetadata: "id",
      conflicts: "id,entityType,entityId,conflictState",
      roadmapState: "id",
      deviceMetadata: "id,deviceId",
      tombstones: "id,entityId,entityType",
      importBackups: "id",
    });
  }
}

export const db = new AiEngineerDb();

export const LEARNING_TABLES = [
  db.lessonProgress,
  db.resourceProgress,
  db.notes,
  db.bookmarks,
  db.studySessions,
  db.quizAttempts,
  db.projectProgress,
  db.roadmapState,
  db.syncQueue,
  db.conflicts,
  db.tombstones,
  db.projectEvidence,
  db.projectSelfAssessments,
  db.reviewHistory,
] as const;
