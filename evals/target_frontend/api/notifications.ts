import {
  Notification,
  GetNotificationsResponse,
  CreateNotificationResponse,
  UnreadCountResponse,
} from "../types/notification";
import { ApiClient } from "../utils/api";

const apiClient = ApiClient.getInstance();

/**
 * Fetch all notifications for the authenticated user
 */
export async function fetchNotifications(
  options?: {
    unreadOnly?: boolean;
    limit?: number;
  }
): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (options?.unreadOnly) {
    params.append("unreadOnly", "true");
  }
  if (options?.limit) {
    params.append("limit", options.limit.toString());
  }

  const query = params.toString();
  const data = await apiClient.request<GetNotificationsResponse>(
    `/notifications${query ? `?${query}` : ""}`,
    { method: "GET" }
  );
  return data.notifications;
}

/**
 * Fetch a single notification by ID
 */
export async function fetchNotificationById(
  notificationId: string
): Promise<Notification> {
  const data = await apiClient.request<{ notification: Notification }>(
    `/notifications/${notificationId}`,
    { method: "GET" }
  );
  return data.notification;
}

/**
 * Get count of unread notifications
 */
export async function fetchUnreadCount(): Promise<number> {
  const data = await apiClient.request<UnreadCountResponse>(
    "/notifications/unread-count",
    { method: "GET" }
  );
  return data.count;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  await apiClient.request<void>(
    `/notifications/${notificationId}/read`,
    { method: "PATCH" }
  );
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<number> {
  const data = await apiClient.request<{ count: number }>(
    "/notifications/mark-all-read",
    { method: "PATCH" }
  );
  return data.count;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string
): Promise<void> {
  await apiClient.request<void>(
    `/notifications/${notificationId}`,
    { method: "DELETE" }
  );
}

/**
 * Create a test notification (for development)
 */
export async function createTestNotification(
  message: string,
  link?: string,
  type?: "info" | "success" | "warning" | "error"
): Promise<Notification> {
  const data = await apiClient.request<CreateNotificationResponse>(
    "/notifications/test",
    {
      method: "POST",
      body: JSON.stringify({
        message,
        link,
        type: type || "info",
      }),
    }
  );
  return data.notification;
}
