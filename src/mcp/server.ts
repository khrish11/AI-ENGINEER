import { McpError, toMcpError } from "./errors";
import { assertPolicyAvailable } from "./policies";
import { prompts, resources, tools } from "./registry";
import type { McpToolContext } from "./types";

export const MCP_ADAPTER_VERSION = 1;
export const defaultContext: McpToolContext = { policy: "LOCAL_PRIVATE" };

function toolSchema(tool: (typeof tools)[number]) {
  return {
    type: "object",
    properties: Object.fromEntries(
      Object.keys((tool.inputSchema as { shape?: Record<string, unknown> }).shape ?? {}).map((key) => [key, {}])
    ),
  };
}

export async function handleMcpRequest(request: Record<string, unknown>, context: McpToolContext = defaultContext) {
  const method = request.method;
  const id = request.id;
  try {
    if (method === "initialize") {
      return { jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: "ai-engineer-os", version: String(MCP_ADAPTER_VERSION) } } };
    }
    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: toolSchema(tool), annotations: { policy: tool.policy, readOnly: tool.policy !== "MUTATING" } })) } };
    }
    if (method === "tools/call") {
      const params = (request.params ?? {}) as { name?: string; arguments?: unknown };
      const tool = tools.find((candidate) => candidate.name === params.name);
      if (!tool) throw new McpError("NOT_FOUND", "Tool was not found.");
      assertPolicyAvailable(tool.policy, context.policy);
      const result = await tool.handler(params.arguments ?? {}, context);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false } };
    }
    if (method === "resources/list") {
      return { jsonrpc: "2.0", id, result: { resources: resources.map(({ uriTemplate, name, description, policy }) => ({ uriTemplate, name, description, policy })) } };
    }
    if (method === "resources/read") {
      const uri = new URL(String((request.params as { uri?: string }).uri));
      const resource = resources.find((candidate) => candidate.uriTemplate === uri.toString().replace(/\/$/, ""));
      if (!resource) throw new McpError("NOT_FOUND", "Resource was not found.");
      assertPolicyAvailable(resource.policy, context.policy);
      const contents = await resource.read(uri, context);
      return { jsonrpc: "2.0", id, result: { contents: [{ uri: uri.toString(), mimeType: "application/json", text: JSON.stringify(contents) }] } };
    }
    if (method === "prompts/list") return { jsonrpc: "2.0", id, result: { prompts } };
    if (method === "prompts/get") {
      const name = String((request.params as { name?: string } | undefined)?.name ?? "");
      const prompt = prompts.find((candidate) => candidate.name === name);
      if (!prompt) throw new McpError("NOT_FOUND", "Prompt was not found.");
      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: prompt.description,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Explain the current lesson using only public curriculum context supplied by the caller.",
              },
            },
          ],
        },
      };
    }
    if (method === "notifications/initialized") return null;
    throw new McpError("UNSUPPORTED", "MCP method is not supported.");
  } catch (error) {
    const mapped = toMcpError(error);
    return { jsonrpc: "2.0", id, error: { code: -32000, message: mapped.message, data: { code: mapped.code } } };
  }
}

export function startStdio() {
  let buffer = "";
  let pendingLength: number | null = null;
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;
    while (true) {
      if (pendingLength === null) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd >= 0) {
          const header = buffer.slice(0, headerEnd);
          const match = header.match(/Content-Length:\s*(\d+)/i);
          pendingLength = match ? Number(match[1]) : 0;
          buffer = buffer.slice(headerEnd + 4);
        } else {
          const newline = buffer.indexOf("\n");
          if (newline < 0) break;
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          let response;
          try {
            response = await handleMcpRequest(JSON.parse(line));
          } catch {
            response = {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Malformed JSON request.", data: { code: "INVALID_REQUEST" } },
            };
          }
          if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
          continue;
        }
      }
      if (pendingLength === null || buffer.length < pendingLength) break;
      const message = buffer.slice(0, pendingLength);
      buffer = buffer.slice(pendingLength);
      pendingLength = null;
      let response;
      try {
        response = await handleMcpRequest(JSON.parse(message));
      } catch {
        response = {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Malformed JSON request.", data: { code: "INVALID_REQUEST" } },
        };
      }
      if (response) {
        const payload = JSON.stringify(response);
        process.stdout.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
      }
    }
  });
}
