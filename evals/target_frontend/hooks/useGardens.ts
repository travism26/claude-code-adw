"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGardens,
  getGarden,
  createGarden,
  updateGarden,
  deleteGarden,
  createPlot,
  updatePlot,
  deletePlot,
} from "../api/gardenApi";
import type {
  Garden,
  CreateGardenRequest,
  UpdateGardenRequest,
  CreatePlotRequest,
  UpdatePlotRequest,
} from "../types";

// Hook for fetching all gardens
export const useGardens = () => {
  return useQuery<Garden[], Error>({
    queryKey: ["gardens"],
    queryFn: fetchGardens,
  });
};

// Hook for fetching a single garden
export const useGarden = (id: string | null) => {
  return useQuery<Garden, Error>({
    queryKey: ["gardens", id],
    queryFn: () => getGarden(id!),
    enabled: !!id,
    retry: false, // Don't retry on 404 errors
  });
};

// Hook for creating a garden
export const useCreateGarden = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGardenRequest) => createGarden(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gardens"] });
    },
  });
};

// Hook for updating a garden
export const useUpdateGarden = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGardenRequest }) =>
      updateGarden(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["gardens"] });
      queryClient.invalidateQueries({ queryKey: ["gardens", variables.id] });
    },
  });
};

// Hook for deleting a garden
export const useDeleteGarden = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteGarden(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gardens"] });
    },
  });
};

// Hook for creating a plot
export const useCreatePlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ gardenId, data }: { gardenId: string; data: CreatePlotRequest }) =>
      createPlot(gardenId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["gardens"] });
      queryClient.invalidateQueries({ queryKey: ["gardens", variables.gardenId] });
    },
  });
};

// Hook for updating a plot
export const useUpdatePlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      gardenId,
      plotId,
      data,
    }: {
      gardenId: string;
      plotId: string;
      data: UpdatePlotRequest;
    }) => updatePlot(gardenId, plotId, data),
    onSuccess: (_, variables) => {
      // Only invalidate queries on successful update
      queryClient.invalidateQueries({ queryKey: ["gardens"] });
      queryClient.invalidateQueries({ queryKey: ["gardens", variables.gardenId] });
    },
    onError: (error) => {
      // Error handling is done in the component
      // We don't invalidate queries here to prevent cache corruption
      console.error("Plot update failed:", error);
    },
  });
};

// Hook for deleting a plot
export const useDeletePlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ gardenId, plotId }: { gardenId: string; plotId: string }) =>
      deletePlot(gardenId, plotId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["gardens"] });
      queryClient.invalidateQueries({ queryKey: ["gardens", variables.gardenId] });
    },
  });
};
