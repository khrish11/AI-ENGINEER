# AI Engineer OS MCP Guide

This guide explains how to use the AI Engineer OS MCP (Model Context Protocol) adapter with Claude Desktop and Cursor/Codex.

## Overview

The AI Engineer OS MCP provides tools and resources for:
- Browsing the AI Engineering curriculum (20 phases, 542 lessons)
- Searching lessons, resources, and projects
- Getting lesson content and metadata
- Accessing learning resources with verification status
- Viewing project definitions and requirements

## Installation

### Prerequisites

- Node.js >= 20.9.0
- AI Engineer OS project cloned to `E:\AI ENGINEER` (or your preferred path)
- Dependencies installed: `npm install`

### Claude Desktop Configuration

1. Locate your Claude Desktop MCP configuration file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the following configuration:

```json
{
  "mcpServers": {
    "ai-engineer-os": {
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

### Cursor/Codex Configuration

1. Create or edit `.cursorrules` in your project root:

```json
{
  "mcpServers": {
    "ai-engineer-os": {
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

2. Update `cwd` to match your project path.

3. Restart Cursor/Codex to load the MCP server.

## Available Tools

### Public Tools (No Authentication Required)

- **`get_system_status`**: Returns adapter capability and version information
- **`search_curriculum`**: Search curriculum by title, phase, or keyword
- **`get_lesson`**: Get lesson metadata and optionally content
- **`get_learning_resources`**: List curated resources with verification metadata
- **`search_projects`**: Search public project definitions
- **`get_project`**: Get project definition and milestone requirements
- **`get_all_phases`**: Get all curriculum phases with lesson counts
- **`get_phase_details`**: Get detailed information about a specific phase
- **`suggest_learning_path`**: Suggest a learning path based on goals and progress

### Private Tools (Require Local Learner Context)

- **`get_current_week`**: Get current learner roadmap week
- **`get_review_queue`**: Get learner review queue
- **`get_analytics_overview`**: Get learner analytics overview

**Note**: Private tools are only available when the MCP is used with local learner context (not currently exposed via stdio).

## Available Resources

- **`ai-engineer://curriculum/phases`**: Public curriculum phase index
- **`ai-engineer://curriculum/lesson-counts`**: Lesson counts per phase
- **`ai-engineer://stats/overview`**: Overall curriculum statistics
- **`ai-engineer://resources/catalog`**: All curated learning resources

## Available Prompts

- **`explain_current_lesson`**: Explain a lesson using public curriculum context
  - Arguments: `phaseSlug` (required), `lessonSlug` (required)

## Usage Examples

### Claude Desktop

Once configured, you can ask Claude to:

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

### Cursor/Codex

The MCP tools will be available as additional capabilities in Cursor/Codex. You can invoke them through the AI assistant interface.

## Testing the MCP

To test the MCP server manually:

```bash
cd "E:\AI ENGINEER"
npm run mcp:start
```

This starts the stdio server. You can send JSON-RPC messages to test tool calls.

To validate the MCP configuration:

```bash
npm run mcp:validate
```

## Troubleshooting

### MCP Not Loading

1. **Check the command path**: Ensure `npx` and `tsx` are installed globally or available via npm scripts.
2. **Check the cwd path**: Ensure the path is correct and properly escaped for your OS.
3. **Check dependencies**: Run `npm install` in the project directory.
4. **Check logs**: Claude Desktop logs MCP errors to its log file.

### TypeScript Errors

If you encounter TypeScript errors, run:

```bash
npm run typecheck
```

### Database Connection

The MCP uses the same database configuration as the web app. Ensure your `.env.local` has the correct `DATABASE_URL`.

## Policy Model

The MCP uses a policy-based access control model:

- **PUBLIC**: Available to all MCP clients without authentication
- **LOCAL_PRIVATE**: Requires local learner context (not exposed via stdio)
- **MUTATING**: Not implemented (read-only adapter)

Public tools and resources use safe serialization to avoid exposing private learner data.

## Development

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
