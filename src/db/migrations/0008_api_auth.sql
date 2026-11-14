-- Add role column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'user' NOT NULL;

-- Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"scopes" varchar(255) DEFAULT 'read' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_rate_limit_window" UNIQUE("identifier","endpoint","window_start")
);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"events" varchar(255) NOT NULL,
	"secret" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints (IF NOT EXISTS check handled by DO blocks)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_user_id_users_id_fk') THEN
        ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_user_id_users_id_fk') THEN
        ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- Create indexes (IF NOT EXISTS handled by CREATE INDEX IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "idx_api_keys_user" ON "api_keys" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash");
CREATE INDEX IF NOT EXISTS "idx_api_keys_active" ON "api_keys" USING btree ("is_revoked");
CREATE INDEX IF NOT EXISTS "idx_rate_limits_identifier" ON "rate_limits" USING btree ("identifier");
CREATE INDEX IF NOT EXISTS "idx_rate_limits_window" ON "rate_limits" USING btree ("window_end");
CREATE INDEX IF NOT EXISTS "idx_webhooks_user" ON "webhooks" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_webhooks_active" ON "webhooks" USING btree ("is_active");
