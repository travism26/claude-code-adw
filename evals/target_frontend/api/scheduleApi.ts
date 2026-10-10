/**
 * Schedule API Client
 *
 * API functions for scheduled event operations.
 * All functions use the ApiClient singleton for authenticated requests.
 * Never import these functions directly in components - use hooks instead.
 */

import { ApiClient } from '../utils/api';
import type {
  ScheduledEvent,
  CreateEventInput,
  UpdateEventInput,
  EventFilters,
  ScheduleEventsResponse,
  ScheduleAgenda,
  QuickCreateInput,
} from '../types';

const apiClient = ApiClient.getInstance();

/**
 * Convert camelCase keys to snake_case for API requests
 */
const toSnakeCase = (obj: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
};

/**
 * Fetch all scheduled events for the authenticated user
 * Supports filtering by entity, environment, status, date range
 *
 * @param filters - Optional filters for entity, environment, status, date range, pagination
 * @returns Promise resolving to ScheduleEventsResponse with events array and total count
 */
export const getEvents = async (
  filters?: EventFilters
): Promise<ScheduleEventsResponse> => {
  const params = new URLSearchParams();

  if (filters?.entityType) {
    params.append('entity_type', filters.entityType);
  }
  if (filters?.entityId) {
    params.append('entity_id', filters.entityId);
  }
  if (filters?.environmentId) {
    params.append('environment_id', filters.environmentId);
  }
  if (filters?.status) {
    params.append('status', filters.status);
  }
  if (filters?.startDate) {
    params.append('start_date', filters.startDate);
  }
  if (filters?.endDate) {
    params.append('end_date', filters.endDate);
  }
  if (filters?.limit) {
    params.append('limit', filters.limit.toString());
  }
  if (filters?.offset) {
    params.append('offset', filters.offset.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/schedule/events?${queryString}` : '/schedule/events';

  const response = await apiClient.request<ScheduleEventsResponse>(endpoint);
  return response;
};

/**
 * Fetch a single scheduled event by ID
 *
 * @param id - Event UUID
 * @returns Promise resolving to ScheduledEvent object
 */
export const getEvent = async (id: string): Promise<ScheduledEvent> => {
  const response = await apiClient.request<ScheduledEvent>(`/schedule/events/${id}`);
  return response;
};

/**
 * Create a new scheduled event
 *
 * @param data - Event creation data (entity_type, entity_id, title, event_type, start_date required)
 * @returns Promise resolving to created ScheduledEvent object
 */
export const createEvent = async (data: CreateEventInput): Promise<ScheduledEvent> => {
  const snakeCaseData = toSnakeCase(data as unknown as Record<string, unknown>);
  const response = await apiClient.request<ScheduledEvent>('/schedule/events', {
    method: 'POST',
    body: JSON.stringify(snakeCaseData),
  });
  return response;
};

/**
 * Update an existing scheduled event
 *
 * @param id - Event UUID
 * @param data - Partial event data to update
 * @returns Promise resolving to updated ScheduledEvent object
 */
export const updateEvent = async (
  id: string,
  data: UpdateEventInput
): Promise<ScheduledEvent> => {
  const snakeCaseData = toSnakeCase(data as unknown as Record<string, unknown>);
  const response = await apiClient.request<ScheduledEvent>(`/schedule/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(snakeCaseData),
  });
  return response;
};

/**
 * Delete a scheduled event
 *
 * @param id - Event UUID
 * @returns Promise resolving to void
 */
export const deleteEvent = async (id: string): Promise<void> => {
  await apiClient.request<void>(`/schedule/events/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Mark a scheduled event as completed
 *
 * @param id - Event UUID
 * @returns Promise resolving to updated ScheduledEvent object
 */
export const completeEvent = async (id: string): Promise<ScheduledEvent> => {
  const response = await apiClient.request<ScheduledEvent>(
    `/schedule/events/${id}/complete`,
    {
      method: 'POST',
    }
  );
  return response;
};

/**
 * Mark a scheduled event as skipped
 *
 * @param id - Event UUID
 * @returns Promise resolving to updated ScheduledEvent object
 */
export const skipEvent = async (id: string): Promise<ScheduledEvent> => {
  const response = await apiClient.request<ScheduledEvent>(
    `/schedule/events/${id}/skip`,
    {
      method: 'POST',
    }
  );
  return response;
};

/**
 * Get agenda view (overdue, today, upcoming events)
 *
 * @param days - Number of days to look ahead (default 7)
 * @returns Promise resolving to ScheduleAgenda object
 */
export const getAgenda = async (days?: number): Promise<ScheduleAgenda> => {
  const params = new URLSearchParams();

  if (days) {
    params.append('days', days.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/schedule/agenda?${queryString}` : '/schedule/agenda';

  const response = await apiClient.request<ScheduleAgenda>(endpoint);
  return response;
};

/**
 * Quick create event from template
 *
 * @param data - Quick create input with template and entity details
 * @returns Promise resolving to created ScheduledEvent object
 */
export const quickCreate = async (data: QuickCreateInput): Promise<ScheduledEvent> => {
  const snakeCaseData = toSnakeCase(data as unknown as Record<string, unknown>);
  const response = await apiClient.request<ScheduledEvent>('/schedule/quick-create', {
    method: 'POST',
    body: JSON.stringify(snakeCaseData),
  });
  return response;
};
