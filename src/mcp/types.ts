import { z } from "zod";

export const McpPolicySchema = z.enum([
  "PUBLIC",
  "LOCAL_PRIVATE",
  "AUTHENTICATED_PRIVATE",
  "MUTATING",
  "ADMIN",
]);
export type McpPolicy = z.infer<typeof McpPolicySchema>;

export interface McpToolContext {
  policy: McpPolicy;
  progress?: {
    getCurrentWeek?: () => Promise<unknown>;
    getReviewQueue?: () => Promise<unknown>;
    getAnalyticsOverview?: () => Promise<unknown>;
    getSkillProgress?: () => Promise<unknown>;
  };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  policy: McpPolicy;
  handler: (input: unknown, context: McpToolContext) => Promise<unknown>;
}

export interface McpResourceDefinition {
  uriTemplate: string;
  name: string;
  description: string;
  policy: McpPolicy;
  read: (uri: URL, context: McpToolContext) => Promise<unknown>;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required?: boolean }>;
}
