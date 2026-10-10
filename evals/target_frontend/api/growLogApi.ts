/**
 * Grow Log API Client
 *
 * API functions for grow log operations including CRUD operations,
 * environment data management, and photo uploads.
 * All functions use the ApiClient singleton for authenticated requests.
 * Never import these functions directly in components - use hooks instead.
 */

import { ApiClient } from '../utils/api';
import type {
  GrowLog,
  GrowLogsResponse,
  GrowLogDetailResponse,
  CreateGrowLogRequest,
  UpdateGrowLogRequest,
  GrowLogFilters,
  GrowLogEnvironment,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
  GrowLogPhoto,
  GrowLogPhotosResponse,
} from '../types';

const apiClient = ApiClient.getInstance();

/**
 * Fetch all log entries for a specific grow
 * Supports filtering by date range and phase
 *
 * @param growId - Grow UUID
 * @param filters - Optional filters for date range, phase, pagination
 * @returns Promise resolving to GrowLogsResponse with logs array and metadata
 */
export const getLogs = async (
  growId: string,
  filters?: GrowLogFilters
): Promise<GrowLogsResponse> => {
  const params = new URLSearchParams();

  if (filters?.date_from) {
    params.append('date_from', filters.date_from);
  }
  if (filters?.date_to) {
    params.append('date_to', filters.date_to);
  }
  if (filters?.phase) {
    params.append('phase', filters.phase);
  }
  if (filters?.limit) {
    params.append('limit', filters.limit.toString());
  }
  if (filters?.offset) {
    params.append('offset', filters.offset.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `/grows/${growId}/logs?${queryString}`
    : `/grows/${growId}/logs`;

  const response = await apiClient.request<GrowLogsResponse>(endpoint);
  return response;
};

/**
 * Fetch a single log entry by ID with all relations populated
 * Includes environment data and photos
 *
 * @param logId - Log entry UUID
 * @returns Promise resolving to GrowLog object with environment and photos
 */
export const getLog = async (logId: string): Promise<GrowLog> => {
  const response = await apiClient.request<GrowLogDetailResponse>(
    `/grow-logs/${logId}`
  );
  return response.log;
};

/**
 * Create a new log entry for a grow
 * Can optionally include environment data in the same request
 *
 * @param growId - Grow UUID
 * @param data - Log entry creation data (logged_at required)
 * @returns Promise resolving to created GrowLog object
 */
export const createLog = async (
  growId: string,
  data: CreateGrowLogRequest
): Promise<GrowLog> => {
  const response = await apiClient.request<GrowLog>(`/grows/${growId}/logs`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response;
};

/**
 * Update an existing log entry
 *
 * @param logId - Log entry UUID
 * @param data - Partial log data to update
 * @returns Promise resolving to updated GrowLog object
 */
export const updateLog = async (
  logId: string,
  data: UpdateGrowLogRequest
): Promise<GrowLog> => {
  const response = await apiClient.request<GrowLog>(`/grow-logs/${logId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response;
};

/**
 * Delete a log entry
 * Also deletes associated environment data and photos
 *
 * @param logId - Log entry UUID
 * @returns Promise resolving when deletion is complete
 */
export const deleteLog = async (logId: string): Promise<void> => {
  await apiClient.request(`/grow-logs/${logId}`, { method: 'DELETE' });
};

/**
 * Add environment data to a log entry
 * Creates a new environment record associated with the log
 *
 * @param logId - Log entry UUID
 * @param data - Environment readings (all fields optional)
 * @returns Promise resolving to created GrowLogEnvironment object
 */
export const addEnvironment = async (
  logId: string,
  data: CreateEnvironmentRequest
): Promise<GrowLogEnvironment> => {
  const response = await apiClient.request<GrowLogEnvironment>(
    `/grow-logs/${logId}/environment`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response;
};

/**
 * Update environment data for a log entry
 *
 * @param logId - Log entry UUID
 * @param data - Partial environment data to update
 * @returns Promise resolving to updated GrowLogEnvironment object
 */
export const updateEnvironment = async (
  logId: string,
  data: UpdateEnvironmentRequest
): Promise<GrowLogEnvironment> => {
  const response = await apiClient.request<GrowLogEnvironment>(
    `/grow-logs/${logId}/environment`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
  return response;
};

/**
 * Fetch all photos for a log entry
 *
 * @param logId - Log entry UUID
 * @returns Promise resolving to array of GrowLogPhoto objects
 */
export const getPhotos = async (logId: string): Promise<GrowLogPhoto[]> => {
  const response = await apiClient.request<GrowLogPhotosResponse>(
    `/grow-logs/${logId}/photos`
  );
  return response.photos;
};

/**
 * Upload photos to a log entry
 * Supports multiple file upload (max 10 photos per log)
 * Uses FormData for multipart file upload
 *
 * @param logId - Log entry UUID
 * @param formData - FormData containing files and optional captions
 * @returns Promise resolving to array of created GrowLogPhoto objects
 */
export const uploadPhotos = async (
  logId: string,
  formData: FormData
): Promise<GrowLogPhoto[]> => {
  const response = await apiClient.request<GrowLogPhotosResponse>(
    `/grow-logs/${logId}/photos`,
    {
      method: 'POST',
      body: formData,
      // Note: ApiClient will handle Content-Type for FormData automatically
    }
  );
  return response.photos;
};

/**
 * Delete a photo from a log entry
 *
 * @param photoId - Photo UUID
 * @returns Promise resolving when deletion is complete
 */
export const deletePhoto = async (photoId: string): Promise<void> => {
  await apiClient.request(`/grow-logs/photos/${photoId}`, {
    method: 'DELETE',
  });
};

/**
 * Set a photo as the cover photo for its log entry
 * Unsets any previously marked cover photo for the same log
 *
 * @param photoId - Photo UUID
 * @returns Promise resolving to updated GrowLogPhoto object
 */
export const setCoverPhoto = async (photoId: string): Promise<GrowLogPhoto> => {
  const response = await apiClient.request<GrowLogPhoto>(
    `/grow-logs/photos/${photoId}/cover`,
    {
      method: 'PUT',
    }
  );
  return response;
};
