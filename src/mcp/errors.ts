import { z } from "zod";

export type McpErrorCode =
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "NOT_AUTHENTICATED"
  | "NOT_AUTHORIZED"
  | "PRIVATE_DATA"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "UNSUPPORTED";

export class McpError extends Error {
  constructor(
    public readonly code: McpErrorCode,
    message: string
  ) {
    super(message);
    this.name = "McpError";
  }
}

export function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) return error;
  if (error instanceof z.ZodError) {
    return new McpError("INVALID_INPUT", error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "));
  }
  return new McpError("UNSUPPORTED", "The MCP operation could not be completed.");
}
