/**
 * Grow Log Type System
 *
 * TypeScript interfaces matching backend GrowLog, GrowLogEnvironment,
 * and GrowLogPhoto models. These types support the timeline feature
 * for tracking cannabis cultivation progress through log entries,
 * environmental data, and photo documentation.
 */

import { GrowPhase } from './grow';

/**
 * GrowLog interface matching backend model
 * Represents a single log entry documenting a grow at a specific point in time
 */
export interface GrowLog {
  id: string;
  grow_id: string;
  logged_at: string; // ISO 8601 datetime
  phase: GrowPhase;
  day_number: number | null; // Days since grow start
  height_inches: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Populated relations
  environment?: GrowLogEnvironment;
  photos?: GrowLogPhoto[];
}

/**
 * GrowLogEnvironment interface matching backend model
 * Environmental conditions recorded for a specific log entry
 */
export interface GrowLogEnvironment {
  id: string;
  log_id: string;
  temperature_f: number | null; // Fahrenheit
  humidity_percent: number | null; // Relative humidity (0-100)
  ph: number | null; // pH level (0-14)
  ec: number | null; // Electrical conductivity (mS/cm)
  ppm: number | null; // Parts per million (TDS)
  co2_ppm: number | null; // CO2 concentration in PPM
  light_hours: number | null; // Light cycle hours per day
  light_distance_inches: number | null; // Distance from light to canopy
  vpd: number | null; // Vapor Pressure Deficit (kPa)
  created_at: string;
  updated_at: string;
}

/**
 * GrowLogPhoto interface matching backend model
 * Photo metadata for images attached to log entries
 */
export interface GrowLogPhoto {
  id: string;
  log_id: string;
  file_path: string; // Relative path from backend uploads directory
  thumbnail_path: string | null; // Path to thumbnail image
  original_filename: string;
  caption: string | null;
  is_cover: boolean; // Indicates if this is the cover photo for the log
  created_at: string;
  updated_at: string;
}

/**
 * Request payload for creating a new grow log entry
 * Required: grow_id (via URL param), logged_at
 */
export interface CreateGrowLogRequest {
  logged_at: string; // ISO 8601 datetime
  phase?: GrowPhase;
  day_number?: number | null;
  height_inches?: number | null;
  notes?: string | null;
  // Environment data can be added in the same request (optional)
  environment?: Omit<CreateEnvironmentRequest, 'log_id'>;
}

/**
 * Request payload for updating an existing grow log entry
 * All fields are optional for partial updates
 */
export interface UpdateGrowLogRequest {
  logged_at?: string;
  phase?: GrowPhase;
  day_number?: number | null;
  height_inches?: number | null;
  notes?: string | null;
}

/**
 * Request payload for adding environment data to a log entry
 * All environmental readings are optional
 */
export interface CreateEnvironmentRequest {
  log_id?: string; // Used when adding separately, omitted when nested in log creation
  temperature_f?: number | null;
  humidity_percent?: number | null;
  ph?: number | null;
  ec?: number | null;
  ppm?: number | null;
  co2_ppm?: number | null;
  light_hours?: number | null;
  light_distance_inches?: number | null;
  vpd?: number | null;
}

/**
 * Request payload for updating environment data
 * All fields are optional for partial updates
 */
export interface UpdateEnvironmentRequest {
  temperature_f?: number | null;
  humidity_percent?: number | null;
  ph?: number | null;
  ec?: number | null;
  ppm?: number | null;
  co2_ppm?: number | null;
  light_hours?: number | null;
  light_distance_inches?: number | null;
  vpd?: number | null;
}

/**
 * Filters for querying grow logs
 * Used to filter logs by date range and phase
 */
export interface GrowLogFilters {
  date_from?: string; // ISO 8601 date (YYYY-MM-DD)
  date_to?: string; // ISO 8601 date (YYYY-MM-DD)
  phase?: GrowPhase;
  limit?: number;
  offset?: number;
}

/**
 * API response for GET /api/grows/:id/logs
 * Contains array of logs and pagination metadata
 */
export interface GrowLogsResponse {
  logs: GrowLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * API response for GET /api/grow-logs/:id
 * Single log entry with all relations populated
 */
export interface GrowLogDetailResponse {
  log: GrowLog;
}

/**
 * Request payload for uploading photos to a log entry
 * Uses FormData for multi-file upload (max 10 photos per log)
 */
export interface UploadPhotosRequest {
  files: File[]; // Array of image files
  captions?: string[]; // Optional captions matching file order
}

/**
 * API response for GET /api/grow-logs/:id/photos
 * Array of photos associated with a log entry
 */
export interface GrowLogPhotosResponse {
  photos: GrowLogPhoto[];
}

/**
 * Request payload for setting a photo as cover
 */
export interface SetCoverPhotoRequest {
  photo_id: string;
}

/**
 * Sort order for log timeline display
 */
export type LogSortOrder = 'newest_first' | 'oldest_first';

/**
 * Helper type for date grouping in timeline
 * Groups logs by display date (e.g., "February 10, 2026")
 */
export interface GroupedLogs {
  date: string; // Display date string
  logs: GrowLog[];
}
