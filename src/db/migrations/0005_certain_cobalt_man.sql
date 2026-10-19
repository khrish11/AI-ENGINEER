CREATE TABLE "project_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" varchar(200) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"value" text,
	"title" varchar(300),
	"details" jsonb,
	"self_reported" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"local_revision" integer DEFAULT 1 NOT NULL,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"conflict_state" "conflict_state" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_self_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" varchar(200) NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_earned" integer,
	"total_max" integer,
	"self_assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"local_revision" integer DEFAULT 1 NOT NULL,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"conflict_state" "conflict_state" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_evidence" ADD CONSTRAINT "project_evidence_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_self_assessments" ADD CONSTRAINT "project_self_assessments_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_project_evidence_user" ON "project_evidence" USING btree ("user_id","project_id");
--> statement-breakpoint
CREATE INDEX "idx_project_self_assessments_user" ON "project_self_assessments" USING btree ("user_id","project_id");
--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "uq_sync_batches_user_client"
  UNIQUE("user_id","client_batch_id");
