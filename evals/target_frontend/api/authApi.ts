// Auth API queries and mutations using TanStack Query
import { ApiClient } from "../utils/api";
import type { AuthResponse, User } from "../types";

const apiClient = ApiClient.getInstance();

// Fetch current authenticated user
// This endpoint doesnt exist yet.
export const getCurrentUser = async (): Promise<User> => {
  return await apiClient.request<User>("/auth/me", {
    method: "GET",
  });
};

export const signup = async (
  email: string,
  password: string,
  timezone = "UTC"
): Promise<AuthResponse> => {
  return await apiClient.request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, timezone }),
  });
};

export const login = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  return await apiClient.request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
};

export const logout = (): void => {
  apiClient.clearTokens();
};
