CREATE TABLE "portfolio_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"username" varchar(40),
	"display_name" varchar(120),
	"bio" text,
	"publicity" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "uq_portfolio_profiles_username" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "review_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" varchar(120) NOT NULL,
	"successful_reviews" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"local_revision" integer DEFAULT 1 NOT NULL,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"conflict_state" "conflict_state" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_review_history_user_skill" UNIQUE("user_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "portfolio_profiles" ADD CONSTRAINT "portfolio_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;