// Plant API queries and mutations using TanStack Query
import { ApiClient } from "../utils/api";
import type { Plant, CreatePlantRequest, UpdatePlantRequest } from "../types";

const apiClient = ApiClient.getInstance();

export const fetchPlants = async (): Promise<Plant[]> => {
  const response = await apiClient.request<{ plants: Plant[] }>("/plants");
  return response.plants;
};

export const getPlant = async (id: string): Promise<Plant> => {
  const response = await apiClient.request<{ plant: Plant }>(`/plants/${id}`);
  return response.plant;
};

export const createPlant = async (
  plantData: CreatePlantRequest
): Promise<Plant> => {
  const response = await apiClient.request<{ plant: Plant }>("/plants", {
    method: "POST",
    body: JSON.stringify(plantData),
  });
  return response.plant;
};

export const updatePlant = async (
  id: string,
  plantData: UpdatePlantRequest
): Promise<Plant> => {
  const response = await apiClient.request<{ plant: Plant }>(`/plants/${id}`, {
    method: "PUT",
    body: JSON.stringify(plantData),
  });
  return response.plant;
};

export const deletePlant = async (id: string): Promise<void> => {
  await apiClient.request(`/plants/${id}`, { method: "DELETE" });
};
