/**
 * GrowEnvironment Type Definitions
 */

import type { CapacityStatus } from './environmentOverview';

export type EnvironmentType = 'tent' | 'room' | 'closet' | 'outdoor' | 'greenhouse';
export type LightType = 'led' | 'hps' | 'mh' | 'cfl' | 'sun' | 'other';

export interface GrowEnvironment {
  id: string;
  user_id: string;
  name: string;
  type: EnvironmentType;
  width_inches: number | null;
  depth_inches: number | null;
  height_inches: number | null;
  light_type: LightType | null;
  light_wattage: number | null;
  ventilation_cfm: number | null;
  has_carbon_filter: boolean;
  has_humidifier: boolean;
  has_dehumidifier: boolean;
  has_ac: boolean;
  has_heater: boolean;
  max_plants: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Association fields
  grows?: Array<{
    id: string;
    strain_name: string;
    phase: string;
  }>;
}

export interface CreateGrowEnvironmentRequest {
  name: string;
  type: EnvironmentType;
  width_inches?: number | null;
  depth_inches?: number | null;
  height_inches?: number | null;
  light_type?: LightType | null;
  light_wattage?: number | null;
  ventilation_cfm?: number | null;
  has_carbon_filter?: boolean;
  has_humidifier?: boolean;
  has_dehumidifier?: boolean;
  has_ac?: boolean;
  has_heater?: boolean;
  max_plants?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface UpdateGrowEnvironmentRequest {
  name?: string;
  type?: EnvironmentType;
  width_inches?: number | null;
  depth_inches?: number | null;
  height_inches?: number | null;
  light_type?: LightType | null;
  light_wattage?: number | null;
  ventilation_cfm?: number | null;
  has_carbon_filter?: boolean;
  has_humidifier?: boolean;
  has_dehumidifier?: boolean;
  has_ac?: boolean;
  has_heater?: boolean;
  max_plants?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface GrowEnvironmentFilters {
  type?: EnvironmentType;
  is_active?: boolean;
  name?: string;
  limit?: number;
  offset?: number;
}

export interface GrowEnvironmentsResponse {
  environments: GrowEnvironment[];
  total: number;
  limit: number;
  offset: number;
}

export interface GrowEnvironmentResponse {
  data: GrowEnvironment;
}

/**
 * Capacity Check Result
 * Returned when checking what capacity status would be if adding plants to an environment
 */
export interface CapacityCheckResult {
  environmentId: string;
  environmentName: string;
  maxPlants: number | null;
  currentPlants: number;
  requestedPlants: number;
  projectedPlants: number;
  projectedUtilization: number | null;
  capacityWarningThreshold: number;
  status: CapacityStatus;
  warnings: string[];
  allowed: true; // Always true - warnings are non-blocking
}

/**
 * Request payload for checking capacity
 */
export interface CheckCapacityRequest {
  environmentId: string;
  additionalPlants: number;
}

/**
 * Environment Capacity Info
 * Current capacity information for a single environment
 */
export interface EnvironmentCapacityInfo {
  id: string;
  name: string;
  type: string;
  displayColor: string | null;
  maxPlants: number | null;
  currentPlants: number;
  utilizationPercent: number | null;
  capacityWarningThreshold: number;
  capacityStatus: CapacityStatus;
  isActive: boolean;
}
