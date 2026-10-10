/**
 * Plant Care Service
 *
 * Main service for analyzing individual plants and providing AI-powered care recommendations.
 * This is a slim orchestrator that delegates to specialized components.
 *
 * Usage Example:
 * ```typescript
 * const service = new PlantCareService();
 * const analysis = await service.analyze('plant-uuid', 'user-uuid');
 * ```
 */

import { BaseAIService, PromptLogger, Suggestion, PlantCarePayload } from '../core';
import { PlantCareContextBuilder } from './PlantCareContextBuilder';
import { PlantCarePromptBuilder} from './PlantCarePromptBuilder';
import { PlantCareResponse, PlantCareContext } from './types';
import { logAI } from '../../logging/logger';

/**
 * Feature flag - Set to true when ready to enable AI API calls
 */
const ENABLE_AI_CALLS = false;

export class PlantCareService extends BaseAIService {
  private contextBuilder: PlantCareContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new PlantCareContextBuilder();
  }

  /**
   * Execute plant care analysis
   * TODO: Add persistence logic when ready
   */
  async execute(payload: PlantCarePayload): Promise<PlantCareResponse> {
    const { plantId, userId } = payload;
    return await this.analyze(plantId, userId);
  }

  /**
   * Analyze a plant and provide AI-powered care recommendations
   */
  async analyze(plantId: string, userId: string): Promise<PlantCareResponse> {
    try {
      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(plantId, userId);

      // Step 2: Build AI prompts
      const prompts = PlantCarePromptBuilder.build(context);

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(prompts, context, 'PLANT CARE ANALYSIS');
      }

      // Step 4: Get AI analysis or mock response
      let suggestions: Suggestion[];
      let overallScore: number;
      let summary: string;

      if (this.config.enableAICalls) {
        const aiResult = await this.callAI(
          prompts.systemPrompt,
          prompts.userPrompt,
          userId
        );
        suggestions = aiResult.suggestions || [];
        overallScore = aiResult.overallScore || 0;
        summary = aiResult.summary || 'No summary available';
      } else {
        const mockResponse = this.createMockResponse(context);
        suggestions = mockResponse.suggestions;
        overallScore = mockResponse.overallScore;
        summary = mockResponse.summary;

        PromptLogger.logAIDisabled();

        // Log mock response preview if logging is enabled
        if (this.config.logPrompts) {
          PromptLogger.logMockResponse(mockResponse);
        }
      }

      return {
        plantId,
        analyzedAt: new Date(),
        context,
        suggestions,
        overallScore,
        summary,
      };
    } catch (error) {
      logAI.error('Plant care analysis failed', {
        plantId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Create mock response for testing without AI calls
   */
  private createMockResponse(context: PlantCareContext): {
    suggestions: Suggestion[];
    overallScore: number;
    summary: string;
  } {
    const suggestions: Suggestion[] = [];
    const issues = { critical: 0, warnings: 0, minor: 0 };

    // Mock watering recommendation based on days since last watered
    if (context.careHistory.daysSinceWatered !== null) {
      if (context.careHistory.daysSinceWatered > 7) {
        suggestions.push(
          this.createSuggestion(
            'warning',
            'watering',
            'Watering Overdue',
            `Your ${context.plant.name} hasn't been watered in ${context.careHistory.daysSinceWatered} days. Check the soil moisture and water thoroughly if the top inch feels dry.`,
            [context.plant.id],
            'high'
          )
        );
        issues.critical++;
      } else if (context.careHistory.daysSinceWatered > 4) {
        suggestions.push(
          this.createSuggestion(
            'improvement',
            'watering',
            'Check Watering Schedule',
            `It's been ${context.careHistory.daysSinceWatered} days since watering. Check soil moisture to determine if watering is needed.`,
            [context.plant.id],
            'medium'
          )
        );
        issues.warnings++;
      }
    }

    // Mock fertilizing recommendation
    if (
      context.careHistory.daysSinceFertilized === null ||
      context.careHistory.daysSinceFertilized > 30
    ) {
      const days = context.careHistory.daysSinceFertilized || 'many';
      suggestions.push(
        this.createSuggestion(
          'improvement',
          'fertilizing',
          'Fertilizer Recommendation',
          `It has been ${days} days since fertilizing. During the growing season, apply a balanced fertilizer to support healthy growth.`,
          [context.plant.id],
          'medium'
        )
      );
      issues.warnings++;
    }

    // Mock zone compatibility warning
    if (!context.environmental.zoneCompatible) {
      suggestions.push(
        this.createSuggestion(
          'warning',
          'zone_compatibility',
          'Zone Compatibility Concern',
          `${context.plant.name} may not be well-suited for your hardiness zone (${context.user.zone}). Recommended zone range is ${context.plant.zoneMin}-${context.plant.zoneMax}. Consider providing extra protection or growing indoors.`,
          [context.plant.id],
          'high'
        )
      );
      issues.critical++;
    }

    // Mock seasonal care tip
    const seasonalTips: Record<string, string> = {
      spring: 'Spring is a great time for growth. Increase watering frequency and start regular fertilizing.',
      summer: 'Monitor moisture levels closely during hot weather. Water early morning or evening to reduce evaporation.',
      fall: 'Prepare for dormancy by reducing fertilizer. Continue watering but adjust frequency as temperatures cool.',
      winter: 'Reduce watering and hold off on fertilizer during dormancy. Ensure adequate light if growing indoors.',
    };

    if (context.environmental.currentSeason !== 'unknown') {
      suggestions.push(
        this.createSuggestion(
          'optimization',
          'seasonal_care',
          `${context.environmental.currentSeason.charAt(0).toUpperCase() + context.environmental.currentSeason.slice(1)} Care Tips`,
          seasonalTips[context.environmental.currentSeason],
          [context.plant.id],
          'low'
        )
      );
    }

    const score = this.calculateScore(issues);

    const wateredInfo =
      context.careHistory.daysSinceWatered !== null
        ? `last watered ${context.careHistory.daysSinceWatered} days ago`
        : 'watering history not recorded';

    return {
      suggestions,
      overallScore: score,
      summary: `Mock analysis: ${context.plant.name} (${context.plant.type}) is ${context.environmental.zoneCompatible ? 'zone-compatible' : 'outside ideal zone'}, ${wateredInfo}. ${suggestions.length} care recommendations generated. This is test data - enable AI calls to get real analysis.`,
    };
  }
}
