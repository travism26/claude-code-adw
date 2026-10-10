/**
 * Layout generation types for AI-powered garden layout generator
 * Matches backend types from backend/src/services/ai/layout/types.ts
 */

/**
 * Represents a sun exposure zone in the garden
 */
export interface SunZone {
  /** Type of sun exposure: full sun, partial shade, or full shade */
  zoneType: 'full_sun' | 'partial_shade' | 'shade';
  /** Polygon coordinates defining the sun zone area */
  polygon: { x: number; y: number }[];
}

/**
 * User preferences for layout optimization
 */
export interface LayoutPreferences {
  /** Primary optimization goal for the layout */
  optimizationGoal: 'max_yield' | 'max_variety' | 'beginner_friendly';
  /** Spacing method to use for plant placement */
  spacingMethod: 'intensive' | 'square_foot' | 'traditional';
  /** Layout style pattern to use */
  layoutStyle?: 'cottage' | 'formal' | 'four_square' | 'block' | 'scattered';
  /** Yield goal for harvest planning */
  yieldGoal?: 'fresh_eating' | 'light_preservation' | 'heavy_preservation';
  /** Number of people in household */
  householdSize?: number;
}

/**
 * Represents a single plant placement in the generated layout
 */
export interface PlantPlacement {
  /** ID of the plant profile */
  plantProfileId: string;
  /** Display name of the plant */
  plantName: string;
  /** X coordinate on garden grid (in feet) */
  x: number;
  /** Y coordinate on garden grid (in feet) */
  y: number;
  /** Width of the plot area (in feet) */
  width: number;
  /** Height of the plot area (in feet) */
  height: number;
  /** Number of plants to place in this location */
  quantity: number;
  /** AI-generated explanation for this placement choice */
  reasoning: string;
  /** Number of plants in this plot block (for multi-plant blocks) */
  plantCount?: number;
}

/**
 * Represents one complete layout option with placements and scoring
 */
export interface LayoutOption {
  /** Unique identifier for this layout option */
  id: string;
  /** Optimization goal used to generate this layout */
  optimizationGoal: 'max_yield' | 'max_variety' | 'beginner_friendly';
  /** Array of plant placements in this layout */
  placements: PlantPlacement[];
  /** Overall layout quality score (0-100) */
  score: number;
  /** Score for companion planting relationships (0-100) */
  companionScore: number;
  /** Score for proper plant spacing (0-100) */
  spacingScore: number;
  /** Score for garden accessibility (0-100) */
  accessibilityScore: number;
  /** Array of warning messages about potential issues */
  warnings: string[];
}

/**
 * Request payload for generating garden layouts
 */
export interface LayoutGenerationRequest {
  /** Array of plant profile IDs to include in the layout */
  plantProfileIds: string[];
  /** Optional sun exposure zones in the garden (empty for Phase 2) */
  sunZones: SunZone[];
  /** User preferences for optimization */
  preferences: LayoutPreferences;
}

/**
 * Response from layout generation API
 * Contains job information and generated layouts when completed
 */
export interface LayoutGenerationResponse {
  /** BullMQ job identifier for status polling */
  jobId: string;
  /** Current status of the layout generation job */
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** Generated layout options (available when status is 'completed') */
  layouts?: LayoutOption[];
  /** Status message or error description */
  message?: string;
  /** Garden identifier */
  gardenId: string;
}
