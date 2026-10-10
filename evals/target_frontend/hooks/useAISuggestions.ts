/**
 * useAISuggestions Hook
 *
 * React hook for handling AI suggestion notifications from WebSocket.
 * Maintains a list of received suggestions and provides methods to manage them.
 *
 * @example
 * ```tsx
 * import { useAISuggestions } from './hooks/useAISuggestions';
 *
 * function MyComponent() {
 *   const {
 *     suggestions,
 *     isConnected,
 *     dismissSuggestion,
 *     clearAll,
 *   } = useAISuggestions({ token: userToken });
 *
 *   return (
 *     <div>
 *       {suggestions.map((suggestion) => (
 *         <div key={suggestion.id}>
 *           {suggestion.content}
 *           <button onClick={() => dismissSuggestion(suggestion.id)}>
 *             Dismiss
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  AISuggestionEvent,
  AITaskFailedEvent,
  AITaskStartedEvent,
  WEBSOCKET_EVENTS,
} from '../types/websocket';

/**
 * AI Suggestion with metadata
 */
export interface AISuggestion {
  id: string; // taskId
  content: string;
  type: string;
  confidence?: number;
  actionItems?: string[];
  plantId?: string;
  timestamp: Date;
  status: 'unread' | 'read' | 'dismissed';
}

/**
 * AI Task status update
 */
export interface AITaskUpdate {
  taskId: string;
  status: 'started' | 'failed' | 'completed';
  timestamp: Date;
  error?: string;
}

/**
 * Options for useAISuggestions hook
 */
export interface UseAISuggestionsOptions {
  /**
   * Authentication token (JWT)
   */
  token?: string;

  /**
   * Whether to automatically mark suggestions as read after a delay
   */
  autoMarkRead?: boolean;

  /**
   * Delay in milliseconds before automatically marking as read
   */
  autoMarkReadDelay?: number;

  /**
   * Maximum number of suggestions to keep in memory
   */
  maxSuggestions?: number;

  /**
   * Callback when a new suggestion is received
   */
  onSuggestionReceived?: (suggestion: AISuggestion) => void;

  /**
   * Callback when a task fails
   */
  onTaskFailed?: (taskId: string, error: string) => void;

  /**
   * Callback when a task starts
   */
  onTaskStarted?: (taskId: string) => void;
}

/**
 * useAISuggestions Hook
 *
 * @param options - Hook options
 * @returns AI suggestions state and utility functions
 */
export function useAISuggestions(options: UseAISuggestionsOptions = {}) {
  const {
    token,
    autoMarkRead = false,
    autoMarkReadDelay = 5000,
    maxSuggestions = 50,
    onSuggestionReceived,
    onTaskFailed,
    onTaskStarted,
  } = options;

  // State
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [taskUpdates, setTaskUpdates] = useState<AITaskUpdate[]>([]);

  // WebSocket connection
  const { status, isConnected, subscribe } = useWebSocket({
    token,
    autoReconnect: true,
  });

  /**
   * Add a new suggestion to the list
   */
  const addSuggestion = useCallback(
    (event: AISuggestionEvent) => {
      const suggestion: AISuggestion = {
        id: event.taskId,
        content: event.suggestion.content,
        type: event.suggestion.type,
        confidence: event.suggestion.confidence,
        actionItems: event.suggestion.actionItems,
        plantId: event.plantId,
        timestamp: new Date(event.timestamp),
        status: 'unread',
      };

      setSuggestions((prev) => {
        // Add new suggestion to the beginning
        const updated = [suggestion, ...prev];

        // Trim to max suggestions
        if (updated.length > maxSuggestions) {
          return updated.slice(0, maxSuggestions);
        }

        return updated;
      });

      // Call callback if provided
      onSuggestionReceived?.(suggestion);

      // Auto-mark as read if enabled
      if (autoMarkRead) {
        setTimeout(() => {
          markAsRead(suggestion.id);
        }, autoMarkReadDelay);
      }
    },
    [maxSuggestions, onSuggestionReceived, autoMarkRead, autoMarkReadDelay]
  );

  /**
   * Add a task update
   */
  const addTaskUpdate = useCallback((update: AITaskUpdate) => {
    setTaskUpdates((prev) => {
      const updated = [update, ...prev];
      // Keep only last 20 updates
      return updated.slice(0, 20);
    });
  }, []);

  /**
   * Mark a suggestion as read
   */
  const markAsRead = useCallback((taskId: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === taskId && s.status === 'unread' ? { ...s, status: 'read' } : s))
    );
  }, []);

  /**
   * Dismiss a suggestion
   */
  const dismissSuggestion = useCallback((taskId: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === taskId ? { ...s, status: 'dismissed' } : s))
    );
  }, []);

  /**
   * Remove a suggestion from the list
   */
  const removeSuggestion = useCallback((taskId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== taskId));
  }, []);

  /**
   * Clear all suggestions
   */
  const clearAll = useCallback(() => {
    setSuggestions([]);
  }, []);

  /**
   * Clear dismissed suggestions
   */
  const clearDismissed = useCallback(() => {
    setSuggestions((prev) => prev.filter((s) => s.status !== 'dismissed'));
  }, []);

  /**
   * Get suggestions by status
   */
  const getSuggestionsByStatus = useCallback(
    (status: AISuggestion['status']) => {
      return suggestions.filter((s) => s.status === status);
    },
    [suggestions]
  );

  /**
   * Get suggestions for a specific plant
   */
  const getSuggestionsByPlant = useCallback(
    (plantId: string) => {
      return suggestions.filter((s) => s.plantId === plantId);
    },
    [suggestions]
  );

  // Subscribe to WebSocket events
  useEffect(() => {
    // AI suggestion ready event
    const unsubSuggestion = subscribe<AISuggestionEvent>(
      WEBSOCKET_EVENTS.AI_SUGGESTION_READY,
      (event) => {
        console.log('[useAISuggestions] Received suggestion:', event);
        addSuggestion(event);
        addTaskUpdate({
          taskId: event.taskId,
          status: 'completed',
          timestamp: new Date(event.timestamp),
        });
      }
    );

    // AI task failed event
    const unsubFailed = subscribe<AITaskFailedEvent>(WEBSOCKET_EVENTS.AI_TASK_FAILED, (event) => {
      console.log('[useAISuggestions] Task failed:', event);
      addTaskUpdate({
        taskId: event.taskId,
        status: 'failed',
        timestamp: new Date(event.timestamp),
        error: event.error,
      });
      onTaskFailed?.(event.taskId, event.error);
    });

    // AI task started event
    const unsubStarted = subscribe<AITaskStartedEvent>(
      WEBSOCKET_EVENTS.AI_TASK_STARTED,
      (event) => {
        console.log('[useAISuggestions] Task started:', event);
        addTaskUpdate({
          taskId: event.taskId,
          status: 'started',
          timestamp: new Date(event.timestamp),
        });
        onTaskStarted?.(event.taskId);
      }
    );

    // Cleanup
    return () => {
      unsubSuggestion();
      unsubFailed();
      unsubStarted();
    };
  }, [subscribe, addSuggestion, addTaskUpdate, onTaskFailed, onTaskStarted]);

  return {
    // State
    suggestions,
    taskUpdates,
    isConnected,
    connectionStatus: status,

    // Getters
    unreadCount: getSuggestionsByStatus('unread').length,
    unreadSuggestions: getSuggestionsByStatus('unread'),
    readSuggestions: getSuggestionsByStatus('read'),
    dismissedSuggestions: getSuggestionsByStatus('dismissed'),

    // Actions
    markAsRead,
    dismissSuggestion,
    removeSuggestion,
    clearAll,
    clearDismissed,
    getSuggestionsByStatus,
    getSuggestionsByPlant,
  };
}
