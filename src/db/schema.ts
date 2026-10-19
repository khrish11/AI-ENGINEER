import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";

// 1. Curriculum Sources
export const curriculumSources = pgTable(
  "curriculum_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    repositoryUrl: varchar("repository_url", { length: 255 }).notNull().unique(),
    defaultBranch: varchar("default_branch", { length: 50 }).notNull().default("main"),
    licenseSpdx: varchar("license_spdx", { length: 50 }).notNull().default("MIT"),
    authorAttribution: text("author_attribution").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 2. Curriculum Revisions (Snapshots per Git Commit)
export const curriculumRevisions = pgTable(
  "curriculum_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "restrict" }),
    commitSha: varchar("commit_sha", { length: 40 }).notNull(),
    versionTag: varchar("version_tag", { length: 50 }),
    isActive: boolean("is_active").notNull().default(false),
    phaseCount: integer("phase_count").notNull().default(0),
    lessonCount: integer("lesson_count").notNull().default(0),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    rawTotals: jsonb("raw_totals").notNull().default({}),
  },
  (table) => [
    unique("uq_source_commit").on(table.sourceId, table.commitSha),
    index("idx_curriculum_revisions_active").on(table.isActive),
  ]
);

// 3. Canonical Phases (Permanent Identities)
export const canonicalPhases = pgTable(
  "canonical_phases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phaseNumber: integer("phase_number").notNull().unique(),
    permanentKey: varchar("permanent_key", { length: 100 }).notNull().unique(),
    defaultSlug: varchar("default_slug", { length: 100 }).notNull(),
    defaultTitle: varchar("default_title", { length: 150 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_canonical_phases_order").on(table.phaseNumber),
  ]
);

// 4. Phase Revisions (Version-specific metadata for a phase)
export const phaseRevisions = pgTable(
  "phase_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => curriculumRevisions.id, { onDelete: "cascade" }),
    canonicalPhaseId: uuid("canonical_phase_id")
      .notNull()
      .references(() => canonicalPhases.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull(),
  },
  (table) => [
    unique("uq_revision_phase").on(table.revisionId, table.canonicalPhaseId),
    index("idx_phase_revisions_lookup").on(table.revisionId, table.canonicalPhaseId),
  ]
);

// 5. Canonical Lessons (Permanent logical identities - Sole Genuine Immutable UUID)
export const canonicalLessons = pgTable(
  "canonical_lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalPhaseId: uuid("canonical_phase_id")
      .notNull()
      .references(() => canonicalPhases.id, { onDelete: "restrict" }),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    currentSlug: varchar("current_slug", { length: 120 }).notNull(),
    defaultTitle: varchar("default_title", { length: 200 }).notNull(),
    tagline: text("tagline"),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("Beginner"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(45),
    isDeprecated: boolean("is_deprecated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_canonical_lessons_phase").on(table.canonicalPhaseId),
    index("idx_canonical_lessons_slug").on(table.currentSlug),
    index("idx_canonical_lessons_content_hash").on(table.contentHash),
  ]
);

// 6. Lesson Revisions (Content snapshot for a specific revision)
export const lessonRevisions = pgTable(
  "lesson_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => curriculumRevisions.id, { onDelete: "cascade" }),
    canonicalLessonId: uuid("canonical_lesson_id")
      .notNull()
      .references(() => canonicalLessons.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    markdownContent: text("markdown_content").notNull(),
    markdownHash: varchar("markdown_hash", { length: 64 }).notNull(),
    lessonType: varchar("lesson_type", { length: 20 }).notNull().default("Build"),
    languages: text("languages").array().notNull().default([]),
    learningObjectives: text("learning_objectives").array().notNull().default([]),
    hasCode: boolean("has_code").notNull().default(false),
    hasQuiz: boolean("has_quiz").notNull().default(false),
    hasNotebook: boolean("has_notebook").notNull().default(false),
    codeFiles: jsonb("code_files").notNull().default([]),
    outputs: jsonb("outputs").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_revision_lesson").on(table.revisionId, table.canonicalLessonId),
    index("idx_lesson_revisions_lookup").on(table.revisionId, table.canonicalLessonId),
  ]
);

// 7. Lesson Aliases (historical slugs)
export const lessonAliases = pgTable(
  "lesson_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalLessonId: uuid("canonical_lesson_id")
      .notNull()
      .references(() => canonicalLessons.id, { onDelete: "cascade" }),
    aliasSlug: varchar("alias_slug", { length: 150 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_lesson_aliases_slug").on(table.aliasSlug),
  ]
);

// 8. Lesson Prerequisites
export const lessonPrerequisites = pgTable(
  "lesson_prerequisites",
  {
    canonicalLessonId: uuid("canonical_lesson_id")
      .notNull()
      .references(() => canonicalLessons.id, { onDelete: "cascade" }),
    prerequisiteLessonId: uuid("prerequisite_lesson_id")
      .notNull()
      .references(() => canonicalLessons.id, { onDelete: "restrict" }),
    isHardPrerequisite: boolean("is_hard_prerequisite").notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.canonicalLessonId, table.prerequisiteLessonId] }),
  ]
);

// 9. Quizzes
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalLessonId: uuid("canonical_lesson_id")
      .notNull()
      .references(() => canonicalLessons.id, { onDelete: "cascade" }),
    stage: varchar("stage", { length: 10 }).notNull().default("post"), // 'pre' | 'post'
    questionOrder: integer("question_order").notNull().default(0),
    questionText: text("question_text").notNull(),
    options: jsonb("options").notNull().default([]),
    correctAnswer: integer("correct_answer").notNull(),
    explanation: text("explanation"),
  },
  (table) => [
    index("idx_quizzes_lesson").on(table.canonicalLessonId),
  ]
);

// 10. Resources (Curated Learning Resource Registry)
// First-class registry. URLs are stored once here and referenced from lessons;
// they are never duplicated inside lesson records.
export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Stable, human-authored kebab-case identifier from the declarative catalog.
    resourceKey: varchar("resource_key", { length: 120 }).notNull().unique(),
    resourceType: varchar("resource_type", { length: 32 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    // Deterministic hash of the normalized canonical URL for dedupe/uniqueness.
    canonicalUrlHash: varchar("canonical_url_hash", { length: 64 }).notNull(),
    description: text("description"),
    authorName: varchar("author_name", { length: 200 }),
    organization: varchar("organization", { length: 200 }),
    language: varchar("language", { length: 16 }).notNull().default("en"),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("all_levels"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    license: varchar("license", { length: 100 }),
    sourcePlatform: varchar("source_platform", { length: 100 }),
    tags: text("tags").array().notNull().default([]),
    editorialStatus: varchar("editorial_status", { length: 20 })
      .notNull()
      .default("pending_review"),
    verificationStatus: varchar("verification_status", { length: 24 })
      .notNull()
      .default("unverified"),
    verificationNotes: text("verification_notes"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_resources_canonical_url_hash").on(table.canonicalUrlHash),
    index("idx_resources_type").on(table.resourceType),
    index("idx_resources_editorial").on(table.editorialStatus),
    index("idx_resources_verification").on(table.verificationStatus),
  ]
);

// 11. Lesson ↔ Resource Mapping (many-to-many junction)
export const lessonResources = pgTable(
  "lesson_resources",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => canonicalLessons.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    relevanceScore: integer("relevance_score").notNull().default(0),
    resourceRole: varchar("resource_role", { length: 20 }).notNull().default("supplementary"),
    orderIndex: integer("order_index").notNull().default(0),
    recommended: boolean("recommended").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.lessonId, table.resourceId] }),
    index("idx_lesson_resources_lesson").on(table.lessonId),
    index("idx_lesson_resources_resource").on(table.resourceId),
    index("idx_lesson_resources_role").on(table.resourceRole),
  ]
);

// 12. YouTube provider metadata (1:1 with resources)
export const resourceYoutubeMetadata = pgTable(
  "resource_youtube_metadata",
  {
    resourceId: uuid("resource_id")
      .primaryKey()
      .references(() => resources.id, { onDelete: "cascade" }),
    videoId: varchar("video_id", { length: 20 }),
    playlistId: varchar("playlist_id", { length: 64 }),
    channelName: varchar("channel_name", { length: 200 }),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds"),
    chapters: jsonb("chapters").notNull().default([]),
    embedAllowed: boolean("embed_allowed"),
    regionStatus: varchar("region_status", { length: 32 }).notNull().default("unknown"),
    directWatchUrl: text("direct_watch_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_youtube_video").on(table.videoId),
  ]
);

// 13. GitHub provider metadata (1:1 with resources)
export const resourceGithubMetadata = pgTable(
  "resource_github_metadata",
  {
    resourceId: uuid("resource_id")
      .primaryKey()
      .references(() => resources.id, { onDelete: "cascade" }),
    owner: varchar("owner", { length: 120 }).notNull(),
    repository: varchar("repository", { length: 120 }).notNull(),
    defaultBranch: varchar("default_branch", { length: 80 }),
    repositoryPath: text("repository_path"),
    description: text("description"),
    primaryLanguage: varchar("primary_language", { length: 60 }),
    license: varchar("license", { length: 100 }),
    archived: boolean("archived").notNull().default(false),
    fork: boolean("fork").notNull().default(false),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_resource_github_repo").on(table.owner, table.repository),
  ]
);

// 14. Research paper metadata (1:1 with resources)
export const resourcePaperMetadata = pgTable(
  "resource_paper_metadata",
  {
    resourceId: uuid("resource_id")
      .primaryKey()
      .references(() => resources.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 300 }).notNull(),
    authors: text("authors").array().notNull().default([]),
    publicationYear: integer("publication_year"),
    arxivId: varchar("arxiv_id", { length: 32 }),
    doi: varchar("doi", { length: 120 }),
    paperUrl: text("paper_url"),
    pdfUrl: text("pdf_url"),
  },
  (table) => [
    index("idx_resource_paper_arxiv").on(table.arxivId),
  ]
);

// 15. Resource Verification Log (cached external health checks)
// Written by `npm run resources:audit`, read by the coverage/report engine.
// Ordinary page requests never query external providers.
export const resourceVerifications = pgTable(
  "resource_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    checkType: varchar("check_type", { length: 32 }).notNull(), // oembed | github_api | http_head | manual
    status: varchar("status", { length: 24 }).notNull(),
    httpStatus: integer("http_status"),
    details: jsonb("details").notNull().default({}),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_verifications_resource").on(table.resourceId),
    index("idx_resource_verifications_checked").on(table.checkedAt),
  ]
);

// ===========================================================================
// Phase 4: Learner Progress, Auth, and Sync
// ===========================================================================

export const lessonStatusEnum = pgEnum("lesson_status", [
  "not_started",
  "in_progress",
  "completed",
  "mastered",
]);

export const resourceStatusEnum = pgEnum("resource_status", ["started", "completed"]);

export const syncStatusEnum = pgEnum("sync_status", [
  "synced",
  "pending",
  "conflict",
  "failed",
]);

export const conflictStateEnum = pgEnum("conflict_state", [
  "none",
  "local_wins",
  "remote_wins",
  "unresolved",
]);

// --- Auth.js tables -------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: varchar("image", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 50 }),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: varchar("session_state", { length: 255 }),
  },
  (table) => [
    unique("accounts_provider_account_unique").on(table.provider, table.providerAccountId),
    index("idx_accounts_user").on(table.userId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_sessions_user").on(table.userId)]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceUuid: uuid("device_uuid").notNull().unique(),
    deviceName: varchar("device_name", { length: 255 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_devices_user").on(table.userId)]
);

// --- Learner progress tables ---------------------------------------------

export const userLessonProgress = pgTable(
  "user_lesson_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonKey: varchar("lesson_key", { length: 500 }).notNull(),
    status: lessonStatusEnum("status").notNull().default("not_started"),
    progressPercent: integer("progress_percent").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    readingComplete: boolean("reading_complete").notNull().default(false),
    requiredResourcesComplete: boolean("required_resources_complete").notNull().default(false),
    practiceComplete: boolean("practice_complete").notNull().default(false),
    projectComplete: boolean("project_complete").notNull().default(false),
    masteryScore: integer("mastery_score"),
    needsReview: boolean("needs_review").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    masteredAt: timestamp("mastered_at", { withTimezone: true }),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("ulp_user_lesson_unique").on(table.userId, table.lessonKey),
    index("idx_ulp_lesson_key").on(table.lessonKey),
  ]
);

export const userResourceProgress = pgTable(
  "user_resource_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    status: resourceStatusEnum("status").notNull().default("started"),
    progressPercent: integer("progress_percent").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("urp_user_resource_unique").on(table.userId, table.resourceId)]
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonKey: varchar("lesson_key", { length: 500 }),
    resourceId: uuid("resource_id"),
    projectId: varchar("project_id", { length: 200 }),
    content: text("content").notNull(),
    contentRevision: integer("content_revision").notNull().default(1),
    conflictBackup: text("conflict_backup"),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_notes_user_lesson").on(table.userId, table.lessonKey)]
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonKey: varchar("lesson_key", { length: 500 }),
    resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 200 }),
    targetType: varchar("target_type", { length: 40 }).notNull().default("lesson"),
    title: varchar("title", { length: 500 }),
    href: text("href"),
    note: text("note"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_bookmarks_user").on(table.userId)]
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientSessionId: uuid("client_session_id").notNull(),
    deviceId: uuid("device_id"),
    lessonKey: varchar("lesson_key", { length: 500 }),
    resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 200 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("study_sessions_user_client_unique").on(table.userId, table.clientSessionId)]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id").references(() => quizzes.id, { onDelete: "set null" }),
    attemptId: uuid("attempt_id").notNull(),
    lessonId: varchar("lesson_id", { length: 500 }),
    score: integer("score"),
    maxScore: integer("max_score"),
    percentage: integer("percentage"),
    answers: jsonb("answers"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_quiz_attempts_user").on(table.userId, table.quizId)]
);

export const projectProgress = pgTable(
  "project_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonKey: varchar("lesson_key", { length: 500 }).notNull(),
    projectId: varchar("project_id", { length: 200 }).notNull().default("unknown"),
    milestoneId: varchar("milestone_id", { length: 200 }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    evidenceUrl: text("evidence_url"),
    status: varchar("status", { length: 50 }).notNull().default("not_started"),
    repositoryUrl: varchar("repository_url", { length: 500 }),
    note: text("note"),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_project_progress_user").on(table.userId, table.lessonKey)]
);

// --- Phase 7: review scheduling + portfolio (additive) ---------------------

export const reviewHistory = pgTable(
  "review_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: varchar("skill_id", { length: 120 }).notNull(),
    successfulReviews: integer("successful_reviews").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_review_history_user_skill").on(table.userId, table.skillId),
  ]
);

/** Publication configuration only; learner data is read live by the serializer. */
export const portfolioProfiles = pgTable(
  "portfolio_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    published: boolean("published").notNull().default(false),
    username: varchar("username", { length: 40 }),
    displayName: varchar("display_name", { length: 120 }),
    bio: text("bio"),
    publicity: jsonb("publicity").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("uq_portfolio_profiles_username").on(table.username)]
);

// --- Phase 6: project studio (additive) ------------------------------------

export const projectEvidence = pgTable(
  "project_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 200 }).notNull(),
    kind: varchar("kind", { length: 50 }).notNull(),
    value: text("value"),
    title: varchar("title", { length: 300 }),
    details: jsonb("details"),
    selfReported: boolean("self_reported").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_project_evidence_user").on(table.userId, table.projectId)]
);

export const projectSelfAssessments = pgTable(
  "project_self_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 200 }).notNull(),
    scores: jsonb("scores").notNull().default({}),
    totalEarned: integer("total_earned"),
    totalMax: integer("total_max"),
    selfAssessedAt: timestamp("self_assessed_at", { withTimezone: true }).notNull().defaultNow(),
    localRevision: integer("local_revision").notNull().default(1),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_project_self_assessments_user").on(table.userId, table.projectId)]
);

export const roadmapState = pgTable("roadmap_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  state: jsonb("state").notNull().default({}),
  localRevision: integer("local_revision").notNull().default(1),
  syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
  conflictState: conflictStateEnum("conflict_state").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Sync bookkeeping tables ----------------------------------------------

export const syncBatches = pgTable(
  "sync_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientBatchId: uuid("client_batch_id").notNull().unique(),
    status: varchar("status", { length: 50 }).notNull().default("received"),
    appliedCount: integer("applied_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    conflictCount: integer("conflict_count").notNull().default(0),
    metadata: jsonb("metadata"),
    responseJson: jsonb("response_json"),
    deviceId: uuid("device_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("uq_sync_batches_user_client").on(table.userId, table.clientBatchId)]
);

export const tombstones = pgTable(
  "tombstones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityId: varchar("entity_id", { length: 500 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
    revision: integer("revision").notNull().default(1),
    deviceId: uuid("device_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_tombstones_user_entity").on(table.userId, table.entityType, table.entityId),
    index("idx_tombstones_user").on(table.userId),
  ]
);

export const syncConflicts = pgTable("sync_conflicts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 500 }).notNull(),
  localData: jsonb("local_data"),
  remoteData: jsonb("remote_data"),
  conflictState: conflictStateEnum("conflict_state").notNull().default("unresolved"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
