// Garden API queries and mutations using TanStack Query
import { ApiClient } from "../utils/api";
import type {
  Garden,
  CreateGardenRequest,
  UpdateGardenRequest,
  Plot,
  CreatePlotRequest,
  UpdatePlotRequest
} from "../types";

const apiClient = ApiClient.getInstance();

// Garden API Functions
export const fetchGardens = async (): Promise<Garden[]> => {
  const response = await apiClient.request<Garden[]>("/gardens");
  return response || [];
};

export const getGarden = async (id: string): Promise<Garden> => {
  const response = await apiClient.request<Garden>(`/gardens/${id}`);
  return response;
};

export const createGarden = async (
  gardenData: CreateGardenRequest
): Promise<Garden> => {
  const response = await apiClient.request<Garden>("/gardens", {
    method: "POST",
    body: JSON.stringify(gardenData),
  });
  return response;
};

export const updateGarden = async (
  id: string,
  gardenData: UpdateGardenRequest
): Promise<Garden> => {
  const response = await apiClient.request<Garden>(`/gardens/${id}`, {
    method: "PUT",
    body: JSON.stringify(gardenData),
  });
  return response;
};

export const deleteGarden = async (id: string): Promise<void> => {
  await apiClient.request(`/gardens/${id}`, { method: "DELETE" });
};

// Plot API Functions
export const createPlot = async (
  gardenId: string,
  plotData: CreatePlotRequest
): Promise<Plot> => {
  const response = await apiClient.request<Plot>(
    `/gardens/${gardenId}/plots`,
    {
      method: "POST",
      body: JSON.stringify(plotData),
    }
  );
  return response;
};

export const updatePlot = async (
  gardenId: string,
  plotId: string,
  plotData: UpdatePlotRequest
): Promise<Plot> => {
  const response = await apiClient.request<Plot>(
    `/gardens/${gardenId}/plots/${plotId}`,
    {
      method: "PUT",
      body: JSON.stringify(plotData),
    }
  );
  return response;
};

export const deletePlot = async (
  gardenId: string,
  plotId: string
): Promise<void> => {
  await apiClient.request(`/gardens/${gardenId}/plots/${plotId}`, {
    method: "DELETE",
  });
};
