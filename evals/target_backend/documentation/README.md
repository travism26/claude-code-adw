# GrowBuddy Backend Services Documentation

Welcome to the GrowBuddy backend services documentation. This guide covers the three core real-time services that power GrowBuddy's AI-driven plant care features.

## Table of Contents

- [Overview](#overview)
- [Service Architecture](#service-architecture)
- [Quick Start](#quick-start)
- [Individual Service Documentation](#individual-service-documentation)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)

## Overview

GrowBuddy uses three interconnected services to provide real-time AI-powered plant care recommendations:

1. **Queue Service** - Asynchronous job processing using BullMQ and Redis
2. **WebSocket Service** - Real-time bidirectional communication using Socket.IO
3. **AI Service (AIWrapper)** - AI model integration with Anthropic Claude and OpenAI

These services work together to:
- Accept AI task requests via REST API
- Queue and process tasks asynchronously
- Generate AI-powered plant care recommendations
- Push real-time notifications to connected clients

## Service Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HTTP/REST API Layer                           │
│                      (Express Routes: /api/ai-tasks)                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Queue Service                                 │
│                         (BullMQ + Redis)                                │
│  - Enqueues AI tasks                                                    │
│  - Manages job lifecycle (pending → active → completed/failed)          │
│  - Handles retries with exponential backoff                             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          AI Task Worker                                 │
│                       (Background Process)                              │
│  - Polls queue for pending jobs                                         │
│  - Invokes AI Service for each job                                      │
│  - Updates job status                                                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          AI Service (AIWrapper)                         │
│                      (Anthropic Claude / OpenAI)                        │
│  - Builds prompts based on task type                                    │
│  - Calls AI API with retry logic                                        │
│  - Sanitizes and validates responses                                    │
│  - Publishes results to MessageBus                                      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Message Bus                                    │
│                      (In-Memory Event Emitter)                          │
│  - Decouples services via pub/sub pattern                              │
│  - Events: AI_RESULT_READY, AI_TASK_FAILED, AI_TASK_STARTED            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        WebSocket Service                                │
│                          (Socket.IO)                                    │
│  - Listens to MessageBus events                                         │
│  - Pushes real-time notifications to connected clients                  │
│  - Manages authenticated connections with JWT                           │
│  - Uses user-specific rooms for targeted messaging                      │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend Clients                                │
│                   (React/Next.js with Socket.IO)                        │
│  - Connects to WebSocket server with JWT                                │
│  - Receives AI suggestions in real-time                                 │
│  - Updates UI without polling                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Example

Here's what happens when a user requests a plant care recommendation:

1. **Client Request**: Frontend sends POST to `/api/ai-tasks` with task type and payload
2. **Queue Enqueue**: API route validates request and enqueues job in Redis via Queue Service
3. **Immediate Response**: API returns 202 Accepted with job ID
4. **Worker Processing**: AI Task Worker picks up job from queue
5. **AI Inference**: Worker calls AIWrapper which:
   - Builds task-specific prompt
   - Calls Anthropic Claude (or OpenAI as fallback)
   - Validates and sanitizes response
   - Stores result in PostgreSQL
   - Publishes `AI_RESULT_READY` event to MessageBus
6. **Real-time Notification**: WebSocket Service:
   - Receives event from MessageBus
   - Emits `ai_suggestion_ready` to user's Socket.IO room
7. **Client Update**: Frontend receives WebSocket event and updates UI instantly

### Service Communication Pattern

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Queue     │         │  AIWrapper   │         │  WebSocket   │
│   Service    │         │   Service    │         │   Service    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. Process Job        │                        │
       │ ─────────────────────> │                        │
       │                        │                        │
       │                        │  2. Publish Event      │
       │                        │ ─────────────────────> │
       │                        │    (MessageBus)        │
       │                        │                        │
       │                        │                        │  3. Emit to Client
       │                        │                        │ ─────────────────>
       │                        │                        │
```

**Key Design Principles:**
- **Decoupling**: Services communicate via interfaces and message bus, not direct dependencies
- **Scalability**: Queue allows horizontal scaling of workers
- **Reliability**: Jobs persist in Redis, surviving server restarts
- **Real-time UX**: WebSocket provides instant feedback without polling
- **Security**: JWT authentication at both API and WebSocket layers

## Quick Start

### Prerequisites

- Node.js 18+ and npm/pnpm
- PostgreSQL 14+
- Redis 6+
- Anthropic API key or OpenAI API key

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   - Database connection (PostgreSQL)
   - Redis connection
   - AI provider API keys (Anthropic or OpenAI)
   - JWT secret
   - WebSocket CORS origins

3. **Start Redis** (if not already running):
   ```bash
   redis-server
   ```

4. **Run database migrations**:
   ```bash
   npm run migrate
   ```

5. **Start the server**:
   ```bash
   npm run dev
   ```

The server will:
- Initialize Queue Service and Worker
- Initialize WebSocket Service
- Initialize AI Service
- Start listening on configured port (default: 3001)

### Verify Services

1. **Check health endpoint**:
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{ "status": "healthy", "queue": "connected" }`

2. **Check WebSocket connection** (requires JWT token):
   ```javascript
   import { io } from 'socket.io-client';

   const socket = io('http://localhost:3001', {
     auth: { token: 'your-jwt-token' }
   });

   socket.on('authenticated', (data) => {
     console.log('Connected:', data);
   });
   ```

3. **Enqueue a test AI task**:
   ```bash
   curl -X POST http://localhost:3001/api/ai-tasks \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-jwt-token" \
     -d '{
       "type": "care_recommendation",
       "payload": {
         "plantType": "tomato",
         "growthStage": "flowering"
       }
     }'
   ```

## Individual Service Documentation

For detailed information about each service:

- **[Queue Service](./QUEUE_SERVICE.md)** - Job processing, programmatic usage, monitoring
- **[WebSocket Service](./WEBSOCKET_SERVICE.md)** - Real-time connections, authentication, events
- **[AI Service](./AI_SERVICE.md)** - AI integration, task types, prompt building

## Environment Variables

### Required Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=growbuddy

# Server
PORT=3001
JWT_SECRET=your_jwt_secret_here

# AI Provider (at least one required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
# OR
OPENAI_API_KEY=your_openai_api_key_here

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Optional Variables

```bash
# AI Configuration
AI_DEFAULT_PROVIDER=anthropic          # 'anthropic' or 'openai'
AI_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
AI_OPENAI_MODEL=gpt-4-turbo-preview
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7
AI_TIMEOUT=30000
AI_RETRY_ATTEMPTS=3
AI_RETRY_DELAY=1000

# Redis Advanced
REDIS_PASSWORD=
REDIS_DB=0

# Queue Configuration
QUEUE_CONCURRENCY=5                     # Concurrent jobs per worker
QUEUE_MAX_RETRIES=3                     # Max retry attempts
QUEUE_RETRY_DELAY=1000                  # Base retry delay (ms)

# WebSocket Configuration
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
WEBSOCKET_AUTH_REQUIRED=true
```

See [.env.example](../.env.example) for the complete list with descriptions.

## Troubleshooting

### Decision Tree

```
Problem: Services not starting
├─> Check: Is PostgreSQL running?
│   └─> No: Start PostgreSQL
│   └─> Yes: Continue
│
├─> Check: Is Redis running?
│   └─> No: Start Redis with `redis-server`
│   └─> Yes: Continue
│
├─> Check: Are environment variables set?
│   └─> No: Copy .env.example to .env and configure
│   └─> Yes: Continue
│
└─> Check: Are migrations up to date?
    └─> No: Run `npm run migrate`
    └─> Yes: Check logs for specific errors
```

### Common Issues

#### Queue Service

**Problem**: Jobs stuck in pending state
- **Check**: Is the worker running? Look for "Worker started" in logs
- **Check**: Is Redis accessible? Test with `redis-cli PING`
- **Check**: Are AI API keys configured correctly?
- **Solution**: See [Queue Service Troubleshooting](./QUEUE_SERVICE.md#troubleshooting)

#### WebSocket Service

**Problem**: Client can't connect to WebSocket
- **Check**: Is JWT token valid and not expired?
- **Check**: Is CORS origin whitelisted in `WEBSOCKET_CORS_ORIGIN`?
- **Check**: Is server running and accessible?
- **Solution**: See [WebSocket Service Troubleshooting](./WEBSOCKET_SERVICE.md#troubleshooting)

#### AI Service

**Problem**: AI requests failing
- **Check**: Is at least one AI provider API key configured?
- **Check**: Are you hitting API rate limits?
- **Check**: Is the AI provider service operational?
- **Solution**: See [AI Service Troubleshooting](./AI_SERVICE.md#troubleshooting)

### Logging

All services log to console with prefixes:
- `[QueueModule]` - Queue service logs
- `[AITaskWorker]` - Worker logs
- `[AIWrapper]` - AI service logs
- `[WebSocketService]` or `WebSocket` - WebSocket logs
- `[MessageBus]` - Message bus logs

Increase verbosity by setting `LOG_LEVEL=debug` (if implemented).

### Health Checks

Monitor service health:

```bash
# Overall health
curl http://localhost:3001/health

# Queue metrics
# (Programmatically, see Queue Service docs)
const queueService = getQueueService();
const metrics = await queueService.getMetrics();

# WebSocket stats
# (Programmatically)
const wsService = getWebSocketService();
const stats = wsService.getStats();
```

## Testing

### Run All Tests

```bash
npm test
```

### Test Individual Services

```bash
# Queue service tests
npm run test:services

# API integration tests (includes Queue + AI)
npm run test:api

# WebSocket tests
npm run test:websocket
```

### Manual Testing

1. **Test Queue Service**:
   See [Queue Service - Testing](./QUEUE_SERVICE.md#testing)

2. **Test WebSocket Service**:
   See [WebSocket Service - Testing](./WEBSOCKET_SERVICE.md#testing-websocket-connections)

3. **Test AI Service**:
   See [AI Service - Testing](./AI_SERVICE.md#testing)

## Additional Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Main Project README](../../README.md)

## Support

For issues or questions:
1. Check the troubleshooting sections in individual service docs
2. Review server logs for error messages
3. Check that all prerequisites are running (PostgreSQL, Redis)
4. Verify environment variables are correctly configured
5. Consult the test files for usage examples

---

**Last Updated**: 2025-01-23
**Version**: 1.0.0
