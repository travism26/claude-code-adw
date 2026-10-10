/**
 * Environment Overview API Client
 * Handles fetching capacity and overview data for grow environments
 */

import { ApiClient } from '../utils/api';
import type { EnvironmentOverview, EnvironmentWithCapacity } from '../types';

const apiClient = ApiClient.getInstance();

/**
 * Fetch overview of all user's environments with capacity data
 */
export const getEnvironmentOverview = async (): Promise<EnvironmentOverview> => {
  const response = await apiClient.request<EnvironmentOverview>(
    '/environment-overview'
  );
  return response;
};

/**
 * Fetch capacity data for a single environment
 * @param id - Environment ID
 */
export const getEnvironmentCapacity = async (
  id: string
): Promise<EnvironmentWithCapacity> => {
  const response = await apiClient.request<EnvironmentWithCapacity>(
    `/environment-overview/${id}/capacity`
  );
  return response;
};
