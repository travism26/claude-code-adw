/**
 * Notification type enum
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  userId: string;
  message: string;
  link?: string | null;
  type?: NotificationType | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Notification event interface for WebSocket events
 */
export interface NotificationEvent {
  id: string;
  message: string;
  link?: string;
  type: NotificationType;
  timestamp: string;
}

/**
 * API response for fetching notifications
 */
export interface GetNotificationsResponse {
  notifications: Notification[];
  count: number;
}

/**
 * API response for creating a notification
 */
export interface CreateNotificationResponse {
  message: string;
  notification: Notification;
}

/**
 * API response for unread count
 */
export interface UnreadCountResponse {
  count: number;
}
