/**
 * Centralized E2E Test Configuration
 *
 * This file provides a single source of truth for API endpoints and configuration
 * used across all E2E tests. This ensures consistency and makes it easy to change
 * ports or URLs for different environments.
 */

/**
 * Get the API base URL for E2E tests
 *
 * Priority order:
 * 1. NEXT_PUBLIC_API_BASE_URL environment variable
 * 2. Constructed from BACKEND_PORT environment variable
 * 3. Default to http://localhost:3000/api (standard backend port)
 */
export function getApiBaseUrl(): string {
  // Try NEXT_PUBLIC_API_BASE_URL first
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // Try constructing from BACKEND_PORT
  if (process.env.BACKEND_PORT) {
    return `http://localhost:${process.env.BACKEND_PORT}/api`;
  }

  // Default to standard backend port
  return 'http://localhost:3000/api';
}

/**
 * Get the frontend base URL for E2E tests
 */
export function getFrontendBaseUrl(): string {
  const frontendPort = process.env.FRONTEND_PORT || process.env.PORT || '3001';
  return `http://localhost:${frontendPort}`;
}

/**
 * API endpoints configuration
 */
export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  endpoints: {
    // Auth endpoints
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',

    // Plant endpoints
    plants: '/plants',
    plantProfiles: '/plant-profiles',

    // Garden endpoints
    gardens: '/gardens',

    // Other endpoints
    zones: '/zones',
    careHistory: '/care-history',
    journal: '/journal',
    notifications: '/notifications',
  }
} as const;

/**
 * Get full API URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/${cleanEndpoint}`;
}
