# AI Engineer OS MCP Guide

This guide explains how to use the AI Engineer OS MCP (Model Context Protocol) adapter with various AI clients.

## Overview

The AI Engineer OS MCP provides tools and resources for:
- Browsing the AI Engineering curriculum (20 phases, 542 lessons)
- Searching lessons, resources, and projects
- Getting lesson content and metadata
- Accessing learning resources with verification status
- Viewing project definitions and requirements

## Two Connection Methods

### 1. Remote HTTP (Recommended for Production)
- **Endpoint**: `https://ai-engineer-os-inky.vercel.app/api/mcp`
- **Access**: Public, no authentication required
- **Tools**: 9 public tools only (curriculum browsing, lesson access, project discovery)
- **Rate Limiting**: 60 requests per minute per IP
- **Use Case**: Connecting from ChatGPT, Claude Desktop, Cursor, Codex over the internet

### 2. Local Stdio (Development Only)
- **Command**: `npm run mcp:start`
- **Access**: Requires local project clone and dependencies
- **Tools**: All 12 tools (including private learner progress tools)
- **Rate Limiting**: None
- **Use Case**: Local development with full learner context

**Note**: Private tools (`get_current_week`, `get_review_queue`, `get_analytics_overview`) are only available via local stdio, not the remote HTTP endpoint.

## Installation

### Prerequisites

For local stdio:
- Node.js >= 20.9.0
- AI Engineer OS project cloned to your local machine
- Dependencies installed: `npm install`

For remote HTTP:
- Internet access
- No local installation required

## Remote HTTP Configuration

### ChatGPT Custom MCP Connection

```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "https://ai-engineer-os-inky.vercel.app/api/mcp",
      "transport": "http"
    }
  }
}
```

### Claude Desktop (Remote HTTP)

1. Locate your Claude Desktop MCP configuration file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the following configuration:

```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "https://ai-engineer-os-inky.vercel.app/api/mcp",
      "transport": "http"
    }
  }
}
```

3. Restart Claude Desktop to load the MCP server.

### Cursor (Remote HTTP)

Cursor uses `.cursor/mcp.json` for MCP server configuration.

**Windows**: `C:\Users\<username>\.cursor\mcp.json`
**macOS/Linux**: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "https://ai-engineer-os-inky.vercel.app/api/mcp",
      "transport": "http"
    }
  }
}
```

Restart Cursor to load the MCP server.

### OpenAI Codex CLI (Remote HTTP)

Create or edit `~/.config/codex/mcp.json` (Linux/macOS) or `%APPDATA%\codex\mcp.json` (Windows):

```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "https://ai-engineer-os-inky.vercel.app/api/mcp",
      "transport": "http"
    }
  }
}
```

## Local Stdio Configuration (Development Only)

### Claude Desktop (Local Stdio)

1. Locate your Claude Desktop MCP configuration file (see above)

2. Add the following configuration:

```json
{
  "mcpServers": {
    "ai-engineer-os-local": {
      "command": "npx",
      "args": [
        "tsx",
        "src/scripts/mcp-start.ts"
      ],
      "cwd": "E:\\AI ENGINEER"
    }
  }
}
```

3. **Important**: Update `cwd` to match your actual project path.
   - **Windows**: Use backslashes: `E:\\AI ENGINEER`
   - **macOS/Linux**: Use forward slashes: `/Users/yourname/AI-ENGINEER`

4. Restart Claude Desktop to load the MCP server.

### Cursor (Local Stdio)

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ai-engineer-os-local": {
      "command": "npx",
      "args": [
        "tsx",
        "src/scripts/mcp-start.ts"
      ],
      "cwd": "E:\\AI ENGINEER"
    }
  }
}
```

Update `cwd` to match your project path and restart Cursor.

## Available Tools

### Public Tools (Remote HTTP + Local Stdio)

These 9 tools are available on both the remote HTTP endpoint and local stdio:

- **`get_system_status`**: Returns adapter capability and version information
- **`search_curriculum`**: Search curriculum by title, phase, or keyword
- **`get_lesson`**: Get lesson metadata and optionally content
- **`get_learning_resources`**: List curated resources with verification metadata
- **`search_projects`**: Search public project definitions
- **`get_project`**: Get project definition and milestone requirements
- **`get_all_phases`**: Get all curriculum phases with lesson counts
- **`get_phase_details`**: Get detailed information about a specific phase
- **`suggest_learning_path`**: Suggest a learning path based on goals and progress

### Private Tools (Local Stdio Only)

These 3 tools are **NOT** available on the remote HTTP endpoint:

- **`get_current_week`**: Get current learner roadmap week
- **`get_review_queue`**: Get learner review queue
- **`get_analytics_overview`**: Get learner analytics overview

**Note**: Private tools require local learner context and are only accessible via the stdio transport. They are blocked on the remote HTTP endpoint for security.

## Available Resources

- **`ai-engineer://curriculum/phases`**: Public curriculum phase index
- **`ai-engineer://curriculum/lesson-counts`**: Lesson counts per phase
- **`ai-engineer://stats/overview`**: Overall curriculum statistics
- **`ai-engineer://resources/catalog`**: All curated learning resources

## Available Prompts

- **`explain_current_lesson`**: Explain a lesson using public curriculum context
  - Arguments: `phaseSlug` (required), `lessonSlug` (required)

## Usage Examples

### Remote HTTP (ChatGPT, Claude Desktop, Cursor, Codex)

Once configured with the remote HTTP endpoint, you can ask your AI client:

1. **Search for lessons about transformers**:
   ```
   Use the ai-engineer-os MCP to search the curriculum for lessons about transformers.
   ```

2. **Get information about a specific phase**:
   ```
   What's in Phase 8 of the AI Engineering curriculum? Use the get_phase_details tool.
   ```

3. **Get learning resources**:
   ```
   Find learning resources about RAG systems using the ai-engineer-os MCP.
   ```

4. **Suggest a learning path**:
   ```
   I want to learn about LLM engineering and I have 10 hours per week. Suggest a learning path.
   ```

5. **Get all phases**:
   ```
   List all phases in the AI Engineering curriculum with their lesson counts.
   ```

### Local Stdio (Development Only)

With local stdio, you have access to private tools in addition to public tools:

1. **Get current learner progress**:
   ```
   What's my current roadmap week using the ai-engineer-os MCP?
   ```

2. **Get review queue**:
   ```
   Show my review queue for spaced repetition.
   ```

3. **Get analytics overview**:
   ```
   What's my learning analytics overview?
   ```

## Testing the MCP

### Test Remote HTTP

Test the remote endpoint with curl:

```bash
curl -X POST https://ai-engineer-os-inky.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

Test a tool call:

```bash
curl -X POST https://ai-engineer-os-inky.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_all_phases","arguments":{}}}'
```

### Test Local Stdio

To test the stdio server manually:

```bash
cd "E:\AI ENGINEER"
npm run mcp:start
```

This starts the stdio server. You can send JSON-RPC messages to test tool calls.

To validate the MCP configuration:

```bash
npm run mcp:validate
```

## Choosing Between Remote HTTP and Local Stdio

### Use Remote HTTP When:
- You want to connect from any AI client (ChatGPT, Claude, Cursor, Codex)
- You don't need learner progress or analytics
- You only need curriculum browsing and project discovery
- You want a simple, no-installation setup
- You're connecting from multiple devices

### Use Local Stdio When:
- You're developing locally and have the project cloned
- You need access to private learner progress tools
- You're testing MCP changes locally
- You need higher throughput without rate limiting
- You want full access to all 12 tools

## Troubleshooting

### Remote HTTP Connection Issues

1. **Verify the URL**: Ensure you're using `https://ai-engineer-os-inky.vercel.app/api/mcp`
2. **Check network**: The remote endpoint requires internet access
3. **Check transport**: Ensure your client supports HTTP MCP transport
4. **Check rate limiting**: If you see rate limit errors, wait 1 minute before retrying

### Local Stdio Not Loading

1. **Check the command path**: Ensure `npx` and `tsx` are installed globally or available via npm scripts.
2. **Check the cwd path**: Ensure the path is correct and properly escaped for your OS.
3. **Check dependencies**: Run `npm install` in the project directory.
4. **Check logs**: Claude Desktop logs MCP errors to its log file.

### Tool Not Available

If a tool returns "NOT_AUTHORIZED":
- The tool is private (e.g., `get_current_week`)
- Use local stdio for private tools
- Public tools are available on both transports

### TypeScript Errors

If you encounter TypeScript errors, run:

```bash
npm run typecheck
```

### Database Connection

The MCP uses the same database configuration as the web app. Ensure your `.env.local` has the correct `DATABASE_URL`.

## Security and Rate Limiting

### Remote HTTP Security

The remote HTTP endpoint includes several security measures:

- **Rate Limiting**: 60 requests per minute per IP address
- **Input Validation**: All parameters validated via Zod schemas
- **Policy Enforcement**: Private tools blocked on remote endpoint
- **CORS Headers**: Configured for cross-origin requests
- **Read-Only Guarantee**: No database mutations allowed

### Rate Limiting Details

If you exceed the rate limit, you'll receive:
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32000,
    "message": "Rate limit exceeded. Please try again later.",
    "data": { "code": "RATE_LIMITED" }
  }
}
```

To avoid rate limiting:
- Wait 1 minute before retrying
- Consider batching requests
- Use local stdio for higher-throughput operations

### Private Tool Blocking

If you try to access a private tool via remote HTTP, you'll receive:
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32000,
    "message": "Tool not available on remote endpoint. Private tools require local context.",
    "data": { "code": "NOT_AUTHORIZED" }
  }
}
```

Private tools require local learner context and are only accessible via stdio.

## Policy Model

The MCP uses a policy-based access control model:

- **PUBLIC**: Available to all MCP clients without authentication (9 tools on remote HTTP, all 12 tools on local stdio)
- **LOCAL_PRIVATE**: Requires local learner context (3 tools only on local stdio, blocked on remote HTTP)
- **MUTATING**: Not implemented (read-only adapter)

Public tools and resources use safe serialization to avoid exposing private learner data. Private tools are explicitly blocked on the remote HTTP endpoint.

## Development

To add new tools or resources:

1. Edit `src/mcp/registry.ts` to add tool/resource definitions
2. Update `src/mcp/schemas.ts` for input validation schemas
3. Update `src/mcp/serializers.ts` for output serialization
4. Run `npm run typecheck` to verify changes
5. Run `npm run mcp:validate` to validate MCP configuration
6. Test with local stdio: `npm run mcp:start`
7. Test with remote HTTP after deployment

## Additional Documentation

For detailed client configuration examples, see:
- **MCP Client Configuration Guide**: `docs/MCP_CLIENT_CONFIG.md`

To add new tools or resources:

1. Edit `src/mcp/registry.ts` to add tool/resource definitions
2. Update `src/mcp/schemas.ts` for input validation schemas
3. Update `src/mcp/serializers.ts` for output serialization
4. Run `npm run typecheck` to verify changes
5. Run `npm run mcp:validate` to validate MCP configuration

## Support

For issues or questions:
- Check the main project README
- Review the MCP implementation in `src/mcp/`
- Test with `npm run mcp:start` and `npm run mcp:validate`
