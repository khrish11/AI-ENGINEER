import type { McpPolicy } from "./types";
import { McpError } from "./errors";

export const POLICY_DESCRIPTIONS: Record<McpPolicy, string> = {
  PUBLIC: "Safe platform metadata with no learner identity or private records.",
  LOCAL_PRIVATE: "Private local learner data supplied by an explicit local context.",
  AUTHENTICATED_PRIVATE: "Private data requiring an authenticated server identity.",
  MUTATING: "A state-changing capability requiring explicit authorization.",
  ADMIN: "A maintainer-only capability.",
};

export function assertPolicyAvailable(policy: McpPolicy, contextPolicy: McpPolicy): void {
  const rank: Record<McpPolicy, number> = {
    PUBLIC: 0,
    LOCAL_PRIVATE: 1,
    AUTHENTICATED_PRIVATE: 2,
    MUTATING: 3,
    ADMIN: 4,
  };
  if (rank[contextPolicy] < rank[policy]) {
    throw new McpError(
      policy === "AUTHENTICATED_PRIVATE" ? "NOT_AUTHENTICATED" : "NOT_AUTHORIZED",
      `This MCP operation requires ${policy.toLowerCase().replace("_", " ")} access.`
    );
  }
}
