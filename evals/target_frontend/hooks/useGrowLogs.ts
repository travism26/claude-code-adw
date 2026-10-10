"use client";

/**
 * Grow Log React Query Hooks
 *
 * Custom hooks for grow log CRUD operations, environment data, and photo management.
 * Implements hierarchical query key pattern and cache invalidation.
 * Components should use these hooks, never import API functions directly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLogs,
  getLog,
  createLog,
  updateLog,
  deleteLog,
  addEnvironment,
  updateEnvironment,
  getPhotos,
  uploadPhotos,
  deletePhoto,
  setCoverPhoto,
} from "../api/growLogApi";
import type {
  GrowLog,
  GrowLogsResponse,
  CreateGrowLogRequest,
  UpdateGrowLogRequest,
  GrowLogFilters,
  GrowLogEnvironment,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
  GrowLogPhoto,
} from "../types";
import { growKeys } from "./useGrows";

/**
 * Hierarchical query key factory for grow logs
 * Enables precise cache invalidation at different levels
 */
export const growLogKeys = {
  all: ["growLogs"] as const,
  lists: () => [...growLogKeys.all, "list"] as const,
  list: (growId: string, filters?: GrowLogFilters) =>
    [...growLogKeys.lists(), growId, filters] as const,
  details: () => [...growLogKeys.all, "detail"] as const,
  detail: (logId: string) => [...growLogKeys.details(), logId] as const,
  photos: (logId: string) => [...growLogKeys.all, "photos", logId] as const,
};

/**
 * Hook for fetching all log entries for a specific grow
 * Supports filtering by date range and phase
 *
 * @param growId - Grow UUID
 * @param filters - Optional filters for date range, phase, pagination
 * @returns Query result with logs array and metadata
 */
export const useGrowLogs = (growId: string, filters?: GrowLogFilters) => {
  return useQuery<GrowLogsResponse, Error>({
    queryKey: growLogKeys.list(growId, filters),
    queryFn: () => getLogs(growId, filters),
    enabled: !!growId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for fetching a single log entry by ID
 * Includes environment data and photos
 *
 * @param logId - Log entry UUID (null to disable query)
 * @returns Query result with log object
 */
export const useGrowLog = (logId: string | null) => {
  return useQuery<GrowLog, Error>({
    queryKey: growLogKeys.detail(logId!),
    queryFn: () => getLog(logId!),
    enabled: !!logId,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for creating a new log entry
 * Invalidates log lists and grow detail on success
 *
 * @returns Mutation function and state
 */
export const useCreateLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ growId, data }: { growId: string; data: CreateGrowLogRequest }) =>
      createLog(growId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
      queryClient.invalidateQueries({ queryKey: growKeys.detail(variables.growId) });
    },
  });
};

/**
 * Hook for updating an existing log entry
 * Invalidates both the specific log and all lists on success
 *
 * @returns Mutation function and state
 */
export const useUpdateLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, data }: { logId: string; data: UpdateGrowLogRequest }) =>
      updateLog(logId, data),
    onSuccess: (updatedLog) => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
      queryClient.invalidateQueries({ queryKey: growLogKeys.detail(updatedLog.id) });
    },
  });
};

/**
 * Hook for deleting a log entry
 * Invalidates log lists on success
 *
 * @returns Mutation function and state
 */
export const useDeleteLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logId: string) => deleteLog(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
    },
  });
};

/**
 * Hook for adding environment data to a log entry
 * Invalidates the specific log detail on success
 *
 * @returns Mutation function and state
 */
export const useAddEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, data }: { logId: string; data: CreateEnvironmentRequest }) =>
      addEnvironment(logId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.detail(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
    },
  });
};

/**
 * Hook for updating environment data for a log entry
 * Invalidates the specific log detail on success
 *
 * @returns Mutation function and state
 */
export const useUpdateEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, data }: { logId: string; data: UpdateEnvironmentRequest }) =>
      updateEnvironment(logId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.detail(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
    },
  });
};

/**
 * Hook for fetching photos for a log entry
 *
 * @param logId - Log entry UUID (null to disable query)
 * @returns Query result with photos array
 */
export const useGrowLogPhotos = (logId: string | null) => {
  return useQuery<GrowLogPhoto[], Error>({
    queryKey: growLogKeys.photos(logId!),
    queryFn: () => getPhotos(logId!),
    enabled: !!logId,
    staleTime: 10 * 60 * 1000, // 10 minutes (photos change less frequently)
  });
};

/**
 * Hook for uploading photos to a log entry
 * Invalidates photos cache and log detail on success
 *
 * @returns Mutation function and state
 */
export const useUploadPhotos = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, formData }: { logId: string; formData: FormData }) =>
      uploadPhotos(logId, formData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.photos(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.detail(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
    },
  });
};

/**
 * Hook for deleting a photo from a log entry
 * Invalidates photos cache on success
 *
 * @returns Mutation function and state
 */
export const useDeletePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, logId }: { photoId: string; logId: string }) =>
      deletePhoto(photoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.photos(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.detail(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
    },
  });
};

/**
 * Hook for setting a photo as the cover photo
 * Invalidates photos cache on success
 *
 * @returns Mutation function and state
 */
export const useSetCoverPhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, logId }: { photoId: string; logId: string }) =>
      setCoverPhoto(photoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growLogKeys.photos(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.detail(variables.logId) });
      queryClient.invalidateQueries({ queryKey: growLogKeys.lists() });
    },
  });
};
