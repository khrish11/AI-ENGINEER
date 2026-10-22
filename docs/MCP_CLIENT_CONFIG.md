# MCP Client Configuration Examples

This document provides configuration examples for connecting to the AI Engineer OS MCP server from various AI clients.

## Remote MCP Endpoint

**Production URL**: `https://ai-engineer-os-inky.vercel.app/api/mcp`
**Local Development URL**: `http://localhost:3000/api/mcp`

The remote MCP endpoint exposes 9 public tools for curriculum browsing, lesson access, and project discovery. Private tools (learner progress, analytics) are only available via local stdio.

## ChatGPT Custom MCP Connection

ChatGPT supports MCP connections via HTTP. Configure as follows:

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

**For local development**:
```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "http"
    }
  }
}
```

### Usage in ChatGPT

Once configured, you can ask ChatGPT:
- "Search the AI Engineering curriculum for lessons about transformers"
- "Get all phases in the curriculum"
- "Suggest a learning path for LLM engineering"
- "Find projects related to RAG systems"

## OpenAI Codex CLI

Codex CLI uses MCP configuration files. Create or edit `~/.config/codex/mcp.json` (Linux/macOS) or `%APPDATA%\codex\mcp.json` (Windows):

```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "https://ai-engineer-os-inky.vercel.app/api/mcp",
        "-H", "Content-Type: application/json",
        "-d", "@-"
      ],
      "env": {}
    }
  }
}
```

**Alternative: Use HTTP transport** (if supported):
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

## Cursor

Cursor uses `.cursor/mcp.json` for MCP server configuration (not `.cursorrules`).

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

**For local development**:
```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "http"
    }
  }
}
```

**Note**: Delete `.cursorrules` if you created it earlier, as Cursor does not use it for MCP configuration.

## Claude Desktop

Claude Desktop uses MCP configuration for remote HTTP connections.

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

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

**For local development**:
```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "http"
    }
  }
}
```

## Local Stdio MCP (Development Only)

For local development with full access (including private tools), use the stdio transport:

**Claude Desktop**:
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

**Cursor**:
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

**Note**: Update `cwd` to match your actual project path. Use forward slashes on macOS/Linux.

## Available Tools (Remote MCP)

The remote endpoint exposes these 9 public tools:

1. **get_system_status** - Adapter capability and version info
2. **search_curriculum** - Search curriculum by title, phase, or keyword
3. **get_lesson** - Get lesson metadata and optionally content
4. **get_learning_resources** - List curated resources with verification metadata
5. **search_projects** - Search public project definitions
6. **get_project** - Get project definition and milestone requirements
7. **get_all_phases** - Get all curriculum phases with lesson counts
8. **get_phase_details** - Get detailed information about a specific phase
9. **suggest_learning_path** - Suggest a learning path based on goals and progress

## Private Tools (Local Stdio Only)

These tools are **NOT** available on the remote endpoint:

- **get_current_week** - Get current learner roadmap week
- **get_review_queue** - Get learner review queue
- **get_analytics_overview** - Get learner analytics overview

These require local learner context and are only accessible via the stdio transport.

## Available Resources (Remote MCP)

- **ai-engineer://curriculum/phases** - Public curriculum phase index
- **ai-engineer://curriculum/lesson-counts** - Lesson counts per phase
- **ai-engineer://stats/overview** - Overall curriculum statistics
- **ai-engineer://resources/catalog** - All curated learning resources

## Security and Rate Limiting

The remote MCP endpoint includes:
- **Rate limiting**: 60 requests per minute per IP address
- **Input validation**: All parameters validated via Zod schemas
- **Policy enforcement**: Private tools blocked on remote endpoint
- **CORS headers**: Configured for cross-origin requests
- **Read-only guarantee**: No database mutations allowed

## Troubleshooting

### Connection Issues

1. **Verify the URL**: Ensure you're using the correct endpoint (`/api/mcp`)
2. **Check network**: The remote endpoint requires internet access
3. **Local development**: Ensure `npm run dev` is running on port 3000

### Rate Limiting

If you see rate limit errors:
- Wait 1 minute before retrying
- Consider batching requests
- Use local stdio for higher-throughput operations

### Tool Not Available

If a tool returns "NOT_AUTHORIZED":
- The tool is private (e.g., `get_current_week`)
- Use local stdio for private tools
- Public tools are available on both transports

### CORS Errors

If you see CORS errors:
- Ensure your client supports HTTP MCP transport
- Check that the URL includes the protocol (`http://` or `https://`)
- Verify the endpoint is accessible from your network

## Support

For issues or questions:
- Check the main project README
- Review the MCP implementation in `src/mcp/`
- Test with `npm run mcp:start` (local stdio)
- Test with `curl` against the remote endpoint
