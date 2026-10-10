/**
 * Nutrient and GrowNutrient type definitions for the GrowBuddy v2 application.
 * These types match the backend Sequelize models exactly.
 */

/**
 * Nutrient type enum - categorizes different kinds of nutrient products
 */
export type NutrientType = 'base' | 'supplement' | 'additive' | 'ph_adjuster' | 'other';

/**
 * Frequency enum for nutrient application schedule
 */
export type GrowNutrientFrequency = 'every_watering' | 'weekly' | 'biweekly' | 'as_needed';

/**
 * Growth phase enum for when to apply nutrients
 */
export type GrowNutrientPhase = 'all' | 'vegetative' | 'flowering' | 'late_flowering';

/**
 * Nutrient entity - represents a nutrient product (system or user-created)
 */
export interface Nutrient {
  id: string;
  user_id: string | null; // null indicates system nutrient
  brand: string;
  product_name: string;
  type: NutrientType;
  npk_ratio: string | null;
  description: string | null;
  is_organic: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GrowNutrient entity - represents a nutrient assigned to a specific grow
 * with dosage and application configuration
 */
export interface GrowNutrient {
  id: string;
  grow_id: string;
  nutrient_id: string;
  dosage_ml_per_gallon: number | null;
  frequency: GrowNutrientFrequency | null;
  phase_used: GrowNutrientPhase | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  nutrient?: Nutrient; // Populated when fetching grow nutrients
}

/**
 * Filters for querying nutrients
 */
export interface NutrientFilters {
  brand?: string;
  type?: NutrientType;
  is_organic?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Request payload for creating a custom nutrient
 */
export interface CreateNutrientRequest {
  brand: string;
  product_name: string;
  type: NutrientType;
  npk_ratio?: string | null;
  description?: string | null;
  is_organic?: boolean;
}

/**
 * Request payload for updating a custom nutrient
 */
export interface UpdateNutrientRequest {
  brand?: string;
  product_name?: string;
  type?: NutrientType;
  npk_ratio?: string | null;
  description?: string | null;
  is_organic?: boolean;
}

/**
 * Request payload for adding a nutrient to a grow
 */
export interface CreateGrowNutrientRequest {
  nutrient_id: string;
  dosage_ml_per_gallon?: number | null;
  frequency?: GrowNutrientFrequency | null;
  phase_used?: GrowNutrientPhase | null;
  notes?: string | null;
}

/**
 * Request payload for updating a grow-nutrient relationship
 */
export interface UpdateGrowNutrientRequest {
  dosage_ml_per_gallon?: number | null;
  frequency?: GrowNutrientFrequency | null;
  phase_used?: GrowNutrientPhase | null;
  notes?: string | null;
}

/**
 * API response for GET /api/nutrients
 */
export interface NutrientsResponse {
  nutrients: Nutrient[];
}

/**
 * API response for GET /api/grows/:growId/nutrients
 */
export interface GrowNutrientsResponse {
  grow_nutrients: GrowNutrient[];
}

/**
 * Helper type for nutrient selection state in forms
 */
export interface SelectedNutrient {
  nutrient: Nutrient;
  dosage_ml_per_gallon?: number;
  frequency?: GrowNutrientFrequency;
  phase_used?: GrowNutrientPhase;
  notes?: string;
}
