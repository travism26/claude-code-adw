/**
 * Status-Specific Prompt Guidance
 * Organized prompt guidance for each plot lifecycle status
 */

import { PlotContext } from '../types';

/**
 * Status-specific AI guidance for each plot lifecycle state
 * Each status type has independent, isolated prompt guidance
 */
export const STATUS_PROMPT_GUIDANCE = {
  planned: `- For "planned" plots (not yet physically planted):
  * Suggest optimal plant selection and placement strategies
  * Recommend companion planting arrangements
  * Provide spacing and orientation advice
  * These changes are easy to implement since nothing is in the ground`,

  planted: `- For "planted" plots (plants are in the ground and growing):
  * Focus on care improvements and optimization within constraints
  * Avoid suggesting relocation of established plants
  * Recommend spacing adjustments only for future plantings
  * Provide care and maintenance suggestions`,

  harvested: `- For "harvested" plots (plants have been harvested):
  * Acknowledge completion and suggest crop rotation
  * Recommend what to plant next`,

  archived: `- For "archived" plots (no longer active):
  * Acknowledge archived status, minimal suggestions`,
} as const;

/**
 * Get concatenated status guidance for system prompt
 * Returns all status types' guidance joined together
 */
export function getStatusPromptGuidance(): string {
  const guidance = Object.values(STATUS_PROMPT_GUIDANCE);
  return '\n\nIMPORTANT - Plot Status Awareness:\n' + guidance.join('\n');
}

/**
 * Get human-readable status label for a plot status
 * Used in plot details sections
 */
export function getStatusLabel(status: PlotContext['status']): string {
  const labels: Record<PlotContext['status'], string> = {
    planned: 'PLANNED (not yet planted)',
    planted: 'PLANTED (in ground)',
    harvested: 'HARVESTED (completed)',
    archived: 'ARCHIVED (inactive)',
  };

  return labels[status] || 'UNKNOWN';
}
