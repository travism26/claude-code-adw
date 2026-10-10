import { ServerOptions } from 'socket.io';

/**
 * WebSocket event names
 * These constants ensure type safety and consistency across the application
 */
export const WEBSOCKET_EVENTS = {
  // Client-to-server events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Server-to-client events
  AI_SUGGESTION_READY: 'ai_suggestion_ready',
  AI_TASK_FAILED: 'ai_task_failed',
  AI_TASK_STARTED: 'ai_task_started',
  GARDEN_ANALYSIS_COMPLETED: 'garden_analysis_completed',
  AUTHENTICATED: 'authenticated',
  AUTHENTICATION_ERROR: 'authentication_error',
  NOTIFICATION: 'notification',
} as const;

/**
 * WebSocket configuration for Socket.IO server
 */
export interface WebSocketConfig extends Partial<ServerOptions> {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  connectionStateRecovery?: {
    maxDisconnectionDuration: number;
  };
  pingTimeout: number;
  pingInterval: number;
  authRequired: boolean;
}

/**
 * Get WebSocket configuration from environment variables and defaults
 */
export function getWebSocketConfig(): WebSocketConfig {
  // Get CORS origins from environment or use defaults
  const corsOrigin = process.env.WEBSOCKET_CORS_ORIGIN
    ? process.env.WEBSOCKET_CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'];

  // Check if authentication is required (default: true)
  const authRequired = process.env.WEBSOCKET_AUTH_REQUIRED !== 'false';

  return {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    // Connection state recovery allows clients to reconnect and resume
    connectionStateRecovery: {
      // Keep connection state for 2 minutes after disconnect
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
    // Heartbeat settings
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    // Authentication requirement
    authRequired,
    // Allow upgrades from long-polling to WebSocket
    transports: ['websocket', 'polling'],
    // Max HTTP buffer size (1MB)
    maxHttpBufferSize: 1e6,
  };
}

/**
 * Room naming conventions for Socket.IO
 */
export const WEBSOCKET_ROOMS = {
  /**
   * Get user-specific room name
   * All sockets for a user join this room to receive user-specific events
   */
  user: (userId: string) => `user:${userId}`,

  /**
   * Get garden-specific room name
   * All sockets for users in a garden join this room (for future collaboration features)
   */
  garden: (gardenId: string) => `garden:${gardenId}`,

  /**
   * Get plant-specific room name
   * All sockets interested in a specific plant join this room
   */
  plant: (plantId: string) => `plant:${plantId}`,
} as const;

/**
 * Maximum number of concurrent connections per user
 * This prevents abuse and helps with resource management
 */
export const MAX_CONNECTIONS_PER_USER = 10;

/**
 * Connection rate limiting
 */
export const CONNECTION_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 connection attempts per minute per IP
};
