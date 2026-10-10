"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "../utils/api";
import type { Plant, CreatePlantRequest, UpdatePlantRequest } from "../types";

// TanStack Query hook for plants
export const usePlants = () => {
  const apiClient = ApiClient.getInstance();
  const queryClient = useQueryClient();

  // Fetch all plants
  const { data, error, isLoading, isPending, refetch } = useQuery<Plant[], Error>({
    queryKey: ["plants"],
    queryFn: async () => {
      // API returns { plants: Plant[] }
      const res = await apiClient.request<{ plants: Plant[] }>("/plants");
      return res.plants;
    },
  });

  // Create plant
  const createMutation = useMutation({
    mutationFn: async (payload: CreatePlantRequest) => {
      const res = await apiClient.request<{ plant: Plant }>("/plants", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return res.plant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
    },
  });

  // Update plant
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & UpdatePlantRequest) => {
      const res = await apiClient.request<{ plant: Plant }>(`/plants/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return res.plant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
    },
  });

  // Delete plant
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.request(`/plants/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
    },
  });

  // Fetch single plant (optional, for detail views)
  const getPlant = async (id: string): Promise<Plant> => {
    const res = await apiClient.request<{ plant: Plant }>(`/plants/${id}`);
    return res.plant;
  };

  return {
    plants: data,
    error,
    isLoading,
    isPending,
    fetchPlants: refetch,
    createPlant: createMutation.mutateAsync,
    updatePlant: updateMutation.mutateAsync,
    deletePlant: deleteMutation.mutateAsync,
    getPlant,
    createStatus: createMutation.status,
    updateStatus: updateMutation.status,
    deleteStatus: deleteMutation.status,
  };
};
