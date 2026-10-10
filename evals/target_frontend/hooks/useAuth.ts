"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  signup as signupApi,
  login as loginApi,
  logout as logoutApi,
} from "../api/authApi";
import { ApiClient } from "../utils/api";
import type { AuthResponse, User } from "../types";

function decodeJwt(token: string): User | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    // Map decoded payload to your User type as needed
    return decoded as User;
  } catch {
    return null;
  }
}

export const useAuth = () => {
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const apiClient = ApiClient.getInstance();
  const queryClient = useQueryClient();

  // Set user from token on mount or token change. If the short-lived access
  // token has expired but a refresh token remains, silently restore the session
  // before deciding auth state — otherwise a reload after 15 min idle would
  // bounce the user to /login despite a valid 7-day refresh token (BUG-003).
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const token = apiClient.getAccessToken();
      if (token) {
        setUser(decodeJwt(token));
        setIsInitializing(false);
        return;
      }
      const restored = await apiClient.restoreSession();
      if (cancelled) return;
      const fresh = apiClient.getAccessToken();
      setUser(restored && fresh ? decodeJwt(fresh) : null);
      setIsInitializing(false);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [apiClient, apiClient.getTokenVersion()]);

  const isAuthenticated = !!user;

  const signupMutation = useMutation({
    mutationFn: ({
      email,
      password,
      timezone,
    }: {
      email: string;
      password: string;
      timezone?: string;
    }) => signupApi(email, password, timezone),
    onSuccess: (response: AuthResponse) => {
      apiClient.setTokens(response.accessToken, response.refreshToken);
      setUser(decodeJwt(response.accessToken));
      setError(null);
    },
    onError: (error: any) => {
      setError(error?.error || "Signup failed");
    },
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginApi(email, password),
    onSuccess: (response: AuthResponse) => {
      apiClient.setTokens(response.accessToken, response.refreshToken);
      setUser(decodeJwt(response.accessToken));
      setError(null);
    },
    onError: (error: any) => {
      setError(error?.error || "Login failed");
    },
  });

  const logout = () => {
    logoutApi();
    apiClient.clearTokens();
    setUser(null);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const isLoading = signupMutation.isPending || loginMutation.isPending;

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,
    token: apiClient.getAccessToken(),
    signup: async (email: string, password: string, timezone?: string) => {
      await signupMutation.mutateAsync({ email, password, timezone });
    },
    login: async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    logout,
    clearError,
  };
};
