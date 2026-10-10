"use client";

/**
 * Schedule React Query Hooks
 *
 * Custom hooks for scheduled event CRUD operations using TanStack Query.
 * Implements hierarchical query key pattern and cache invalidation.
 * Components should use these hooks, never import API functions directly.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  completeEvent,
  skipEvent,
  getAgenda,
  quickCreate,
} from '../api/scheduleApi';
import type {
  ScheduledEvent,
  CreateEventInput,
  UpdateEventInput,
  EventFilters,
  ScheduleEventsResponse,
  ScheduleAgenda,
  QuickCreateInput,
} from '../types';

/**
 * Hierarchical query key factory for scheduled events
 * Enables precise cache invalidation at different levels
 */
export const scheduleKeys = {
  all: ['schedule'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  list: (filters?: EventFilters) => [...scheduleKeys.lists(), filters] as const,
  details: () => [...scheduleKeys.all, 'detail'] as const,
  detail: (id: string) => [...scheduleKeys.details(), id] as const,
  agenda: (days?: number) => [...scheduleKeys.all, 'agenda', days] as const,
};

/**
 * Hook for fetching scheduled events with optional filters
 * Supports filtering by entity, environment, status, date range, and pagination
 *
 * @param filters - Optional filters for entity, environment, status, dates, pagination
 * @returns Query result with events array and total count
 */
export const useScheduleEvents = (filters?: EventFilters) => {
  return useQuery<ScheduleEventsResponse, Error>({
    queryKey: scheduleKeys.list(filters),
    queryFn: () => getEvents(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook for fetching a single scheduled event by ID
 *
 * @param id - Event UUID (null to disable query)
 * @returns Query result with event object
 */
export const useScheduleEvent = (id: string | null) => {
  return useQuery<ScheduledEvent, Error>({
    queryKey: scheduleKeys.detail(id!),
    queryFn: () => getEvent(id!),
    enabled: !!id,
    retry: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook for fetching agenda view (overdue, today, upcoming)
 *
 * @param days - Number of days to look ahead (default 7)
 * @returns Query result with agenda structure
 */
export const useScheduleAgenda = (days?: number) => {
  return useQuery<ScheduleAgenda, Error>({
    queryKey: scheduleKeys.agenda(days),
    queryFn: () => getAgenda(days),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

/**
 * Hook for creating a new scheduled event
 * Invalidates all event lists and agenda on success
 *
 * @returns Mutation function and state
 */
export const useCreateScheduleEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEventInput) => createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

/**
 * Hook for updating an existing scheduled event
 * Invalidates specific event, all lists, and agenda on success
 *
 * @returns Mutation function and state
 */
export const useUpdateScheduleEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventInput }) =>
      updateEvent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

/**
 * Hook for deleting a scheduled event
 * Invalidates all lists and agenda on success
 *
 * @returns Mutation function and state
 */
export const useDeleteScheduleEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

/**
 * Hook for marking a scheduled event as completed
 * Uses optimistic updates for instant UI feedback
 *
 * @returns Mutation function and state
 */
export const useCompleteScheduleEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completeEvent(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: scheduleKeys.detail(id) });

      // Snapshot previous value
      const previousEvent = queryClient.getQueryData(scheduleKeys.detail(id));

      // Optimistically update to completed
      queryClient.setQueryData(scheduleKeys.detail(id), (old: any) => ({
        ...old,
        status: 'completed',
        completedAt: new Date().toISOString(),
      }));

      return { previousEvent };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousEvent) {
        queryClient.setQueryData(scheduleKeys.detail(id), context.previousEvent);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

/**
 * Hook for marking a scheduled event as skipped
 * Uses optimistic updates for instant UI feedback
 *
 * @returns Mutation function and state
 */
export const useSkipScheduleEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => skipEvent(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: scheduleKeys.detail(id) });

      // Snapshot previous value
      const previousEvent = queryClient.getQueryData(scheduleKeys.detail(id));

      // Optimistically update to skipped
      queryClient.setQueryData(scheduleKeys.detail(id), (old: any) => ({
        ...old,
        status: 'skipped',
      }));

      return { previousEvent };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousEvent) {
        queryClient.setQueryData(scheduleKeys.detail(id), context.previousEvent);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

/**
 * Hook for quick creating event from template
 * Invalidates all event lists and agenda on success
 *
 * @returns Mutation function and state
 */
export const useQuickCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: QuickCreateInput) => quickCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};
