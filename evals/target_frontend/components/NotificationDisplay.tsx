/**
 * NotificationDisplay Component
 *
 * Displays notifications with type-based styling and interactive features.
 * Supports clicking notification links to navigate, marking as read, and deleting.
 */

import React from 'react';
import { Notification, NotificationType } from '../types/notification';
import './NotificationDisplay.css';

export interface NotificationDisplayProps {
  /**
   * Notifications to display
   */
  notifications: Notification[];

  /**
   * Handler for marking notification as read
   */
  onMarkAsRead?: (notificationId: string) => void;

  /**
   * Handler for deleting notification
   */
  onDelete?: (notificationId: string) => void;

  /**
   * Handler for navigating to notification link
   */
  onNavigate?: (link: string) => void;

  /**
   * Custom className for styling
   */
  className?: string;
}

/**
 * Get CSS class name for notification type
 */
function getTypeClassName(type: NotificationType | null | undefined): string {
  switch (type) {
    case 'success':
      return 'notification-success';
    case 'warning':
      return 'notification-warning';
    case 'error':
      return 'notification-error';
    case 'info':
    default:
      return 'notification-info';
  }
}

/**
 * Format timestamp to human-readable format
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * NotificationDisplay Component
 */
export function NotificationDisplay({
  notifications,
  onMarkAsRead,
  onDelete,
  onNavigate,
  className = '',
}: NotificationDisplayProps) {
  /**
   * Handle clicking on a notification
   */
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    // Navigate if link is provided
    if (notification.link && onNavigate) {
      onNavigate(notification.link);
    }
  };

  /**
   * Handle delete click
   */
  const handleDeleteClick = (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notificationId);
    }
  };

  if (notifications.length === 0) {
    return (
      <div className={`notification-display notification-display-empty ${className}`}>
        <p className="notification-empty-message">No notifications</p>
      </div>
    );
  }

  return (
    <div className={`notification-display ${className}`}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification-item ${getTypeClassName(notification.type)} ${
            !notification.read ? 'notification-unread' : ''
          } ${notification.link ? 'notification-clickable' : ''}`}
          onClick={() => handleNotificationClick(notification)}
          role={notification.link ? 'button' : 'article'}
          tabIndex={notification.link ? 0 : undefined}
        >
          <div className="notification-content">
            <div className="notification-message">
              {!notification.read && (
                <span className="notification-unread-indicator" aria-label="Unread" />
              )}
              {notification.message}
            </div>
            <div className="notification-meta">
              <span className="notification-timestamp">
                {formatTimestamp(notification.createdAt)}
              </span>
              {notification.type && (
                <span className={`notification-type-badge ${getTypeClassName(notification.type)}`}>
                  {notification.type}
                </span>
              )}
            </div>
          </div>
          {onDelete && (
            <button
              className="notification-delete-btn"
              onClick={(e) => handleDeleteClick(e, notification.id)}
              aria-label="Delete notification"
              title="Delete notification"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
