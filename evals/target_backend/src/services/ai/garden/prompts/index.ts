/**
 * Prompts Module Barrel Export
 * Clean import interface for prompt constants and helpers
 */

// Export all constants
export {
  SYSTEM_PROMPT_BASE,
  JSON_RESPONSE_FORMAT,
  ANALYSIS_GUIDELINES,
  SECTION_HEADERS,
  ANALYSIS_REQUEST_TEMPLATE,
} from './constants';

// Export status-specific helpers and constants
export {
  STATUS_PROMPT_GUIDANCE,
  getStatusPromptGuidance,
  getStatusLabel,
} from './statusPrompts';
