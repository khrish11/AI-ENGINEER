import { NextRequest, NextResponse } from "next/server";
import { handleMcpRequest } from "@/mcp/server";
import { tools, resources } from "@/mcp/registry";
import type { McpToolContext } from "@/mcp/types";

// Rate limiting: Simple in-memory counter (for production, use Redis or Vercel KV)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

function getClientIdentifier(request: NextRequest): string {
  // Use IP address or a hash of headers for rate limiting
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  return ip;
}

// Request size limit: 1MB max
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB

// Remote MCP context: PUBLIC policy only, no private context
const remoteContext: McpToolContext = { policy: "PUBLIC" };

// List of tools that are safe to expose remotely (PUBLIC policy only)
const publicToolNames = tools
  .filter((tool) => tool.policy === "PUBLIC")
  .map((tool) => tool.name);

// Override tools/list to return only public tools
const originalHandleMcpRequest = handleMcpRequest;

async function handleRemoteMcpRequest(request: Record<string, unknown>, context: McpToolContext = remoteContext) {
  const method = request.method;
  const id = request.id;

  // Override tools/list to filter private tools
  if (method === "tools/list") {
    const publicTools = tools.filter((tool) => tool.policy === "PUBLIC");
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: publicTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: "object",
            properties: Object.fromEntries(
              Object.keys((tool.inputSchema as { shape?: Record<string, unknown> }).shape ?? {}).map((key) => [key, {}])
            ),
          },
          annotations: { policy: tool.policy, readOnly: true },
        })),
      },
    };
  }

  // Override resources/list to filter private resources
  if (method === "resources/list") {
    const publicResources = resources.filter((resource) => resource.policy === "PUBLIC");
    return {
      jsonrpc: "2.0",
      id,
      result: {
        resources: publicResources.map(({ uriTemplate, name, description, policy }) => ({
          uriTemplate,
          name,
          description,
          policy,
        })),
      },
    };
  }

  // Delegate to original handler for other methods
  return originalHandleMcpRequest(request, context);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Check request size
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: "Request too large. Maximum size is 1MB.",
            data: { code: "INVALID_INPUT" },
          },
        },
        { status: 413 }
      );
    }

    // Origin validation (optional, can be configured via env var)
    const allowedOrigins = process.env.MCP_ALLOWED_ORIGINS?.split(",") || ["*"];
    const origin = request.headers.get("origin");
    if (origin && allowedOrigins[0] !== "*" && !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: "Origin not allowed.",
            data: { code: "NOT_AUTHORIZED" },
          },
        },
        { status: 403 }
      );
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: "Rate limit exceeded. Please try again later.",
            data: { code: "RATE_LIMITED" },
          },
        },
        { status: 429 }
      );
    }

    // Parse JSON-RPC request
    const body = await request.json();

    // Validate basic JSON-RPC structure
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
            data: { code: "INVALID_REQUEST" },
          },
        },
        { status: 400 }
      );
    }

    // Block private tools on remote endpoint
    if (body.method === "tools/call" && body.params?.name) {
      const toolName = body.params.name;
      if (!publicToolNames.includes(toolName)) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: body.id ?? null,
            error: {
              code: -32000,
              message: "Tool not available on remote endpoint. Private tools require local context.",
              data: { code: "NOT_AUTHORIZED" },
            },
          },
          { status: 403 }
        );
      }
    }

    // Handle MCP request with PUBLIC context
    const response = await handleRemoteMcpRequest(body, remoteContext);

    // Return JSON-RPC response
    return NextResponse.json(response, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowedOrigins[0] === "*" ? "*" : (origin || "*"),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error: Invalid JSON",
            data: { code: "INVALID_REQUEST" },
          },
        },
        { status: 400 }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Internal server error",
          data: { code: "UNSUPPORTED" },
        },
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const allowedOrigins = process.env.MCP_ALLOWED_ORIGINS?.split(",") || ["*"];
  const origin = request.headers.get("origin");

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigins[0] === "*" ? "*" : (origin || "*"),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
