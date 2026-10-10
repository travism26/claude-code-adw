/**
 * Plant Care Prompt Builder
 * Responsible for constructing AI prompts for plant care analysis
 */

import { AIPrompts } from '../core/types';
import { PlantCareContext } from './types';

export class PlantCarePromptBuilder {
  /**
   * Build comprehensive AI prompts for plant care analysis
   */
  static build(context: PlantCareContext): AIPrompts {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt with AI role and response format
   */
  private static buildSystemPrompt(): string {
    return `You are GrowBuddy AI, an expert plant care advisor.

Your role is to analyze individual plants and provide personalized care recommendations based on:
- Plant species, type, and family
- Care history (watering, fertilizing)
- Environmental conditions (zone compatibility, season, sunlight)
- Garden location and plot details
- Current growth stage and care needs

Respond with a JSON object in this exact format:
{
  "suggestions": [
    {
      "type": "improvement" | "warning" | "optimization",
      "category": "watering" | "fertilizing" | "sunlight" | "zone_compatibility" | "seasonal_care" | "general_health",
      "title": "Brief title",
      "description": "Detailed explanation with specific actionable steps",
      "affectedIds": ["plant-id"],
      "priority": "high" | "medium" | "low",
      "actionable": true | false
    }
  ],
  "overallScore": 75,
  "summary": "Brief 2-3 sentence overview of the plant's health and key care recommendations"
}

Guidelines:
- Be specific and actionable in care instructions
- Consider the current season and timing
- Prioritize based on plant health urgency
- Reference specific care schedules when relevant
- Keep summary encouraging and informative`;
  }

  /**
   * Build detailed user prompt with all plant context
   */
  private static buildUserPrompt(context: PlantCareContext): string {
    const sections: string[] = [];

    sections.push(this.buildPlantOverviewSection(context));
    sections.push(this.buildCareHistorySection(context));
    sections.push(this.buildEnvironmentalSection(context));
    sections.push(this.buildLocationSection(context));
    sections.push(this.buildAnalysisRequestSection());

    return sections.join('\n');
  }

  /**
   * Build plant overview section
   */
  private static buildPlantOverviewSection(context: PlantCareContext): string {
    return `=== PLANT OVERVIEW ===
Name: ${context.plant.name}
Species: ${context.plant.species || 'Not specified'}
Type: ${context.plant.type}
Plant Family: ${context.plant.plantFamily || 'Not specified'}
Difficulty: ${context.plant.difficulty}
Sunlight Requirements: ${context.plant.sunlightRequirements || 'Not specified'}
Spacing Requirement: ${context.plant.spacingInches ? context.plant.spacingInches + ' inches' : 'Not specified'}
Zone Range: ${context.plant.zoneMin || '?'} - ${context.plant.zoneMax || '?'}`;
  }

  /**
   * Build care history section
   */
  private static buildCareHistorySection(context: PlantCareContext): string {
    const lastWatered = context.careHistory.lastWatered
      ? new Date(context.careHistory.lastWatered).toLocaleDateString()
      : 'Never recorded';
    const lastFertilized = context.careHistory.lastFertilized
      ? new Date(context.careHistory.lastFertilized).toLocaleDateString()
      : 'Never recorded';

    return `\n=== CARE HISTORY ===
Last Watered: ${lastWatered}${context.careHistory.daysSinceWatered !== null ? ` (${context.careHistory.daysSinceWatered} days ago)` : ''}
Last Fertilized: ${lastFertilized}${context.careHistory.daysSinceFertilized !== null ? ` (${context.careHistory.daysSinceFertilized} days ago)` : ''}`;
  }

  /**
   * Build environmental section
   */
  private static buildEnvironmentalSection(context: PlantCareContext): string {
    const zoneStatus = context.environmental.zoneCompatible
      ? 'Compatible ✓'
      : 'Warning: May be outside ideal zone range';

    return `\n=== ENVIRONMENTAL CONDITIONS ===
User's Growing Zone: ${context.user.zone || 'Not specified'}
Zone Compatibility: ${zoneStatus}
Current Season: ${context.environmental.currentSeason}
Timezone: ${context.user.timezone}`;
  }

  /**
   * Build location section
   */
  private static buildLocationSection(context: PlantCareContext): string {
    if (!context.plot || !context.garden) {
      return '\n=== LOCATION ===\nPlant is not currently placed in a garden plot.';
    }

    return `\n=== LOCATION ===
Garden: ${context.garden.name}
Garden Zone: ${context.garden.zone || 'Not specified'}
Plot Position: (${context.plot.position.x}, ${context.plot.position.y})
Plot Size: ${context.plot.dimensions.width}ft x ${context.plot.dimensions.height}ft
Compass Direction: ${context.plot.compassDirection || 'Not specified'}${context.plot.notes ? '\nPlot Notes: ' + context.plot.notes : ''}`;
  }

  /**
   * Build analysis request section
   */
  private static buildAnalysisRequestSection(): string {
    return `\n=== ANALYSIS REQUEST ===
Please analyze this plant's current care status and provide:
1. Watering recommendations based on care history and current conditions
2. Fertilizing schedule and recommendations
3. Seasonal care adjustments for the current ${new Date().toLocaleDateString('en-US', { month: 'long' })} period
4. Zone compatibility concerns if any
5. Sunlight optimization based on location and requirements
6. General health tips and preventive care measures

Focus on actionable recommendations that will keep this plant healthy and thriving.`;
  }
}
