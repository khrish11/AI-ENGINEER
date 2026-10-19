# MCP Adapter

AI Engineer OS provides a read-only, local stdio MCP adapter through `npm run mcp:start`. It supports MCP protocol version `2025-06-18` over newline-delimited JSON or `Content-Length` framed stdio messages, including initialization, tool listing/calls, resource listing/reads, and prompt listing/retrieval. Malformed JSON returns a structured protocol error without terminating the process.

## Tools

Public tools include `search_curriculum`, `get_lesson`, `get_learning_resources`, `search_projects`, and `get_project`. Learner-specific tools (`get_current_week`, `get_review_queue`, and `get_analytics_overview`) require an explicitly supplied local private context; a standalone process cannot read a browser's IndexedDB.

No tool exposes SQL, shell execution, arbitrary file writes, raw quiz answers, notes, device identifiers, OAuth identifiers, sync conflicts, unpublished evidence, or private portfolio settings. Mutating tools are intentionally not registered.

Run `npm run mcp:validate` to check registry policies and definitions. The machine-readable capability manifest is [`mcp-manifest.json`](../mcp-manifest.json).
