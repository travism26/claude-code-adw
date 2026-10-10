/**
 * Photo Analysis Types
 *
 * Type definitions for cannabis plant photo analysis AI service
 * Supports visual deficiency detection using vision-capable AI models
 */

import { BaseAnalysisResponse } from '../core/types';

// ============================================================================
// Enums
// ============================================================================

/**
 * Overall health status of the plant based on visual analysis
 */
export enum HealthStatus {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

/**
 * Severity level of detected issues
 */
export enum IssueSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

/**
 * Types of issues that can be detected in plant photos
 */
export enum IssueType {
  // Nutrient Deficiencies
  NITROGEN_DEFICIENCY = 'nitrogen_deficiency',
  PHOSPHORUS_DEFICIENCY = 'phosphorus_deficiency',
  POTASSIUM_DEFICIENCY = 'potassium_deficiency',
  CALCIUM_DEFICIENCY = 'calcium_deficiency',
  MAGNESIUM_DEFICIENCY = 'magnesium_deficiency',
  IRON_DEFICIENCY = 'iron_deficiency',
  SULFUR_DEFICIENCY = 'sulfur_deficiency',

  // pH Issues
  PH_TOO_HIGH = 'ph_too_high',
  PH_TOO_LOW = 'ph_too_low',
  NUTRIENT_LOCKOUT = 'nutrient_lockout',

  // Environmental Stress
  LIGHT_BURN = 'light_burn',
  HEAT_STRESS = 'heat_stress',
  OVERWATERING = 'overwatering',
  UNDERWATERING = 'underwatering',
  HUMIDITY_STRESS = 'humidity_stress',

  // Pests
  SPIDER_MITES = 'spider_mites',
  FUNGUS_GNATS = 'fungus_gnats',
  THRIPS = 'thrips',
  APHIDS = 'aphids',

  // Diseases
  POWDERY_MILDEW = 'powdery_mildew',
  BUD_ROT = 'bud_rot',
  ROOT_ROT = 'root_rot',
  LEAF_SEPTORIA = 'leaf_septoria',

  // Other
  UNKNOWN = 'unknown',
}

// ============================================================================
// Context and Result Types
// ============================================================================

/**
 * Context data gathered for photo analysis
 * Includes photo metadata, image data, and grow context
 */
export interface GrowPhotoContext {
  // Photo metadata
  photoId: string;
  filePath: string;
  mimeType: string;
  caption?: string;
  dimensions?: { width: number; height: number };

  // Image data for vision API
  imageBase64: string;

  // Grow log context (when photo was taken)
  growLog?: {
    id: string;
    notes?: string;
    loggedAt: Date;
    environment?: {
      temperature?: number;
      humidity?: number;
      ph?: number;
      ec?: number;
      lightHours?: number;
    };
  };

  // Grow context (overall grow information)
  grow?: {
    id: string;
    phase: string;
    daysInPhase: number;
    method?: string;
    strain?: string;
  };
}

/**
 * Individual issue detected in the photo
 */
export interface DeficiencyIssue {
  /** Type of issue detected */
  type: IssueType | string;

  /** Severity level */
  severity: IssueSeverity;

  /** Confidence score (0-100) */
  confidence: number;

  /** Detailed description of the issue */
  description: string;

  /** Area of plant affected (e.g., "lower leaves", "new growth", "entire plant") */
  affectedArea: string;

  /** Recommended remediation steps */
  remediation: string[];
}

/**
 * Photo analysis result returned by the AI service
 * Extends BaseAnalysisResponse with photo-specific fields
 */
export interface PhotoAnalysisResult extends BaseAnalysisResponse {
  /** Overall health assessment */
  overallHealth: HealthStatus;

  /** Array of detected issues with details */
  issues: DeficiencyIssue[];

  /** General observations about the plant (positive or neutral) */
  generalObservations?: string[];

  /** Overall confidence in the analysis (0-100) */
  confidence: number;
}

/**
 * Payload structure for photo analysis jobs
 * Used by the queue worker to process photo analysis requests
 */
export interface PhotoAnalysisPayload {
  /** ID of the photo to analyze */
  photoId: string;

  /** ID of the grow log entry containing the photo */
  logId: string;

  /** ID of the user who owns the grow */
  userId: string;

  /** ID of the AI task (for persistence and tracking) */
  aiTaskId?: string;

  /** How the analysis was triggered */
  triggeredBy?: 'manual_request' | 'auto_upload';
}
