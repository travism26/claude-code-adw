'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '../utils/api';
import type {
  JournalEntry,
  CreateJournalEntryRequest,
  UpdateJournalEntryRequest,
  ApiError,
} from '../types';

interface UseJournalReturn {
  entries: JournalEntry[];
  isLoading: boolean;
  error: string | null;
  fetchEntriesForPlant: (plantId: string) => Promise<void>;
  createEntry: (entryData: CreateJournalEntryRequest) => Promise<JournalEntry>;
  updateEntry: (
    id: string,
    entryData: UpdateJournalEntryRequest
  ) => Promise<JournalEntry>;
  deleteEntry: (id: string) => Promise<void>;
  getEntry: (id: string) => Promise<JournalEntry>;
  clearError: () => void;
}

export const useJournal = (): UseJournalReturn => {
  const [plantId, setPlantId] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const apiClient = ApiClient.getInstance();
  const queryClient = useQueryClient();

  // Fetch journal entries for a specific plant
  const {
    data: entries,
    error: queryError,
    isLoading,
    refetch,
  } = useQuery<JournalEntry[], Error>({
    queryKey: ['journal', plantId],
    queryFn: async () => {
      if (!plantId) return [];
      const response = await apiClient.request<{ entries: JournalEntry[] }>(
        `/journal/plant/${plantId}`
      );
      return response.entries;
    },
    enabled: !!plantId,
  });

  // Function to trigger fetch for a specific plant
  const fetchEntriesForPlant = async (newPlantId: string) => {
    setCustomError(null);
    setPlantId(newPlantId);
    await refetch();
  };

  // Create journal entry mutation
  const createMutation = useMutation({
    mutationFn: async (entryData: CreateJournalEntryRequest) => {
      const response = await apiClient.request<{ entry: JournalEntry }>(
        '/journal',
        {
          method: 'POST',
          body: JSON.stringify(entryData),
        }
      );
      return response.entry;
    },
    onSuccess: (newEntry) => {
      // Invalidate and refetch journal entries for the plant
      queryClient.invalidateQueries({ queryKey: ['journal', newEntry.plant_id] });
    },
    onError: (err: any) => {
      const apiError = err as ApiError;
      setCustomError(apiError.error || 'Failed to create journal entry');
    },
  });

  // Update journal entry mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...entryData
    }: { id: string } & UpdateJournalEntryRequest) => {
      const response = await apiClient.request<{ entry: JournalEntry }>(
        `/journal/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(entryData),
        }
      );
      return response.entry;
    },
    onSuccess: (updatedEntry) => {
      // Invalidate and refetch journal entries for the plant
      queryClient.invalidateQueries({
        queryKey: ['journal', updatedEntry.plant_id],
      });
    },
    onError: (err: any) => {
      const apiError = err as ApiError;
      setCustomError(apiError.error || 'Failed to update journal entry');
    },
  });

  // Delete journal entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.request(`/journal/${id}`, {
        method: 'DELETE',
      });
      return id;
    },
    onSuccess: () => {
      // Invalidate all journal queries since we don't know which plant the entry belonged to
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
    onError: (err: any) => {
      const apiError = err as ApiError;
      setCustomError(apiError.error || 'Failed to delete journal entry');
    },
  });

  // Get a single journal entry (direct API call, not using query)
  const getEntry = async (id: string): Promise<JournalEntry> => {
    setCustomError(null);
    try {
      const response = await apiClient.request<{ entry: JournalEntry }>(
        `/journal/${id}`
      );
      return response.entry;
    } catch (err) {
      const apiError = err as ApiError;
      setCustomError(apiError.error || 'Failed to fetch journal entry');
      throw err;
    }
  };

  const clearError = () => {
    setCustomError(null);
  };

  // Combine query error and custom error
  const error = customError || (queryError?.message ?? null);

  return {
    entries: entries || [],
    isLoading,
    error,
    fetchEntriesForPlant,
    createEntry: createMutation.mutateAsync,
    updateEntry: async (id: string, entryData: UpdateJournalEntryRequest) =>
      updateMutation.mutateAsync({ id, ...entryData }),
    deleteEntry: async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    getEntry,
    clearError,
  };
};
