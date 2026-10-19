CREATE TABLE "lesson_resources" (
	"lesson_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"relevance_score" integer DEFAULT 0 NOT NULL,
	"resource_role" varchar(20) DEFAULT 'supplementary' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_resources_lesson_id_resource_id_pk" PRIMARY KEY("lesson_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "resource_github_metadata" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"owner" varchar(120) NOT NULL,
	"repository" varchar(120) NOT NULL,
	"default_branch" varchar(80),
	"repository_path" text,
	"description" text,
	"primary_language" varchar(60),
	"license" varchar(100),
	"archived" boolean DEFAULT false NOT NULL,
	"fork" boolean DEFAULT false NOT NULL,
	"last_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resource_paper_metadata" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"authors" text[] DEFAULT '{}' NOT NULL,
	"publication_year" integer,
	"arxiv_id" varchar(32),
	"doi" varchar(120),
	"paper_url" text,
	"pdf_url" text
);
--> statement-breakpoint
CREATE TABLE "resource_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"check_type" varchar(32) NOT NULL,
	"status" varchar(24) NOT NULL,
	"http_status" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_youtube_metadata" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"video_id" varchar(20),
	"playlist_id" varchar(64),
	"channel_name" varchar(200),
	"thumbnail_url" text,
	"duration_seconds" integer,
	"chapters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embed_allowed" boolean,
	"region_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"direct_watch_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_key" varchar(120) NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"canonical_url" text NOT NULL,
	"canonical_url_hash" varchar(64) NOT NULL,
	"description" text,
	"author_name" varchar(200),
	"organization" varchar(200),
	"language" varchar(16) DEFAULT 'en' NOT NULL,
	"difficulty" varchar(20) DEFAULT 'all_levels' NOT NULL,
	"estimated_duration_minutes" integer,
	"license" varchar(100),
	"source_platform" varchar(100),
	"tags" text[] DEFAULT '{}' NOT NULL,
	"editorial_status" varchar(20) DEFAULT 'pending_review' NOT NULL,
	"verification_status" varchar(24) DEFAULT 'unverified' NOT NULL,
	"verification_notes" text,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_resource_key_unique" UNIQUE("resource_key"),
	CONSTRAINT "uq_resources_canonical_url_hash" UNIQUE("canonical_url_hash")
);
--> statement-breakpoint
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lesson_id_canonical_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."canonical_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_github_metadata" ADD CONSTRAINT "resource_github_metadata_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_paper_metadata" ADD CONSTRAINT "resource_paper_metadata_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_verifications" ADD CONSTRAINT "resource_verifications_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_youtube_metadata" ADD CONSTRAINT "resource_youtube_metadata_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_resources_lesson" ON "lesson_resources" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_resources_resource" ON "lesson_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_resources_role" ON "lesson_resources" USING btree ("resource_role");--> statement-breakpoint
CREATE INDEX "idx_resource_github_repo" ON "resource_github_metadata" USING btree ("owner","repository");--> statement-breakpoint
CREATE INDEX "idx_resource_paper_arxiv" ON "resource_paper_metadata" USING btree ("arxiv_id");--> statement-breakpoint
CREATE INDEX "idx_resource_verifications_resource" ON "resource_verifications" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_resource_verifications_checked" ON "resource_verifications" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "idx_resource_youtube_video" ON "resource_youtube_metadata" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "idx_resources_type" ON "resources" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_resources_editorial" ON "resources" USING btree ("editorial_status");--> statement-breakpoint
CREATE INDEX "idx_resources_verification" ON "resources" USING btree ("verification_status");