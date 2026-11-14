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

### User Authentication

**✅ IMPLEMENTED**: Users sign in with Google OAuth via Auth.js/NextAuth. Authenticated users can manage their own API keys and webhooks.

**Status**: `/api/user/api-keys` and `/api/webhooks` require authentication via NextAuth session.

### API Key Authentication

**✅ IMPLEMENTED**: API keys are stored securely in PostgreSQL with SHA-256 hashes. Keys are only shown once during creation.

**User API Key Management**:
- `/api/user/api-keys` (POST, GET, DELETE) - Manage your own API keys
- Requires Google OAuth authentication
- Keys are cryptographically secure and stored as hashes
- Scopes: `read` (default), `write` (future), `admin` (platform admin only)

**Admin API Key Management**:
- `/api/admin/api-keys` (POST, GET, DELETE) - Manage any user's API keys
- Requires admin role in database
- For platform-wide operations only

### Rate Limiting

**✅ IMPLEMENTED**: Distributed rate limiting using PostgreSQL database. Works reliably in Vercel serverless environment.

**Current Implementation**:
- Without API Key: 60 requests/minute (IP-based)
- With API Key: 1000 requests/hour (key-based)
- Stored in PostgreSQL `rate_limits` table
- Automatic cleanup of expired windows

**Rate Limit Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: ISO timestamp when window resets

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

**✅ IMPLEMENTED**: Webhook management is now authenticated and uses PostgreSQL storage. Users can manage their own webhooks.

**User Webhook Management**:
- `/api/webhooks` (POST, GET, DELETE) - Manage your own webhooks
- Requires Google OAuth authentication
- Webhooks are stored in PostgreSQL with ownership verification
- URL validation with SSRF, DNS rebinding, and replay protection

### Register a Webhook

```bash
POST /api/webhooks
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "url": "https://your-server.com/webhook",
  "events": ["lesson.updated", "resource.added"]
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

Webhooks send POST requests with the following headers when triggered:

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

### Webhook Security

**✅ Hardened for Production Security**:

- **SSRF Protection**: Blocks private/internal IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
- **IPv6 Protection**: Blocks IPv6 internal addresses (fe80:, fc00:, fd, ::)
- **Metadata Protection**: Blocks cloud metadata endpoints (metadata.google.internal, 169.254.169.254)
- **DNS Rebinding Protection**: Resolves hostnames and checks resolved IPs against blocklist
- **Replay Attack Protection**: Nonce-based HMAC signatures with timestamps
- **Redirect Protection**: `redirect: manual` in fetch to prevent SSRF via redirects
- **Timeout Protection**: 10-second timeout on webhook delivery
- **Protocol Enforcement**: Only HTTPS URLs allowed (localhost allowed for development)

**Consumer Requirements**:
- Update signature verification to include nonce and timestamp
- Reject replayed nonces and old timestamps (>5 minutes)
- Use HTTPS for webhook endpoints
- Verify webhook URL on first delivery (optional)

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

### cURL

```bash
# Get all phases (public, no auth required)
curl https://ai-engineer-os-inky.vercel.app/api/v1/phases

# Get phase details with API key
curl -H "X-API-Key: aios_abc123..." https://ai-engineer-os-inky.vercel.app/api/v1/phases/07-sequence-models-nlp

# Stream lesson content
curl https://ai-engineer-os-inky.vercel.app/api/v1/stream/07-sequence-models-nlp/01-transformers
```

### Python

```python
import requests

# Public endpoint
response = requests.get("https://ai-engineer-os-inky.vercel.app/api/v1/phases")
print(response.json())

# With API key
headers = {"X-API-Key": "aios_abc123..."}
response = requests.get("https://ai-engineer-os-inky.vercel.app/api/v1/phases", headers=headers)
print(response.json())

# Stream lesson content
response = requests.get("https://ai-engineer-os-inky.vercel.app/api/v1/stream/07-sequence-models-nlp/01-transformers", stream=True)
for line in response.iter_lines():
    if line:
        print(line.decode())
```

### JavaScript/Node.js

```javascript
// Public endpoint
const response = await fetch("https://ai-engineer-os-inky.vercel.app/api/v1/phases");
const data = await response.json();
console.log(data);

// With API key
const response = await fetch("https://ai-engineer-os-inky.vercel.app/api/v1/phases", {
  headers: {
    "X-API-Key": "aios_abc123..."
  }
});
const data = await response.json();
console.log(data);

// Stream lesson content
const response = await fetch("https://ai-engineer-os-inky.vercel.app/api/v1/stream/07-sequence-models-nlp/01-transformers");
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

### MCP Configuration

```json
{
  "mcpServers": {
    "ai-engineer-os": {
      "url": "https://ai-engineer-os-inky.vercel.app/api/mcp",
      "transport": "sse"
    }
  }
}
```

### Webhook Signature Verification (Python)

```python
import hmac
import hashlib
import json
import time

def verify_webhook_signature(payload, signature, secret, nonce, timestamp):
    # Verify timestamp is recent (within 5 minutes)
    if abs(int(timestamp) - int(time.time())) > 300:
        return False
    
    # Compute expected signature
    hmac_obj = hmac.new(secret.encode(), nonce.encode(), hashlib.sha256)
    hmac_obj.update(timestamp.encode())
    hmac_obj.update(json.dumps(payload).encode())
    expected_signature = hmac_obj.hexdigest()
    
    # Use constant-time comparison
    return hmac.compare_digest(signature, expected_signature)
```
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
