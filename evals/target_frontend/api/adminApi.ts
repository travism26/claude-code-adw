/**
 * Admin API Client
 *
 * Provides methods for interacting with admin endpoints for user management,
 * notification testing, and statistics.
 */

import { ApiClient } from "../utils/api";

const apiClient = ApiClient.getInstance();

/**
 * TypeScript interfaces for admin API
 */
export interface AdminUser {
  id: string;
  email: string;
  growing_zone: string | null;
  postal_code: string | null;
  tz: string;
  zone_override?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetUsersResponse {
  users: AdminUser[];
  pagination: PaginationInfo;
}

export interface GetUserResponse {
  user: AdminUser;
}

export interface UpdateUserRequest {
  email?: string;
  growing_zone?: string;
  postal_code?: string;
  tz?: string;
}

export interface UpdateUserResponse {
  message: string;
  user: AdminUser;
}

export interface SendNotificationToUserRequest {
  userId: string;
  message: string;
  link?: string;
  type?: "info" | "success" | "warning" | "error";
}

export interface SendNotificationToAllRequest {
  message: string;
  link?: string;
  type?: "info" | "success" | "warning" | "error";
}

export interface SendNotificationResponse {
  message: string;
  notification?: any;
  count?: number;
  total?: number;
  errors?: Array<{ userId: string; success: boolean; error?: string }>;
}

export interface UserStats {
  totalUsers: number;
  usersByZone: Array<{ zone: string; count: number }>;
  recentSignups: {
    last7Days: number;
    last30Days: number;
  };
  usersWithoutZone: number;
}

/**
 * Fetch all users with pagination
 */
export async function getAllUsers(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<GetUsersResponse> {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (search) {
    params.append("search", search);
  }

  const query = params.toString();
  return apiClient.request<GetUsersResponse>(
    `/admin/users?${query}`,
    { method: "GET" }
  );
}

/**
 * Fetch a single user by ID
 */
export async function getUserById(userId: string): Promise<AdminUser> {
  const data = await apiClient.request<GetUserResponse>(
    `/admin/users/${userId}`,
    { method: "GET" }
  );
  return data.user;
}

/**
 * Update a user's information
 */
export async function updateUser(
  userId: string,
  updates: UpdateUserRequest
): Promise<AdminUser> {
  const data = await apiClient.request<UpdateUserResponse>(
    `/admin/users/${userId}`,
    {
      method: "PUT",
      body: JSON.stringify(updates),
    }
  );
  return data.user;
}

/**
 * Send a notification to a specific user
 */
export async function sendNotificationToUser(
  request: SendNotificationToUserRequest
): Promise<SendNotificationResponse> {
  return apiClient.request<SendNotificationResponse>(
    "/admin/notifications/send-to-user",
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
}

/**
 * Send a notification to all users
 */
export async function sendNotificationToAll(
  request: SendNotificationToAllRequest
): Promise<SendNotificationResponse> {
  return apiClient.request<SendNotificationResponse>(
    "/admin/notifications/send-to-all",
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
}

/**
 * Fetch user statistics
 */
export async function getStats(): Promise<UserStats> {
  return apiClient.request<UserStats>(
    "/admin/stats",
    { method: "GET" }
  );
}
