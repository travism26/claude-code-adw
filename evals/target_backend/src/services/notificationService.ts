import { Notification } from '../models';
import { messageBus, MessageBusEvent } from './messageBus';
import { logApi } from './logging/logger';

/**
 * NotificationService
 *
 * Core notification service that provides a clean API for creating and managing notifications.
 * Integrates with the message bus to enable real-time WebSocket delivery and future
 * email/SMS channels.
 *
 * @example
 * ```typescript
 * // Send a notification to a user
 * await notificationService.sendNotification(
 *   userId,
 *   'Your AI task has completed!',
 *   '/tasks/123',
 *   'success'
 * );
 *
 * // Get user's unread notifications
 * const unread = await notificationService.getNotifications(userId, {
 *   unreadOnly: true,
 *   limit: 10
 * });
 *
 * // Mark a notification as read
 * await notificationService.markAsRead(notificationId, userId);
 * ```
 */
class NotificationService {
  private static instance: NotificationService;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance of the notification service
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Send a notification to a user
   *
   * Creates a notification record in the database and publishes an event
   * to the message bus for real-time delivery via WebSocket.
   *
   * @param userId - ID of the user to send the notification to
   * @param message - The notification message content
   * @param link - Optional link/route to navigate to when clicked
   * @param type - Optional notification type (info, success, warning, error)
   * @returns The created notification
   */
  async sendNotification(
    userId: string,
    message: string,
    link?: string,
    type?: 'info' | 'success' | 'warning' | 'error'
  ): Promise<Notification> {
    try {
      // Create notification record in database
      const notification = await Notification.create({
        user_id: userId,
        message,
        link: link || null,
        type: type || 'info',
        read: false,
      });

      logApi.info('Notification sent successfully', {
        userId,
        notificationId: notification.id,
        type: notification.type,
        message: notification.message,
        hasLink: !!link,
      });

      // Publish event to message bus for WebSocket delivery
      messageBus.publish(MessageBusEvent.NOTIFICATION_CREATED, {
        notificationId: notification.id,
        userId: notification.user_id,
        message: notification.message,
        link: notification.link || undefined,
        type: notification.type || undefined,
        timestamp: notification.created_at,
      });

      logApi.debug('Message bus event published for notification', {
        event: MessageBusEvent.NOTIFICATION_CREATED,
        notificationId: notification.id,
        userId,
      });

      return notification;
    } catch (error) {
      logApi.error('Error sending notification', {
        userId,
        message,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to send notification');
    }
  }

  /**
   * Get notifications for a user
   *
   * @param userId - ID of the user
   * @param options - Query options
   * @param options.unreadOnly - If true, only return unread notifications
   * @param options.limit - Maximum number of notifications to return
   * @returns Array of notifications
   */
  async getNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
    }
  ): Promise<Notification[]> {
    try {
      const whereClause: any = { user_id: userId };

      if (options?.unreadOnly) {
        whereClause.read = false;
      }

      const notifications = await Notification.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: options?.limit,
      });

      logApi.debug('Fetching notifications', {
        userId,
        unreadOnly: options?.unreadOnly || false,
        limit: options?.limit,
        resultCount: notifications.length,
      });

      return notifications;
    } catch (error) {
      logApi.error('Error fetching notifications', {
        userId,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch notifications');
    }
  }

  /**
   * Get a single notification by ID
   *
   * @param notificationId - ID of the notification
   * @param userId - ID of the user (for authorization)
   * @returns The notification or null if not found
   */
  async getNotificationById(
    notificationId: string,
    userId: string
  ): Promise<Notification | null> {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          user_id: userId,
        },
      });

      if (!notification) {
        logApi.warn('Notification not found', {
          notificationId,
          userId,
          operation: 'getById',
        });
      } else {
        logApi.debug('Fetching single notification', {
          notificationId,
          userId,
        });
      }

      return notification;
    } catch (error) {
      logApi.error('Error fetching notification', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch notification');
    }
  }

  /**
   * Mark a notification as read
   *
   * @param notificationId - ID of the notification to mark as read
   * @param userId - ID of the user (for authorization)
   * @returns true if successful, false if notification not found
   */
  async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          user_id: userId,
        },
      });

      if (!notification) {
        logApi.warn('Notification not found', {
          notificationId,
          userId,
          operation: 'markAsRead',
        });
        return false;
      }

      await notification.update({ read: true });

      logApi.info('Notification marked as read', {
        notificationId,
        userId,
      });

      // Publish event to message bus
      messageBus.publish(MessageBusEvent.NOTIFICATION_READ, {
        notificationId: notification.id,
        userId: notification.user_id,
        timestamp: new Date(),
      });

      return true;
    } catch (error) {
      logApi.error('Error marking notification as read', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to mark notification as read');
    }
  }

  /**
   * Mark all notifications as read for a user
   *
   * @param userId - ID of the user
   * @returns Number of notifications marked as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const [affectedCount] = await Notification.update(
        { read: true },
        {
          where: {
            user_id: userId,
            read: false,
          },
        }
      );

      logApi.info('Bulk mark as read', {
        userId,
        affectedCount,
      });

      return affectedCount;
    } catch (error) {
      logApi.error('Error marking all notifications as read', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to mark all notifications as read');
    }
  }

  /**
   * Delete a notification
   *
   * @param notificationId - ID of the notification to delete
   * @param userId - ID of the user (for authorization)
   * @returns true if successful, false if notification not found
   */
  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          user_id: userId,
        },
      });

      if (!notification) {
        logApi.warn('Notification not found', {
          notificationId,
          userId,
          operation: 'delete',
        });
        return false;
      }

      await notification.destroy();

      logApi.info('Notification deleted', {
        notificationId,
        userId,
      });

      return true;
    } catch (error) {
      logApi.error('Error deleting notification', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete notification');
    }
  }

  /**
   * Get count of unread notifications for a user
   *
   * @param userId - ID of the user
   * @returns Count of unread notifications
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await Notification.count({
        where: {
          user_id: userId,
          read: false,
        },
      });

      logApi.debug('Getting unread count', {
        userId,
        count,
      });

      return count;
    } catch (error) {
      logApi.error('Error fetching unread count', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch unread count');
    }
  }

  /**
   * For testing purposes - reset the singleton instance
   * @internal
   */
  public static resetInstance(): void {
    NotificationService.instance = null as any;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Also export the class for testing
export { NotificationService };
