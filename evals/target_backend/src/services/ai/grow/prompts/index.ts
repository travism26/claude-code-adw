/**
 * Prompts Module Barrel Export
 * Clean import interface for prompt constants and helpers
 */

// Export all constants
export {
  JSON_RESPONSE_FORMAT,
  ANALYSIS_GUIDELINES,
  SECTION_HEADERS,
  SYSTEM_PROMPT_GENERAL,
  SYSTEM_PROMPT_NUTRIENTS,
  SYSTEM_PROMPT_DIAGNOSIS,
  SYSTEM_PROMPT_OPTIMIZATION,
  SYSTEM_PROMPT_HARVEST_TIMING,
  ANALYSIS_REQUEST_GENERAL,
  ANALYSIS_REQUEST_NUTRIENTS,
  ANALYSIS_REQUEST_DIAGNOSIS,
  ANALYSIS_REQUEST_OPTIMIZATION,
  ANALYSIS_REQUEST_HARVEST_TIMING,
} from './constants';

// Export phase-specific helpers
export {
  PHASE_GUIDANCE,
  getPhaseGuidance,
  getPhaseAnalysisGuidance,
} from './phasePrompts';
