/**
 * Grow Tracking Types
 *
 * TypeScript interfaces matching backend Grow model structure.
 * These types support the cannabis grow tracking feature including
 * strain information, cultivation methods, phases, and timing.
 */

import { GrowEnvironment } from './growEnvironment';

/**
 * Cannabis strain types
 */
export type StrainType = 'indica' | 'sativa' | 'hybrid' | 'ruderalis';

/**
 * Growing methods supported by the system
 */
export type GrowMethod = 'soil' | 'coco' | 'hydro' | 'dwc' | 'aero' | 'other';

/**
 * Light types used in cultivation
 */
export type LightType = 'led' | 'hps' | 'mh' | 'cfl' | 'sun' | 'other';

/**
 * Cultivation phases in chronological order
 */
export type GrowPhase = 'germination' | 'vegetative' | 'flowering' | 'harvest' | 'archived';

/**
 * Main Grow interface matching backend model
 * Represents a complete cultivation cycle from seed to harvest
 */
export interface Grow {
  id: string;
  user_id: string;
  strain_name: string;
  strain_type: StrainType | null;
  grow_method: GrowMethod | null;
  grow_medium: string | null;
  light_type: LightType | null;
  light_wattage: number | null;
  grow_space_sqft: number | null;
  pot_size_gallons: number | null;
  plant_count: number;
  environment_id: string | null;
  phase: GrowPhase;
  phase_started_at: string | null;
  started_at: string;
  harvested_at: string | null;
  notes: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Association fields
  environment?: GrowEnvironment;
}

/**
 * Request payload for creating a new grow
 * Required fields: strain_name, plant_count, started_at
 */
export interface CreateGrowRequest {
  strain_name: string;
  strain_type?: StrainType | null;
  grow_method?: GrowMethod | null;
  grow_medium?: string | null;
  light_type?: LightType | null;
  light_wattage?: number | null;
  grow_space_sqft?: number | null;
  pot_size_gallons?: number | null;
  plant_count: number;
  environment_id?: string | null;
  phase?: GrowPhase;
  phase_started_at?: string | null;
  started_at: string;
  harvested_at?: string | null;
  notes?: string | null;
  is_public?: boolean;
}

/**
 * Request payload for updating an existing grow
 * All fields are optional for partial updates
 */
export interface UpdateGrowRequest {
  strain_name?: string;
  strain_type?: StrainType | null;
  grow_method?: GrowMethod | null;
  grow_medium?: string | null;
  light_type?: LightType | null;
  light_wattage?: number | null;
  grow_space_sqft?: number | null;
  pot_size_gallons?: number | null;
  plant_count?: number;
  environment_id?: string | null;
  started_at?: string;
  harvested_at?: string | null;
  notes?: string | null;
  is_public?: boolean;
}

/**
 * Request payload for updating grow phase
 * Used when transitioning between cultivation phases
 */
export interface UpdatePhaseRequest {
  phase: GrowPhase;
  phase_started_at?: string | null;
}

/**
 * Query filters for listing grows
 * Used to filter and search grows by phase and strain name
 */
export interface GrowFilters {
  phase?: GrowPhase;
  strain_name?: string;
  limit?: number;
  offset?: number;
}

/**
 * API response for list endpoint
 * Contains array of grows and pagination metadata
 */
export interface GrowsResponse {
  grows: Grow[];
  total: number;
  limit: number;
  offset: number;
}
