/**
 * useWebSocket Hook
 *
 * React hook for managing WebSocket connections using Socket.IO client.
 * Handles connection lifecycle, authentication, and automatic reconnection.
 *
 * @example
 * ```tsx
 * import { useWebSocket } from './hooks/useWebSocket';
 *
 * function MyComponent() {
 *   const { status, isConnected, subscribe } = useWebSocket({
 *     token: userToken,
 *     autoReconnect: true,
 *   });
 *
 *   useEffect(() => {
 *     const unsubscribe = subscribe('ai_suggestion_ready', (event) => {
 *       console.log('Received suggestion:', event);
 *     });
 *
 *     return unsubscribe;
 *   }, [subscribe]);
 *
 *   return <div>Status: {status}</div>;
 * }
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ConnectionStatus,
  WebSocketOptions,
  WebSocketState,
  WEBSOCKET_EVENTS,
} from '../types/websocket';

/**
 * Get WebSocket server URL from environment or default
 */
function getWebSocketURL(): string {
  // Try to get from environment variable first
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  // Default to same host as the app
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_API_PORT || '3000';
    return `${protocol}//${host}:${port}`;
  }

  // Fallback for SSR
  return 'http://localhost:3000';
}

/**
 * useWebSocket Hook
 *
 * @param options - WebSocket connection options
 * @returns WebSocket state and utility functions
 */
export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    token,
    autoReconnect = true,
    reconnectionDelay = 1000,
    reconnectionAttempts = 5,
    handlers = {},
  } = options;

  // WebSocket state
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    isConnected: false,
    error: null,
    socketId: null,
  });

  // Socket reference
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update connection status
   */
  const updateStatus = useCallback((status: ConnectionStatus, error: string | null = null) => {
    setState((prev) => ({
      ...prev,
      status,
      isConnected: status === 'connected',
      error,
    }));
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (socketRef.current?.connected || state.status === 'connecting') {
      return;
    }

    // Don't connect without a token
    if (!token) {
      console.warn('[useWebSocket] No token provided, skipping connection');
      return;
    }

    updateStatus('connecting');

    try {
      const wsURL = getWebSocketURL();
      console.log('[useWebSocket] Connecting to:', wsURL);

      // Create Socket.IO client
      const socket = io(wsURL, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnection: autoReconnect,
        reconnectionDelay,
        reconnectionAttempts,
      });

      // Connection event handlers
      socket.on('connect', () => {
        console.log('[useWebSocket] Connected:', socket.id);
        reconnectAttemptsRef.current = 0;
        updateStatus('connected');
        setState((prev) => ({ ...prev, socketId: socket.id || null }));
      });

      socket.on('disconnect', (reason) => {
        console.log('[useWebSocket] Disconnected:', reason);
        updateStatus('disconnected');
        handlers[WEBSOCKET_EVENTS.DISCONNECT]?.(reason);

        // Handle reconnection for certain disconnect reasons
        if (autoReconnect && reason === 'io server disconnect') {
          // Server disconnected the socket, attempt to reconnect
          socket.connect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('[useWebSocket] Connection error:', error.message);
        updateStatus('error', error.message);

        // Handle authentication errors
        if (error.message.includes('Authentication')) {
          handlers[WEBSOCKET_EVENTS.AUTHENTICATION_ERROR]?.({ error: error.message });
          // Don't attempt to reconnect on auth errors
          socket.disconnect();
        } else if (autoReconnect && reconnectAttemptsRef.current < reconnectionAttempts) {
          // Attempt to reconnect
          reconnectAttemptsRef.current++;
          updateStatus('reconnecting');

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[useWebSocket] Reconnection attempt ${reconnectAttemptsRef.current}`);
            socket.connect();
          }, reconnectionDelay * reconnectAttemptsRef.current);
        }
      });

      // Authenticated event
      socket.on(WEBSOCKET_EVENTS.AUTHENTICATED, (data) => {
        console.log('[useWebSocket] Authenticated:', data);
        handlers[WEBSOCKET_EVENTS.AUTHENTICATED]?.(data);
      });

      // Authentication error event
      socket.on(WEBSOCKET_EVENTS.AUTHENTICATION_ERROR, (data) => {
        console.error('[useWebSocket] Authentication error:', data);
        handlers[WEBSOCKET_EVENTS.AUTHENTICATION_ERROR]?.(data);
        updateStatus('error', data.error);
      });

      // AI events
      socket.on(WEBSOCKET_EVENTS.AI_SUGGESTION_READY, (data) => {
        console.log('[useWebSocket] AI suggestion ready:', data);
        handlers[WEBSOCKET_EVENTS.AI_SUGGESTION_READY]?.(data);
      });

      socket.on(WEBSOCKET_EVENTS.AI_TASK_FAILED, (data) => {
        console.log('[useWebSocket] AI task failed:', data);
        handlers[WEBSOCKET_EVENTS.AI_TASK_FAILED]?.(data);
      });

      socket.on(WEBSOCKET_EVENTS.AI_TASK_STARTED, (data) => {
        console.log('[useWebSocket] AI task started:', data);
        handlers[WEBSOCKET_EVENTS.AI_TASK_STARTED]?.(data);
      });

      // Notification event
      socket.on(WEBSOCKET_EVENTS.NOTIFICATION, (data) => {
        console.log('[useWebSocket] Notification received:', data);
        handlers[WEBSOCKET_EVENTS.NOTIFICATION]?.(data);
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('[useWebSocket] Failed to create socket:', error);
      updateStatus('error', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [token, autoReconnect, reconnectionDelay, reconnectionAttempts, handlers, updateStatus, state.status]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[useWebSocket] Disconnecting...');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    updateStatus('disconnected');
  }, [updateStatus]);

  /**
   * Subscribe to a WebSocket event
   */
  const subscribe = useCallback(<T = any>(event: string, handler: (data: T) => void) => {
    if (!socketRef.current) {
      console.warn(`[useWebSocket] Cannot subscribe to ${event}: Socket not connected`);
      return () => {};
    }

    console.log(`[useWebSocket] Subscribing to ${event}`);
    socketRef.current.on(event, handler);

    // Return unsubscribe function
    return () => {
      if (socketRef.current) {
        console.log(`[useWebSocket] Unsubscribing from ${event}`);
        socketRef.current.off(event, handler);
      }
    };
  }, []);

  /**
   * Emit an event to the server
   */
  const emit = useCallback(<T = any>(event: string, data?: T) => {
    if (!socketRef.current?.connected) {
      console.warn(`[useWebSocket] Cannot emit ${event}: Socket not connected`);
      return;
    }

    console.log(`[useWebSocket] Emitting ${event}`, data);
    socketRef.current.emit(event, data);
  }, []);

  // Connect on mount if token is provided
  useEffect(() => {
    if (token) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [token]); // Only reconnect if token changes

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    emit,
  };
}
