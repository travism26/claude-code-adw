/**
 * WebSocket Types
 *
 * Type definitions for WebSocket events and payloads.
 * These types match the backend event structures for type safety.
 */

/**
 * Connection status for WebSocket
 */
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

/**
 * AI suggestion payload from WebSocket
 */
export interface AISuggestionEvent {
  taskId: string;
  suggestion: {
    type: string;
    content: string;
    confidence?: number;
    actionItems?: string[];
  };
  plantId?: string;
  timestamp: string;
  type: 'success';
}

/**
 * AI task failed event payload
 */
export interface AITaskFailedEvent {
  taskId: string;
  error: string;
  timestamp: string;
  type: 'error';
}

/**
 * AI task started event payload
 */
export interface AITaskStartedEvent {
  taskId: string;
  timestamp: string;
  type: 'info';
}

/**
 * Notification event payload from WebSocket
 */
export interface NotificationEvent {
  id: string;
  message: string;
  link?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

/**
 * Authentication success event
 */
export interface AuthenticatedEvent {
  message: string;
  userId: string;
  socketId: string;
}

/**
 * Authentication error event
 */
export interface AuthenticationErrorEvent {
  error: string;
}

/**
 * WebSocket error event
 */
export interface WebSocketError {
  message: string;
  code?: string;
  timestamp: Date;
}

/**
 * WebSocket event names (matches backend)
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
  AUTHENTICATED: 'authenticated',
  AUTHENTICATION_ERROR: 'authentication_error',
  NOTIFICATION: 'notification',
} as const;

/**
 * WebSocket event handlers map
 */
export interface WebSocketEventHandlers {
  [WEBSOCKET_EVENTS.AI_SUGGESTION_READY]?: (event: AISuggestionEvent) => void;
  [WEBSOCKET_EVENTS.AI_TASK_FAILED]?: (event: AITaskFailedEvent) => void;
  [WEBSOCKET_EVENTS.AI_TASK_STARTED]?: (event: AITaskStartedEvent) => void;
  [WEBSOCKET_EVENTS.AUTHENTICATED]?: (event: AuthenticatedEvent) => void;
  [WEBSOCKET_EVENTS.AUTHENTICATION_ERROR]?: (event: AuthenticationErrorEvent) => void;
  [WEBSOCKET_EVENTS.NOTIFICATION]?: (event: NotificationEvent) => void;
  [WEBSOCKET_EVENTS.ERROR]?: (error: WebSocketError) => void;
  [WEBSOCKET_EVENTS.DISCONNECT]?: (reason: string) => void;
}

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
  /**
   * Authentication token (JWT)
   */
  token?: string;

  /**
   * Whether to automatically reconnect on disconnection
   */
  autoReconnect?: boolean;

  /**
   * Reconnection delay in milliseconds
   */
  reconnectionDelay?: number;

  /**
   * Maximum number of reconnection attempts
   */
  reconnectionAttempts?: number;

  /**
   * Custom event handlers
   */
  handlers?: WebSocketEventHandlers;
}

/**
 * WebSocket hook state
 */
export interface WebSocketState {
  /**
   * Current connection status
   */
  status: ConnectionStatus;

  /**
   * Whether the socket is currently connected
   */
  isConnected: boolean;

  /**
   * Error message if any
   */
  error: string | null;

  /**
   * Socket ID once connected
   */
  socketId: string | null;
}
