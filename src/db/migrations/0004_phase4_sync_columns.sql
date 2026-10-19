ALTER TABLE "sync_batches" ADD COLUMN IF NOT EXISTS "response_json" jsonb;--> statement-breakpoint
ALTER TABLE "sync_batches" ADD COLUMN IF NOT EXISTS "device_id" uuid;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN IF NOT EXISTS "reading_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN IF NOT EXISTS "required_resources_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN IF NOT EXISTS "practice_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN IF NOT EXISTS "project_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN IF NOT EXISTS "mastery_score" integer;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN IF NOT EXISTS "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "lesson_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "resource_id" uuid;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "project_id" varchar(200);--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "content_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "conflict_backup" text;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN IF NOT EXISTS "project_id" varchar(200);--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN IF NOT EXISTS "target_type" varchar(40) DEFAULT 'lesson' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN IF NOT EXISTS "title" varchar(500);--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN IF NOT EXISTS "href" text;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN IF NOT EXISTS "device_id" uuid;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN IF NOT EXISTS "project_id" varchar(200);--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "attempt_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "lesson_id" varchar(500);--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "percentage" integer;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "attempt_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_progress" ADD COLUMN IF NOT EXISTS "project_id" varchar(200) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_progress" ADD COLUMN IF NOT EXISTS "milestone_id" varchar(200);--> statement-breakpoint
ALTER TABLE "project_progress" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_progress" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_progress" ADD COLUMN IF NOT EXISTS "evidence_url" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tombstones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" varchar(500) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tombstones_user_entity" UNIQUE("user_id","entity_type","entity_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tombstones_user" ON "tombstones" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_quiz_attempts_user_attempt" ON "quiz_attempts" ("user_id","attempt_id");
