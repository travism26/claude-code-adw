# WebSocket Service Documentation

The GrowBuddy WebSocket Service provides real-time bidirectional communication between the server and clients using Socket.IO. It enables instant delivery of AI suggestions, task updates, and other notifications without polling.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Event Types](#event-types)
- [Client Integration](#client-integration)
- [Rooms and Namespaces](#rooms-and-namespaces)
- [Message Bus Integration](#message-bus-integration)
- [Configuration](#configuration)
- [Security](#security)
- [Monitoring](#monitoring)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

## Overview

The WebSocket Service listens for events from the Message Bus and pushes real-time notifications to connected clients. This eliminates the need for clients to poll the API for job status updates.

### Key Features

- **Real-time Communication**: Instant push notifications to clients
- **JWT Authentication**: Secure connections with token-based auth
- **User-Specific Rooms**: Targeted messaging using Socket.IO rooms
- **Connection Management**: Automatic reconnection and state recovery
- **Message Bus Integration**: Decoupled event-driven architecture
- **Rate Limiting**: Connection limits per user to prevent abuse

### Use Cases

- AI suggestion delivery to users in real-time
- Task status updates (started, completed, failed)
- Future: Garden collaboration, live plant monitoring
- Future: Multi-user chat and notifications

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Client                         │
│                   (React + Socket.IO)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket Connection
                            │ (with JWT token)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  WebSocket Service                          │
│                     (Socket.IO Server)                      │
│                                                             │
│  1. Authentication Middleware (JWT verification)            │
│  2. Connection Management (user rooms, tracking)            │
│  3. Event Handlers (connection, disconnect, error)          │
│  4. Message Bus Subscribers (listen for events)             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Subscribe to events
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Message Bus                            │
│                 (In-Memory EventEmitter)                    │
│                                                             │
│  Events:                                                    │
│  - AI_RESULT_READY                                          │
│  - AI_TASK_FAILED                                           │
│  - AI_TASK_STARTED                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Publish events
                            ▲
┌─────────────────────────────────────────────────────────────┐
│                      AI Service / Worker                    │
│  (Publishes events when AI tasks complete)                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: AI Task to Real-time Notification

```
Step 1: Client requests AI task
  Client → POST /api/ai-tasks → Queue Service

Step 2: Worker processes job
  Worker picks up job → Calls AIWrapper

Step 3: AIWrapper publishes result
  AIWrapper → messageBus.publish(AI_RESULT_READY, {...})

Step 4: WebSocket receives event
  MessageBus → WebSocketService.handleAIResultReady()

Step 5: WebSocket emits to client
  WebSocketService → io.to('user:userId').emit('ai_suggestion_ready', {...})

Step 6: Client receives notification
  Client socket.on('ai_suggestion_ready') → Update UI
```

### Design Principles

1. **Decoupling**: WebSocket Service doesn't know about Queue or AI Service directly
2. **Event-Driven**: Uses Message Bus for loosely-coupled communication
3. **Security**: JWT authentication required for all connections
4. **Scalability**: Room-based messaging for efficient targeted broadcasts
5. **Resilience**: Connection state recovery for automatic reconnection

## Getting Started

### Prerequisites

- Server running with JWT authentication configured
- `JWT_SECRET` environment variable set
- Frontend with Socket.IO client library

### Server Initialization

The WebSocket Service is automatically initialized during server startup:

```typescript
// In src/index.ts
import { WebSocketService } from './services/websocket';
import http from 'http';

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket service
const wsService = new WebSocketService(server, sequelize);

// Start listening
server.listen(PORT, () => {
  console.log(`Server with WebSocket listening on port ${PORT}`);
});
```

### Server Shutdown

Gracefully shutdown WebSocket connections:

```typescript
// During server shutdown
await wsService.shutdown();
console.log('WebSocket service shut down gracefully');
```

## Authentication

The WebSocket Service requires JWT authentication for all connections (unless disabled via `WEBSOCKET_AUTH_REQUIRED=false`).

### Authentication Flow

```
1. Client obtains JWT token (via login API)
   POST /api/auth/login → { token: "eyJhbGc..." }

2. Client connects with token
   socket = io(URL, { auth: { token: "eyJhbGc..." } })

3. Server verifies token
   - Decode JWT
   - Verify signature with JWT_SECRET
   - Check expiration
   - Load user from database

4a. Success: Connection established
   - Attach userId to socket
   - Join user-specific room
   - Emit 'authenticated' event

4b. Failure: Connection rejected
   - Emit 'authentication_error' event
   - Disconnect socket
```

### Token Verification

The authentication middleware verifies JWT tokens:

```typescript
// In WebSocketService
private async authenticationMiddleware(socket, next) {
  try {
    // Extract token from auth, header, or query
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1] ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT
    const payload = jwt.verify(token, this.jwtSecret);

    // Load user
    const user = await User.findByPk(payload.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    // Check connection limit
    if (userConnections >= MAX_CONNECTIONS_PER_USER) {
      return next(new Error('Maximum connections per user exceeded'));
    }

    // Attach user to socket
    socket.userId = user.id;
    socket.user = user;

    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
}
```

### Token Formats

The server accepts tokens in multiple formats:

**1. Auth object** (recommended):
```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'eyJhbGc...' }
});
```

**2. Authorization header**:
```javascript
const socket = io('http://localhost:3001', {
  extraHeaders: {
    Authorization: 'Bearer eyJhbGc...'
  }
});
```

**3. Query parameter** (fallback):
```javascript
const socket = io('http://localhost:3001', {
  query: { token: 'eyJhbGc...' }
});
```

## Event Types

### Client-to-Server Events

| Event | Description | Payload |
|-------|-------------|---------|
| `connection` | Client connects to server | N/A |
| `disconnect` | Client disconnects | N/A |
| `error` | Error occurred | `Error` object |

### Server-to-Client Events

| Event | Description | Payload |
|-------|-------------|---------|
| `authenticated` | Authentication successful | `{ message, userId, socketId }` |
| `authentication_error` | Authentication failed | `{ error }` |
| `ai_suggestion_ready` | AI task completed successfully | `{ taskId, suggestion, plantId, timestamp, type }` |
| `ai_task_failed` | AI task failed | `{ taskId, error, timestamp, type }` |
| `ai_task_started` | AI task started processing | `{ taskId, timestamp, type }` |

### Event Payloads

#### `authenticated`

```json
{
  "message": "Successfully authenticated",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "socketId": "XYZ123"
}
```

#### `ai_suggestion_ready`

```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "suggestion": {
    "type": "care_recommendation",
    "content": "Water your tomato plant with 1-2 cups of water",
    "confidence": 0.92,
    "actionItems": [
      "Water in the morning to reduce evaporation",
      "Check soil moisture before watering"
    ]
  },
  "plantId": "plant-uuid-here",
  "timestamp": "2025-01-23T10:30:05.000Z",
  "type": "success"
}
```

#### `ai_task_failed`

```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "error": "AI API rate limit exceeded",
  "timestamp": "2025-01-23T10:30:05.000Z",
  "type": "error"
}
```

#### `ai_task_started`

```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-01-23T10:30:00.000Z",
  "type": "info"
}
```

## Client Integration

### React Example

#### Install Socket.IO Client

```bash
npm install socket.io-client
```

#### Create WebSocket Hook

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    // Connect to WebSocket server
    const newSocket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Handle connection
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      setError(null);
    });

    // Handle authentication
    newSocket.on('authenticated', (data) => {
      console.log('Authenticated:', data);
    });

    // Handle authentication errors
    newSocket.on('authentication_error', (data) => {
      console.error('Authentication error:', data.error);
      setError(data.error);
      setConnected(false);
    });

    // Handle disconnection
    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
    });

    // Handle errors
    newSocket.on('error', (err) => {
      console.error('WebSocket error:', err);
      setError(err.message);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [token]);

  return { socket, connected, error };
}
```

#### Use in Component

```typescript
// src/components/Dashboard.tsx
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';

export function Dashboard() {
  const { token } = useAuth();
  const { socket, connected } = useWebSocket(token);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for AI suggestions
    socket.on('ai_suggestion_ready', (data) => {
      console.log('New AI suggestion:', data);

      setSuggestions(prev => [...prev, {
        id: data.taskId,
        content: data.suggestion.content,
        confidence: data.suggestion.confidence,
        timestamp: data.timestamp,
      }]);

      // Show notification
      showNotification('New plant care suggestion!', data.suggestion.content);
    });

    // Listen for task failures
    socket.on('ai_task_failed', (data) => {
      console.error('AI task failed:', data);
      showError(`Task ${data.taskId} failed: ${data.error}`);
    });

    // Listen for task started
    socket.on('ai_task_started', (data) => {
      console.log('AI task started:', data.taskId);
      showInfo('Processing your request...');
    });

    // Cleanup
    return () => {
      socket.off('ai_suggestion_ready');
      socket.off('ai_task_failed');
      socket.off('ai_task_started');
    };
  }, [socket]);

  return (
    <div>
      <h1>Dashboard</h1>
      <div>
        Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <h2>AI Suggestions</h2>
      {suggestions.map(suggestion => (
        <div key={suggestion.id}>
          <p>{suggestion.content}</p>
          <small>Confidence: {(suggestion.confidence * 100).toFixed(0)}%</small>
        </div>
      ))}
    </div>
  );
}
```

### Vanilla JavaScript Example

```javascript
// Import Socket.IO client
import { io } from 'socket.io-client';

// Get JWT token (from localStorage, cookie, etc.)
const token = localStorage.getItem('authToken');

// Connect to server
const socket = io('http://localhost:3001', {
  auth: { token },
});

// Handle authentication success
socket.on('authenticated', (data) => {
  console.log('Connected and authenticated:', data);
});

// Handle authentication error
socket.on('authentication_error', (data) => {
  console.error('Auth error:', data.error);
  alert('Failed to authenticate WebSocket connection');
});

// Listen for AI suggestions
socket.on('ai_suggestion_ready', (data) => {
  console.log('AI suggestion received:', data);

  // Update UI
  const suggestionDiv = document.getElementById('suggestions');
  suggestionDiv.innerHTML += `
    <div class="suggestion">
      <h3>${data.suggestion.type}</h3>
      <p>${data.suggestion.content}</p>
      <small>Confidence: ${(data.suggestion.confidence * 100).toFixed(0)}%</small>
    </div>
  `;

  // Show notification
  new Notification('New Plant Care Suggestion', {
    body: data.suggestion.content,
  });
});

// Listen for task failures
socket.on('ai_task_failed', (data) => {
  console.error('Task failed:', data);
  alert(`AI task failed: ${data.error}`);
});

// Listen for task started
socket.on('ai_task_started', (data) => {
  console.log('Task started:', data.taskId);
  showLoadingIndicator();
});

// Handle disconnection
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  updateConnectionStatus('Disconnected');
});

// Handle reconnection
socket.on('connect', () => {
  console.log('Reconnected!');
  updateConnectionStatus('Connected');
});
```

## Rooms and Namespaces

The WebSocket Service uses Socket.IO rooms for targeted messaging.

### User Rooms

Every authenticated user is automatically joined to a user-specific room:

```typescript
// Room naming convention
const userRoom = `user:${userId}`;

// Server: Emit to specific user
io.to(`user:${userId}`).emit('ai_suggestion_ready', data);

// All sockets for that user receive the event
```

**Benefits**:
- Targeted messaging (only the intended user receives events)
- Support for multiple connections per user (mobile + web)
- Easy to implement without complex socket tracking

### Future: Garden Rooms

For collaboration features (planned):

```typescript
// Room naming
const gardenRoom = `garden:${gardenId}`;

// Join garden room
socket.join(`garden:${gardenId}`);

// Broadcast to all users in a garden
io.to(`garden:${gardenId}`).emit('plant_updated', { plantId, updates });
```

### Future: Plant Rooms

For plant-specific updates (planned):

```typescript
// Room naming
const plantRoom = `plant:${plantId}`;

// Join plant room
socket.join(`plant:${plantId}`);

// Notify all users watching a specific plant
io.to(`plant:${plantId}`).emit('growth_milestone', { plantId, milestone });
```

## Message Bus Integration

The WebSocket Service subscribes to Message Bus events and forwards them to clients.

### Message Bus Events

The Message Bus is an in-memory event emitter that decouples services:

```typescript
// AI Service publishes event
messageBus.publish(MessageBusEvent.AI_RESULT_READY, {
  taskId: '123',
  userId: 'user-456',
  suggestion: { ... },
  timestamp: new Date(),
});

// WebSocket Service receives event
// (subscribed during initialization)
// and emits to the user's room
```

### Subscription Setup

During initialization, WebSocket Service subscribes to Message Bus events:

```typescript
// In WebSocketService constructor
this.subscribeToMessageBus();

private subscribeToMessageBus(): void {
  // Subscribe to AI result ready
  messageBus.subscribe(
    MessageBusEvent.AI_RESULT_READY,
    this.handleAIResultReady.bind(this)
  );

  // Subscribe to AI task failed
  messageBus.subscribe(
    MessageBusEvent.AI_TASK_FAILED,
    this.handleAITaskFailed.bind(this)
  );

  // Subscribe to AI task started
  messageBus.subscribe(
    MessageBusEvent.AI_TASK_STARTED,
    this.handleAITaskStarted.bind(this)
  );
}
```

### Event Handlers

```typescript
private async handleAIResultReady(payload: AIResultReadyPayload): Promise<void> {
  const { userId, taskId, suggestion, plantId, timestamp } = payload;

  // Emit to user-specific room
  this.io.to(`user:${userId}`).emit('ai_suggestion_ready', {
    taskId,
    suggestion,
    plantId,
    timestamp: timestamp.toISOString(),
    type: 'success',
  });

  console.log(`Emitted AI suggestion to user ${userId} for task ${taskId}`);
}
```

### Why Message Bus?

**Benefits**:
- **Decoupling**: AI Service doesn't know about WebSocket Service
- **Testability**: Easy to test services in isolation
- **Flexibility**: Add new subscribers without modifying publishers
- **Scalability**: Future: Replace with Redis Pub/Sub for multi-server support

## Configuration

### Environment Variables

```bash
# WebSocket CORS Origins (comma-separated)
WEBSOCKET_CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Require authentication (default: true)
WEBSOCKET_AUTH_REQUIRED=true

# JWT secret (must match auth service)
JWT_SECRET=your_jwt_secret_here
```

### Configuration Object

WebSocket configuration in `src/config/websocket.ts`:

```typescript
export interface WebSocketConfig {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  connectionStateRecovery?: {
    maxDisconnectionDuration: number; // ms
  };
  pingTimeout: number;    // ms
  pingInterval: number;   // ms
  authRequired: boolean;
}

export function getWebSocketConfig(): WebSocketConfig {
  return {
    cors: {
      origin: process.env.WEBSOCKET_CORS_ORIGIN?.split(',') ||
              ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    },
    pingTimeout: 60000,  // 60 seconds
    pingInterval: 25000, // 25 seconds
    authRequired: process.env.WEBSOCKET_AUTH_REQUIRED !== 'false',
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6, // 1MB
  };
}
```

### Connection Limits

```typescript
// Maximum connections per user (prevents abuse)
export const MAX_CONNECTIONS_PER_USER = 10;

// Connection rate limiting
export const CONNECTION_RATE_LIMIT = {
  windowMs: 60 * 1000,  // 1 minute window
  max: 10,              // 10 connection attempts per minute per IP
};
```

## Security

### JWT Authentication

- **Required by default**: All connections must provide valid JWT token
- **User verification**: Token is verified and user is loaded from database
- **Connection limit**: Maximum 10 connections per user prevents abuse

### CORS Protection

- **Origin whitelist**: Only allowed origins can connect
- **Credentials**: Cookie-based auth supported with `credentials: true`

**Configure allowed origins**:
```bash
WEBSOCKET_CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

### Token Expiration

JWT tokens expire after a configured period. Clients should:
1. Monitor token expiration
2. Refresh token before expiration
3. Reconnect with new token

```javascript
// Client-side token refresh
async function refreshTokenAndReconnect() {
  const newToken = await refreshAuthToken();

  // Disconnect old socket
  socket.disconnect();

  // Reconnect with new token
  socket.auth.token = newToken;
  socket.connect();
}
```

### Rate Limiting

**Connection limits** prevent abuse:
- Max 10 connections per user
- Max 10 connection attempts per minute per IP (planned)

### Best Practices

1. **Use HTTPS in production**: Encrypt WebSocket traffic with `wss://`
2. **Rotate JWT secrets**: Regularly update `JWT_SECRET`
3. **Monitor connections**: Log suspicious connection patterns
4. **Validate event data**: Sanitize all data sent to clients
5. **Implement timeouts**: Disconnect idle connections

## Monitoring

### Connection Statistics

Get real-time connection stats:

```typescript
import { wsService } from './services/websocket';

const stats = wsService.getStats();
console.log({
  totalUsers: stats.totalUsers,           // Unique users connected
  totalConnections: stats.totalConnections, // Total socket connections
  status: stats.status                    // 'connected'
});
```

### User Connection Count

Check if a specific user is connected:

```typescript
const userId = 'user-123';

const isConnected = wsService.isUserConnected(userId);
const connectionCount = wsService.getUserConnectionCount(userId);

console.log(`User ${userId}: ${isConnected ? 'online' : 'offline'}`);
console.log(`Active connections: ${connectionCount}`);
```

### Logging

WebSocket events are logged with prefixes:

```
WebSocket connected: XYZ123 (user: 550e8400-e29b-41d4-a716-446655440000)
WebSocket stats: 5 users, 7 connections
Emitted AI suggestion to user 550e8400-e29b-41d4-a716-446655440000 for task abc-123
WebSocket disconnected: XYZ123 (user: 550e8400-e29b-41d4-a716-446655440000)
```

## Testing

### Testing WebSocket Connections

#### Using Socket.IO Client

```javascript
import { io } from 'socket.io-client';

// Test connection
const socket = io('http://localhost:3001', {
  auth: { token: 'your-test-jwt-token' },
});

socket.on('connect', () => {
  console.log('✅ Connected');
});

socket.on('authenticated', (data) => {
  console.log('✅ Authenticated:', data);
});

socket.on('authentication_error', (data) => {
  console.error('❌ Auth failed:', data.error);
});

socket.on('ai_suggestion_ready', (data) => {
  console.log('✅ Received suggestion:', data);
});
```

#### Using curl (for HTTP upgrade)

```bash
# This won't work directly - WebSocket requires proper handshake
# Use a WebSocket client library instead
```

### Integration Tests

```typescript
// Example test (using Jest + Socket.IO client)
import { io, Socket } from 'socket.io-client';

describe('WebSocket Service', () => {
  let socket: Socket;

  beforeEach((done) => {
    socket = io('http://localhost:3001', {
      auth: { token: TEST_JWT_TOKEN },
    });
    socket.on('connect', done);
  });

  afterEach(() => {
    socket.close();
  });

  it('should authenticate successfully', (done) => {
    socket.on('authenticated', (data) => {
      expect(data.userId).toBeDefined();
      done();
    });
  });

  it('should receive AI suggestions', (done) => {
    socket.on('ai_suggestion_ready', (data) => {
      expect(data.taskId).toBeDefined();
      expect(data.suggestion).toBeDefined();
      done();
    });

    // Trigger an AI task
    // (this would be done via API in real test)
  });
});
```

## Troubleshooting

### Connection Refused

**Symptom**: Client can't connect to WebSocket server

**Diagnosis**:
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

**Common Causes**:
- Server not running
- Wrong URL or port
- CORS origin not whitelisted
- Firewall blocking WebSocket

**Solutions**:
- Verify server is running: `curl http://localhost:3001/health`
- Check CORS: Add your origin to `WEBSOCKET_CORS_ORIGIN`
- Check firewall: Allow port 3001
- Use correct transport: `transports: ['websocket', 'polling']`

### Authentication Errors

**Symptom**: `authentication_error` event received

**Diagnosis**:
```javascript
socket.on('authentication_error', (data) => {
  console.error('Auth error:', data.error);
});
```

**Common Causes**:
- Invalid JWT token
- Expired token
- Wrong JWT secret
- User not found in database

**Solutions**:
- Verify token is valid: Decode at jwt.io
- Check expiration: Refresh token
- Verify `JWT_SECRET` matches auth service
- Ensure user exists in database

### Not Receiving Events

**Symptom**: Client connected but not receiving events

**Diagnosis**:
```javascript
// Check if event listener is registered
socket.on('ai_suggestion_ready', (data) => {
  console.log('Received:', data);
});

// Verify connection
console.log('Connected:', socket.connected);
console.log('Socket ID:', socket.id);
```

**Common Causes**:
- Event listener not registered
- Wrong event name (typo)
- User not in correct room
- Message Bus not publishing events

**Solutions**:
- Verify event name matches server: `ai_suggestion_ready`
- Check server logs for "Emitted AI suggestion..."
- Test Message Bus: Manually publish test event
- Verify user is authenticated (in user room)

### Frequent Disconnections

**Symptom**: Socket disconnects frequently

**Diagnosis**:
```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Reasons: 'transport close', 'ping timeout', 'transport error', etc.
});
```

**Common Causes**:
- Network instability
- Ping timeout (heartbeat failure)
- Server restarting
- Token expiration

**Solutions**:
- Increase ping timeout: Adjust `pingTimeout` config
- Enable auto-reconnect: Socket.IO does this by default
- Refresh token before expiration
- Check network stability

### Memory Leaks

**Symptom**: Server memory grows over time

**Diagnosis**:
```bash
# Monitor memory
node --expose-gc index.js
# Check memory in Node.js process monitor
```

**Common Causes**:
- Event listeners not removed
- Socket connections not cleaned up
- Message Bus subscribers not unsubscribed

**Solutions**:
- Remove event listeners on disconnect
- Call `socket.removeAllListeners()` before close
- Unsubscribe from Message Bus on shutdown
- Monitor connection count: `wsService.getStats()`

## Advanced Topics

### Connection State Recovery

Socket.IO can recover connection state after brief disconnections:

```typescript
// Server: Already enabled in config
connectionStateRecovery: {
  maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
}

// Client: Automatically handled
socket.on('connect', () => {
  if (socket.recovered) {
    console.log('Connection recovered! Missed events:', socket.recovered);
  } else {
    console.log('New connection');
  }
});
```

### Broadcasting to Multiple Rooms

Send events to multiple rooms:

```typescript
// Emit to all users in a garden
io.to(`garden:${gardenId}`).emit('plant_added', { plantId });

// Emit to specific users
io.to(`user:${userId1}`).to(`user:${userId2}`).emit('notification', { ... });

// Emit to all connected clients
io.emit('system_announcement', { message: 'Maintenance in 5 minutes' });
```

### Custom Namespaces (Future)

Separate WebSocket namespaces for different features:

```typescript
// Create admin namespace
const adminNamespace = io.of('/admin');

adminNamespace.use(adminAuthMiddleware);
adminNamespace.on('connection', (socket) => {
  console.log('Admin connected');
});

// Client connects to namespace
const adminSocket = io('http://localhost:3001/admin', {
  auth: { token: adminToken },
});
```

### Scaling to Multiple Servers

For horizontal scaling, use Redis adapter:

```bash
npm install @socket.io/redis-adapter redis
```

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ host: 'localhost', port: 6379 });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));

// Now multiple server instances can communicate
```

---

## See Also

- [Main Documentation](./README.md)
- [Queue Service](./QUEUE_SERVICE.md) - Async job processing
- [AI Service](./AI_SERVICE.md) - AI inference details
- [Socket.IO Documentation](https://socket.io/docs/)

---

**Last Updated**: 2025-01-23
