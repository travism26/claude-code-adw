/**
 * Care Recommendation Prompt Builder
 * Responsible for constructing AI prompts for care recommendation analysis
 */

import { AIPrompts } from '../core/types';
import { CareRecommendationContext } from './types';

export class CareRecommendationPromptBuilder {
  /**
   * Build comprehensive AI prompts for care recommendation analysis
   */
  static build(context: CareRecommendationContext): AIPrompts {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt with AI role and response format
   */
  private static buildSystemPrompt(): string {
    return `You are GrowBuddy AI, an expert plant care advisor specializing in personalized care schedules.

Your role is to provide comprehensive care recommendations based on:
- Plant species, type, and care requirements
- Current care schedule and history
- Seasonal timing and growth stages
- User's growing zone and conditions
- Plant difficulty level and specific needs

Respond with a JSON object in this exact format:
{
  "suggestions": [
    {
      "type": "improvement" | "warning" | "optimization",
      "category": "watering" | "fertilizing" | "pruning" | "seasonal_care" | "general_maintenance",
      "title": "Brief title",
      "description": "Detailed care instructions with specific timing and methods",
      "affectedIds": ["plant-id"],
      "priority": "high" | "medium" | "low",
      "actionable": true | false
    }
  ],
  "overallScore": 75,
  "summary": "Brief 2-3 sentence overview of the plant's care status and key recommendations"
}

Guidelines:
- Be specific about timing (every 3 days, weekly, monthly, etc.)
- Include seasonal adjustments for care schedules
- Provide detailed methods (how much water, what type of fertilizer, etc.)
- Consider growth stage when making recommendations
- Keep advice practical and easy to follow`;
  }

  /**
   * Build detailed user prompt with all care context
   */
  private static buildUserPrompt(context: CareRecommendationContext): string {
    const sections: string[] = [];

    sections.push(this.buildPlantOverviewSection(context));
    sections.push(this.buildCurrentCareScheduleSection(context));
    sections.push(this.buildCareHistorySection(context));
    sections.push(this.buildSeasonalContextSection(context));
    sections.push(this.buildAnalysisRequestSection(context));

    return sections.join('\n');
  }

  /**
   * Build plant overview section
   */
  private static buildPlantOverviewSection(
    context: CareRecommendationContext
  ): string {
    return `=== PLANT OVERVIEW ===
Name: ${context.plant.name}
Species: ${context.plant.species || 'Not specified'}
Type: ${context.plant.type}
Plant Family: ${context.plant.plantFamily || 'Not specified'}
Difficulty: ${context.plant.difficulty}
Sunlight Requirements: ${context.plant.sunlightRequirements || 'Not specified'}
Zone Range: ${context.plant.zoneMin || '?'} - ${context.plant.zoneMax || '?'}
User's Growing Zone: ${context.user.zone || 'Not specified'}`;
  }

  /**
   * Build current care schedule section
   */
  private static buildCurrentCareScheduleSection(
    context: CareRecommendationContext
  ): string {
    return `\n=== CURRENT CARE SCHEDULE ===
Watering Interval: Every ${context.plant.waterIntervalDays} day(s)
Fertilizing Interval: ${context.plant.fertIntervalDays ? `Every ${context.plant.fertIntervalDays} day(s)` : 'Not set'}${context.recommendations.growthStage ? `\nGrowth Stage: ${context.recommendations.growthStage}` : ''}`;
  }

  /**
   * Build care history section
   */
  private static buildCareHistorySection(context: CareRecommendationContext): string {
    const lastWatered = context.careHistory.lastWatered
      ? new Date(context.careHistory.lastWatered).toLocaleDateString()
      : 'Never recorded';
    const lastFertilized = context.careHistory.lastFertilized
      ? new Date(context.careHistory.lastFertilized).toLocaleDateString()
      : 'Never recorded';

    return `\n=== CARE HISTORY ===
Last Watered: ${lastWatered}${context.careHistory.daysSinceWatered !== null ? ` (${context.careHistory.daysSinceWatered} days ago)` : ''}
Last Fertilized: ${lastFertilized}${context.careHistory.daysSinceFertilized !== null ? ` (${context.careHistory.daysSinceFertilized} days ago)` : ''}
Total Waterings: ${context.careHistory.totalWaterings}
Total Fertilizations: ${context.careHistory.totalFertilizations}`;
  }

  /**
   * Build seasonal context section
   */
  private static buildSeasonalContextSection(
    context: CareRecommendationContext
  ): string {
    const seasonStatus = context.seasonalContext.isGrowingSeason
      ? 'Active growing season'
      : 'Dormant season';

    return `\n=== SEASONAL CONTEXT ===
Current Season: ${context.seasonalContext.currentSeason} (${context.seasonalContext.month})
Status: ${seasonStatus}
Timezone: ${context.user.timezone}`;
  }

  /**
   * Build analysis request section
   */
  private static buildAnalysisRequestSection(
    context: CareRecommendationContext
  ): string {
    let specificRequest = '';

    if (context.recommendations.requestedType) {
      const typeDescriptions = {
        watering: 'watering schedule and techniques',
        fertilizing: 'fertilization schedule and product recommendations',
        pruning: 'pruning timing and techniques',
        general: 'general care recommendations',
      };
      specificRequest = `\nSpecific Request: Provide detailed recommendations for ${typeDescriptions[context.recommendations.requestedType]}.`;
    }

    return `\n=== ANALYSIS REQUEST ===
Please provide comprehensive care recommendations for this plant:${specificRequest}

Include:
1. Watering schedule adjustments based on season and plant needs
2. Fertilization recommendations (type, frequency, amount)
3. Seasonal care modifications for the current ${context.seasonalContext.currentSeason} period
4. General maintenance tasks (pruning, cleaning, repotting if needed)
5. Preventive care to avoid common issues for this plant type
6. Optimal timing for all care activities

Focus on creating an actionable care plan that the gardener can easily follow.`;
  }
}
