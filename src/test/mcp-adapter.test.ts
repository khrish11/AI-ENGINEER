import { describe, expect, it } from "vitest";
import { handleMcpRequest } from "@/mcp/server";
import { safeProgressSummary } from "@/mcp/serializers";

describe("MCP adapter", () => {
  it("lists only registered read-oriented tools", async () => {
    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const tools = (response?.result as { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> }).tools;
    expect(tools.length).toBeGreaterThanOrEqual(8);
    expect(tools.every((tool) => tool.annotations.readOnlyHint)).toBe(true);
  });

  it("serves public project data without private evidence", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search_projects", arguments: { limit: 1 } },
    });
    const result = response?.result as { content: Array<{ type: string; text: string }> };
    const data = JSON.parse(result.content[0].text) as { results: Array<Record<string, unknown>> };
    expect(data.results[0]).not.toHaveProperty("evidence");
    expect(data.results[0]).not.toHaveProperty("userId");
  });

  it("blocks private tools without a local context", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_analytics_overview", arguments: {} },
    });
    expect(response?.error?.data).toEqual({ code: "NOT_AUTHENTICATED" });
  });

  it("removes private fields from injected summaries", () => {
    expect(safeProgressSummary({
      completed: 2,
      email: "learner@example.com",
      notes: "private",
      answers: ["secret"],
      deviceId: "device",
    })).toEqual({ completed: 2 });
  });

  it("returns structured invalid-input errors", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "search_projects", arguments: { limit: 1000 } },
    });
    expect(response?.error?.data).toEqual({ code: "INVALID_INPUT" });
  });

  it("supports prompt retrieval and unsupported-method errors", async () => {
    const prompt = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "prompts/get",
      params: { name: "explain_current_lesson", arguments: {} },
    });
    expect(prompt?.result).toHaveProperty("messages");

    const unsupported = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "not-a-method",
    });
    expect(unsupported?.error?.data).toEqual({ code: "UNSUPPORTED" });
  });
});
