import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres")),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32).optional().or(z.literal("")),
  AUTH_URL: z.string().url().optional().or(z.literal("")),
  AUTH_TRUST_HOST: booleanFromEnv.default("false"),
  AUTH_GITHUB_ID: z.string().optional().or(z.literal("")),
  AUTH_GITHUB_SECRET: z.string().optional().or(z.literal("")),
  AUTH_GOOGLE_ID: z.string().optional().or(z.literal("")),
  AUTH_GOOGLE_SECRET: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_ENABLE_GUEST_MODE: booleanFromEnv.default("true"),
  NEXT_PUBLIC_ENABLE_COMMUNITY_CURATION: booleanFromEnv.default("true"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = EnvironmentSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  if (result.data.NODE_ENV === "production" && !result.data.AUTH_SECRET) {
    throw new Error("Invalid environment configuration: AUTH_SECRET is required in production");
  }
  return result.data;
}
