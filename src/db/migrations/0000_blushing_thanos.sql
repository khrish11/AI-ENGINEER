CREATE TABLE "canonical_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_phase_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"current_slug" varchar(120) NOT NULL,
	"default_title" varchar(200) NOT NULL,
	"tagline" text,
	"difficulty" varchar(20) DEFAULT 'Beginner' NOT NULL,
	"estimated_minutes" integer DEFAULT 45 NOT NULL,
	"is_deprecated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_lessons_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "canonical_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_number" integer NOT NULL,
	"permanent_key" varchar(100) NOT NULL,
	"default_slug" varchar(100) NOT NULL,
	"default_title" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_phases_phase_number_unique" UNIQUE("phase_number"),
	CONSTRAINT "canonical_phases_permanent_key_unique" UNIQUE("permanent_key")
);
--> statement-breakpoint
CREATE TABLE "curriculum_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"version_tag" varchar(50),
	"is_active" boolean DEFAULT false NOT NULL,
	"phase_count" integer DEFAULT 0 NOT NULL,
	"lesson_count" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "uq_source_commit" UNIQUE("source_id","commit_sha")
);
--> statement-breakpoint
CREATE TABLE "curriculum_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"repository_url" varchar(255) NOT NULL,
	"default_branch" varchar(50) DEFAULT 'main' NOT NULL,
	"license_spdx" varchar(50) DEFAULT 'MIT' NOT NULL,
	"author_attribution" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curriculum_sources_repository_url_unique" UNIQUE("repository_url")
);
--> statement-breakpoint
CREATE TABLE "lesson_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_lesson_id" uuid NOT NULL,
	"alias_slug" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_aliases_alias_slug_unique" UNIQUE("alias_slug")
);
--> statement-breakpoint
CREATE TABLE "lesson_prerequisites" (
	"canonical_lesson_id" uuid NOT NULL,
	"prerequisite_lesson_id" uuid NOT NULL,
	"is_hard_prerequisite" boolean DEFAULT true NOT NULL,
	CONSTRAINT "lesson_prerequisites_canonical_lesson_id_prerequisite_lesson_id_pk" PRIMARY KEY("canonical_lesson_id","prerequisite_lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"canonical_lesson_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"markdown_content" text NOT NULL,
	"markdown_hash" varchar(64) NOT NULL,
	"lesson_type" varchar(20) DEFAULT 'Build' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"learning_objectives" text[] DEFAULT '{}' NOT NULL,
	"has_code" boolean DEFAULT false NOT NULL,
	"has_quiz" boolean DEFAULT false NOT NULL,
	"has_notebook" boolean DEFAULT false NOT NULL,
	"code_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_revision_lesson" UNIQUE("revision_id","canonical_lesson_id")
);
--> statement-breakpoint
CREATE TABLE "phase_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"canonical_phase_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text,
	"order_index" integer NOT NULL,
	CONSTRAINT "uq_revision_phase" UNIQUE("revision_id","canonical_phase_id")
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_lesson_id" uuid NOT NULL,
	"stage" varchar(10) DEFAULT 'post' NOT NULL,
	"question_order" integer DEFAULT 0 NOT NULL,
	"question_text" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_answer" integer NOT NULL,
	"explanation" text
);
--> statement-breakpoint
ALTER TABLE "canonical_lessons" ADD CONSTRAINT "canonical_lessons_canonical_phase_id_canonical_phases_id_fk" FOREIGN KEY ("canonical_phase_id") REFERENCES "public"."canonical_phases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_revisions" ADD CONSTRAINT "curriculum_revisions_source_id_curriculum_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."curriculum_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_aliases" ADD CONSTRAINT "lesson_aliases_canonical_lesson_id_canonical_lessons_id_fk" FOREIGN KEY ("canonical_lesson_id") REFERENCES "public"."canonical_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_canonical_lesson_id_canonical_lessons_id_fk" FOREIGN KEY ("canonical_lesson_id") REFERENCES "public"."canonical_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_prerequisite_lesson_id_canonical_lessons_id_fk" FOREIGN KEY ("prerequisite_lesson_id") REFERENCES "public"."canonical_lessons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_revisions" ADD CONSTRAINT "lesson_revisions_revision_id_curriculum_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."curriculum_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_revisions" ADD CONSTRAINT "lesson_revisions_canonical_lesson_id_canonical_lessons_id_fk" FOREIGN KEY ("canonical_lesson_id") REFERENCES "public"."canonical_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_revisions" ADD CONSTRAINT "phase_revisions_revision_id_curriculum_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."curriculum_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_revisions" ADD CONSTRAINT "phase_revisions_canonical_phase_id_canonical_phases_id_fk" FOREIGN KEY ("canonical_phase_id") REFERENCES "public"."canonical_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_canonical_lesson_id_canonical_lessons_id_fk" FOREIGN KEY ("canonical_lesson_id") REFERENCES "public"."canonical_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_canonical_lessons_phase" ON "canonical_lessons" USING btree ("canonical_phase_id");--> statement-breakpoint
CREATE INDEX "idx_canonical_lessons_slug" ON "canonical_lessons" USING btree ("current_slug");--> statement-breakpoint
CREATE INDEX "idx_canonical_lessons_content_hash" ON "canonical_lessons" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_canonical_phases_order" ON "canonical_phases" USING btree ("phase_number");--> statement-breakpoint
CREATE INDEX "idx_curriculum_revisions_active" ON "curriculum_revisions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_lesson_aliases_slug" ON "lesson_aliases" USING btree ("alias_slug");--> statement-breakpoint
CREATE INDEX "idx_lesson_revisions_lookup" ON "lesson_revisions" USING btree ("revision_id","canonical_lesson_id");--> statement-breakpoint
CREATE INDEX "idx_phase_revisions_lookup" ON "phase_revisions" USING btree ("revision_id","canonical_phase_id");--> statement-breakpoint
CREATE INDEX "idx_quizzes_lesson" ON "quizzes" USING btree ("canonical_lesson_id");