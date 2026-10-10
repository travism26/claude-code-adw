/**
 * useNotifications Hook
 *
 * React hook for managing notifications with WebSocket integration.
 * Handles real-time notification updates, fetching historical notifications,
 * and managing notification state.
 *
 * @example
 * ```tsx
 * import { useNotifications } from './hooks/useNotifications';
 *
 * function MyComponent() {
 *   const {
 *     notifications,
 *     unreadCount,
 *     markAsRead,
 *     removeNotification,
 *     loading,
 *   } = useNotifications({ token: authToken });
 *
 *   return (
 *     <div>
 *       <h2>Notifications ({unreadCount})</h2>
 *       {notifications.map(notification => (
 *         <NotificationItem
 *           key={notification.id}
 *           notification={notification}
 *           onMarkAsRead={() => markAsRead(notification.id)}
 *           onDelete={() => removeNotification(notification.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  deleteNotification,
  markAllNotificationsAsRead,
} from '../api/notifications';
import { Notification } from '../types/notification';
import { WEBSOCKET_EVENTS } from '../types/websocket';

export interface UseNotificationsOptions {
  /**
   * Authentication token
   */
  token?: string;

  /**
   * Whether to fetch notifications on mount
   */
  autoFetch?: boolean;

  /**
   * Whether to only fetch unread notifications initially
   */
  unreadOnly?: boolean;

  /**
   * Maximum number of notifications to fetch initially
   */
  initialLimit?: number;
}

export interface UseNotificationsReturn {
  /**
   * All notifications
   */
  notifications: Notification[];

  /**
   * Count of unread notifications
   */
  unreadCount: number;

  /**
   * Whether notifications are loading
   */
  loading: boolean;

  /**
   * Error message if any
   */
  error: string | null;

  /**
   * Fetch notifications from API
   */
  fetchNotifications: () => Promise<void>;

  /**
   * Mark a notification as read
   */
  markAsRead: (notificationId: string) => Promise<void>;

  /**
   * Mark all notifications as read
   */
  markAllAsRead: () => Promise<void>;

  /**
   * Remove a notification
   */
  removeNotification: (notificationId: string) => Promise<void>;

  /**
   * Refresh unread count
   */
  refreshUnreadCount: () => Promise<void>;
}

/**
 * useNotifications Hook
 */
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    token,
    autoFetch = true,
    unreadOnly = false,
    initialLimit,
  } = options;

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle incoming notification from WebSocket
   */
  const handleNotificationReceived = useCallback((event: any) => {
    const newNotification: Notification = {
      id: event.id,
      userId: '', // Not needed for display
      message: event.message,
      link: event.link,
      type: event.type,
      read: false,
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  // WebSocket integration
  const { isConnected } = useWebSocket({
    token,
    handlers: {
      [WEBSOCKET_EVENTS.NOTIFICATION]: handleNotificationReceived,
    },
  });

  /**
   * Fetch notifications from API
   */
  const fetchNotificationsFromAPI = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedNotifications = await fetchNotifications({
        unreadOnly,
        limit: initialLimit,
      });

      setNotifications(fetchedNotifications);

      // Update unread count
      const unread = fetchedNotifications.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [token, unreadOnly, initialLimit]);

  /**
   * Refresh unread count from API
   */
  const refreshUnreadCount = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [token]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!token) {
        return;
      }

      try {
        await markNotificationAsRead(notificationId);

        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );

        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking notification as read:', err);
        throw err;
      }
    },
    [token]
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      await markAllNotificationsAsRead();

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, [token]);

  /**
   * Remove a notification
   */
  const removeNotification = useCallback(
    async (notificationId: string) => {
      if (!token) {
        return;
      }

      try {
        await deleteNotification(notificationId);

        // Update local state
        setNotifications((prev) => {
          const notification = prev.find((n) => n.id === notificationId);
          if (notification && !notification.read) {
            setUnreadCount((count) => Math.max(0, count - 1));
          }
          return prev.filter((n) => n.id !== notificationId);
        });
      } catch (err) {
        console.error('Error removing notification:', err);
        throw err;
      }
    },
    [token]
  );

  // Fetch notifications on mount if autoFetch is true
  useEffect(() => {
    if (autoFetch && token) {
      fetchNotificationsFromAPI();
    }
  }, [autoFetch, token]); // Only run on mount and token change

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications: fetchNotificationsFromAPI,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refreshUnreadCount,
  };
}
