# AI Engineer OS - API Documentation

Complete API documentation for integrating with AI Engineer OS using REST endpoints, MCP protocol, and webhooks.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [REST API](#rest-api)
- [MCP Protocol](#mcp-protocol)
- [Webhooks](#webhooks)
- [Streaming](#streaming)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

AI Engineer OS provides multiple ways to access curriculum data for chatbots and AI agents:

1. **REST API** - Simple HTTP endpoints for easy integration
2. **MCP Protocol** - Standard Model Context Protocol for AI agent tooling
3. **Webhooks** - Real-time notifications for curriculum updates
4. **Streaming** - Server-Sent Events for long content delivery

**Base URL**: `https://ai-engineer-os-inky.vercel.app`

---

## Authentication

### API Key Authentication

**⚠️ CRITICAL**: API key management endpoints (`/api/admin/api-keys`) are **DISABLED** until proper admin authentication is implemented. The project's authentication system (NextAuth) does not currently have role-based access control (RBAC) or admin roles defined.

**Status**: Returns 403 with `ADMIN_AUTH_REQUIRED` code for all operations (POST, GET, DELETE).

**Required Implementation**:
1. Add `role` field to `users` table (schema migration)
2. Implement admin role assignment (seed or UI)
3. Add admin check to NextAuth session
4. Update `checkAdminAuth()` in `src/app/api/admin/api-keys/route.ts` to verify admin role

### Rate Limiting

**⚠️ IMPORTANT**: Current rate limiting uses in-memory storage and is **NOT RELIABLE** in Vercel's serverless environment. Rate limits reset on server restart/deployment.

**Current Implementation**:
- Without API Key: 60 requests/minute (IP-based, enforced by MCP endpoint)
- With API Key: 1000 requests/hour (key-based, in-memory Map)

**Recommended for Production**:
- Implement Redis-based rate limiting (Upstash Redis on Vercel)
- Add distributed rate limiting across serverless instances
- Consider using Vercel's built-in rate limiting or Upstash Ratelimit

---

## REST API

### Phases

#### Get All Phases

```bash
GET /api/v1/phases
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "phaseNumber": 0,
      "slug": "00-setup-and-tooling",
      "title": "Setup & Tooling",
      "description": "Development environment setup",
      "lessonCount": 5
    }
  ],
  "total": 20
}
```

#### Get Phase Details

```bash
GET /api/v1/phases/{slug}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "phaseNumber": 0,
    "slug": "00-setup-and-tooling",
    "title": "Setup & Tooling",
    "description": "Development environment setup",
    "lessons": [
      {
        "slug": "01-dev-environment",
        "title": "Development Environment",
        "tagline": "Setting up your AI development workspace",
        "learningObjectives": ["Set up Python", "Configure Git"],
        "estimatedMinutes": 30
      }
    ],
    "lessonCount": 5
  }
}
```

### Lessons

#### Search Lessons

```bash
GET /api/v1/lessons?phase=1&query=transformer&limit=10
```

**Parameters**:
- `phase` (optional): Filter by phase number
- `query` (optional): Search query
- `limit` (optional): Max results (default: 10)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "phaseSlug": "07-sequence-models-nlp",
      "phaseNumber": 7,
      "slug": "01-transformers",
      "title": "Transformers",
      "tagline": "Understanding transformer architecture",
      "learningObjectives": ["Self-attention", "Positional encoding"],
      "estimatedMinutes": 45
    }
  ],
  "total": 1
}
```

#### Get Lesson Details

```bash
GET /api/v1/lessons/{phaseSlug}/{lessonSlug}?includeContent=true
```

**Parameters**:
- `includeContent` (optional): Include full markdown content (default: false)

**Response**:
```json
{
  "success": true,
  "data": {
    "slug": "01-transformers",
    "title": "Transformers",
    "tagline": "Understanding transformer architecture",
    "learningObjectives": ["Self-attention", "Positional encoding"],
    "estimatedMinutes": 45,
    "upstreamAttribution": {
      "source": "AI Engineering from Scratch",
      "url": "https://github.com/..."
    },
    "markdownContent": "# Transformers\n\n...",
    "codeFiles": [
      {
        "filename": "transformer.py",
        "language": "python",
        "content": "..."
      }
    ]
  }
}
```

### Resources

#### Search Resources

```bash
GET /api/v1/resources?lessonId=xxx&type=video&query=transformer&limit=10
```

**Parameters**:
- `lessonId` (optional): Filter by lesson
- `type` (optional): Filter by type (video, article, documentation, repository)
- `query` (optional): Search query
- `limit` (optional): Max results (default: 10)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "res_123",
      "key": "transformer-paper",
      "type": "article",
      "title": "Attention Is All You Need",
      "description": "Original transformer paper",
      "canonicalUrl": "https://arxiv.org/abs/1706.03762",
      "verificationStatus": "VERIFIED",
      "editorialStatus": "PUBLISHED",
      "license": "MIT",
      "sourcePlatform": "arxiv",
      "tags": ["transformers", "attention"]
    }
  ],
  "total": 1
}
```

### Projects

#### Search Projects

```bash
GET /api/v1/projects?phase=1&query=ml&limit=10
```

**Parameters**:
- `phase` (optional): Filter by phase slug
- `query` (optional): Search query
- `limit` (optional): Max results (default: 10)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "slug": "mnist-classifier",
      "title": "MNIST Classifier",
      "description": "Build a digit classifier from scratch",
      "level": "beginner",
      "skillTracks": ["Computer Vision", "Deep Learning"],
      "phaseSlugs": ["05-neural-network-foundations"],
      "estimatedHours": 8
    }
  ],
  "total": 1
}
```

### Quiz Engine

#### Generate Quiz

```bash
GET /api/v1/quiz/{phaseSlug}/{lessonSlug}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "lessonSlug": "01-transformers",
    "lessonTitle": "Transformers",
    "totalQuestions": 5,
    "questions": [
      {
        "id": "q1",
        "question": "Based on this learning objective: 'Self-attention mechanism', which concept is most relevant?",
        "options": [
          "Option A: Self-attention based understanding",
          "Option B: Convolution based understanding",
          "Option C: RNN based understanding",
          "Option D: MLP based understanding"
        ],
        "correctAnswer": "A",
        "explanation": "This question tests understanding of: Self-attention mechanism"
      }
    ],
    "estimatedTime": 10
  }
}
```

### Analytics

#### Get Curriculum Analytics

```bash
GET /api/v1/analytics
```

**Response**:
```json
{
  "success": true,
  "data": {
    "curriculum": {
      "totalPhases": 20,
      "totalLessons": 542,
      "averageLessonsPerPhase": 27,
      "firstPhase": "00-setup-and-tooling",
      "lastPhase": "20-advanced-topics"
    },
    "projects": {
      "total": 45,
      "byLevel": {
        "beginner": 15,
        "intermediate": 20,
        "advanced": 10
      }
    },
    "resources": {
      "total": 200,
      "byType": {
        "video": 80,
        "article": 60,
        "documentation": 40,
        "repository": 20
      },
      "verified": 180
    }
  }
}
```

---

## MCP Protocol

The MCP endpoint provides a standardized interface for AI agents using JSON-RPC 2.0.

**Endpoint**: `https://ai-engineer-os-inky.vercel.app/api/mcp`

### Available Tools

#### get_system_status
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_system_status",
    "arguments": {}
  }
}
```

#### search_curriculum
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_curriculum",
    "arguments": {
      "query": "transformer",
      "phase": 7,
      "limit": 5
    }
  }
}
```

#### get_lesson
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_lesson",
    "arguments": {
      "phaseSlug": "07-sequence-models-nlp",
      "lessonSlug": "01-transformers",
      "includeContent": true
    }
  }
}
```

#### get_learning_resources
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_learning_resources",
    "arguments": {
      "type": "video",
      "limit": 10
    }
  }
}
```

#### search_projects
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_projects",
    "arguments": {
      "query": "llm",
      "limit": 5
    }
  }
}
```

#### get_project
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_project",
    "arguments": {
      "slug": "mnist-classifier"
    }
  }
}
```

#### get_all_phases
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_all_phases",
    "arguments": {}
  }
}
```

#### get_phase_details
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_phase_details",
    "arguments": {
      "phaseSlug": "07-sequence-models-nlp"
    }
  }
}
```

#### suggest_learning_path
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "suggest_learning_path",
    "arguments": {
      "goal": "LLM engineering",
      "currentPhase": 5,
      "timeAvailable": "10 hours/week"
    }
  }
}
```

#### get_curriculum_analytics
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_curriculum_analytics",
    "arguments": {}
  }
}
```

#### get_learning_recommendations
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_learning_recommendations",
    "arguments": {
      "goal": "LLM",
      "currentPhase": 8,
      "skillLevel": "intermediate"
    }
  }
}
```

### Available Resources

- `ai-engineer://curriculum/phases` - Phase index
- `ai-engineer://curriculum/lesson-counts` - Lesson counts per phase
- `ai-engineer://stats/overview` - Overall statistics
- `ai-engineer://resources/catalog` - Resource catalog

---

## Webhooks

Webhooks allow you to receive real-time notifications about curriculum updates.

### Register a Webhook

```bash
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["lesson.updated", "resource.added"],
  "secret": "your-webhook-secret"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "webhookId": "wh_1234567890_abc123",
    "url": "https://your-server.com/webhook",
    "events": ["lesson.updated", "resource.added"],
    "message": "Webhook registered successfully"
  }
}
```

### Available Events

- `lesson.updated` - Lesson content updated
- `resource.added` - New resource added
- `resource.verified` - Resource verification status changed
- `project.added` - New project added

### Webhook Payload

Webhooks send POST requests with the following headers:

- `X-Webhook-Event`: The event type
- `X-Webhook-Signature`: HMAC-SHA256 signature (includes nonce and timestamp)
- `X-Webhook-Timestamp`: Unix timestamp
- `X-Webhook-Nonce`: Random nonce for replay protection

**Payload Example**:
```json
{
  "event": "lesson.updated",
  "timestamp": 1699999999,
  "nonce": "abc123...",
  "data": {
    "phaseSlug": "07-sequence-models-nlp",
    "lessonSlug": "01-transformers",
    "changes": ["content", "objectives"]
  }
}
```

**Security Note**: Webhook signature includes nonce and timestamp for replay attack protection. Consumers should verify both are recent and unique.

### Webhook Security

**✅ Hardened for Production Security**:

Webhook registration and delivery includes comprehensive security protections:

- **SSRF Protection**: Blocks private/internal IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
- **IPv6 Protection**: Blocks IPv6 internal addresses (fe80:, fc00:, fd, ::)
- **Metadata Protection**: Blocks cloud metadata endpoints (metadata.google.internal, 169.254.169.254)
- **DNS Rebinding Protection**: Blocks `.internal`, `.local`, `.corp` domains
- **Replay Attack Protection**: Nonce-based HMAC signatures with timestamps
- **Redirect Protection**: `redirect: manual` in fetch to prevent SSRF via redirects
- **Timeout Protection**: 10-second timeout on webhook delivery
- **Protocol Enforcement**: Only HTTPS URLs allowed (localhost allowed for development)

**Consumer Requirements**:
- Update signature verification to include nonce and timestamp
- Reject replayed nonces and old timestamps (>5 minutes)
- Use HTTPS for webhook endpoints
- Verify webhook URL on first delivery (optional)

### List Webhooks

```bash
GET /api/webhooks
```

### Delete Webhook

```bash
DELETE /api/webhooks
Content-Type: application/json

{
  "webhookId": "wh_1234567890_abc123"
}
```

---

## Streaming

For long content, use Server-Sent Events (SSE) for streaming delivery.

### Stream Lesson Content

```bash
GET /api/v1/stream/{phaseSlug}/{lessonSlug}
```

**Response Format** (Server-Sent Events):

```
data: {"type":"metadata","data":{"slug":"01-transformers","title":"Transformers",...}}

data: {"type":"content","data":"# Transformers\n\n","progress":5}

data: {"type":"content","data":"The transformer architecture...","progress":10}

...

data: {"type":"done","data":{"totalLength":15000}}
```

**Client Example (JavaScript)**:
```javascript
const eventSource = new EventSource('/api/v1/stream/07-sequence-models-nlp/01-transformers');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'metadata') {
    console.log('Lesson metadata:', data.data);
  } else if (data.type === 'content') {
    console.log('Content chunk:', data.data);
    console.log('Progress:', data.data.progress + '%');
  } else if (data.type === 'done') {
    console.log('Streaming complete');
    eventSource.close();
  }
};
```

---

## Rate Limiting

### Without API Key
- **Limit**: 60 requests per minute
- **Based on**: IP address
- **Headers**: None required

### With API Key
- **Limit**: 1000 requests per hour
- **Based on**: API key
- **Headers**: `X-API-Key: your-api-key`

### Rate Limit Response

When rate limited, you'll receive:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

**HTTP Status**: 429

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional details (optional)"
}
```

### Common Error Codes

- `MISSING_API_KEY` - API key required but not provided
- `INVALID_API_KEY` - API key is invalid
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `NOT_FOUND` - Resource not found
- `INVALID_REQUEST` - Invalid request parameters
- `INTERNAL_ERROR` - Server error

### HTTP Status Codes

- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Internal server error

---

## Examples

### Example 1: Get All Phases

```bash
curl https://ai-engineer-os-inky.vercel.app/api/v1/phases
```

### Example 2: Search for Transformer Lessons

```bash
curl "https://ai-engineer-os-inky.vercel.app/api/v1/lessons?query=transformer&limit=5"
```

### Example 3: Get Lesson with Content (Authenticated)

```bash
curl -H "X-API-Key: aios_abc123..." \
  "https://ai-engineer-os-inky.vercel.app/api/v1/lessons/07-sequence-models-nlp/01-transformers?includeContent=true"
```

### Example 4: Stream Lesson Content

```javascript
const eventSource = new EventSource(
  'https://ai-engineer-os-inky.vercel.app/api/v1/stream/07-sequence-models-nlp/01-transformers'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### Example 5: MCP Tool Call

```bash
curl -X POST https://ai-engineer-os-inky.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_curriculum",
      "arguments": {
        "query": "transformer",
        "limit": 5
      }
    }
  }'
```

### Example 6: Register Webhook

```bash
curl -X POST https://ai-engineer-os-inky.vercel.app/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["lesson.updated", "resource.added"]
  }'
```

---

## Support

For API support:
- Documentation: `/docs/API_DOCUMENTATION.md`
- Issues: [GitHub Issues](https://github.com/khrish11/AI-ENGINEER/issues)
- Discussions: [GitHub Discussions](https://github.com/khrish11/AI-ENGINEER/discussions)
