/**
 * Care Recommendation Service
 *
 * Main service for analyzing plants and providing AI-powered care schedule recommendations.
 * This is a slim orchestrator that delegates to specialized components.
 *
 * Usage Example:
 * ```typescript
 * const service = new CareRecommendationService();
 * const analysis = await service.analyze({ plantId: 'plant-uuid', userId: 'user-uuid' });
 * ```
 */

import { BaseAIService, PromptLogger, Suggestion, CareRecommendationPayload } from '../core';
import { CareRecommendationContextBuilder } from './CareRecommendationContextBuilder';
import { CareRecommendationPromptBuilder } from './CareRecommendationPromptBuilder';
import { CareRecommendationResponse, CareRecommendationContext } from './types';
import { logAI } from '../../logging/logger';

/**
 * Feature flag - Set to true when ready to enable AI API calls
 */
const ENABLE_AI_CALLS = false;

export class CareRecommendationService extends BaseAIService {
  private contextBuilder: CareRecommendationContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new CareRecommendationContextBuilder();
  }

  /**
   * Execute care recommendation analysis
   * TODO: Add persistence logic when ready
   */
  async execute(payload: CareRecommendationPayload): Promise<CareRecommendationResponse> {
    const { plantId, userId } = payload;
    return await this.analyze({ plantId, userId });
  }

  /**
   * Analyze a plant and provide AI-powered care recommendations
   */
  async analyze(payload: {
    plantId: string;
    userId: string;
    requestedType?: 'watering' | 'fertilizing' | 'pruning' | 'general';
    growthStage?: 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'dormant';
  }): Promise<CareRecommendationResponse> {
    try {
      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(payload);

      // Step 2: Build AI prompts
      const prompts = CareRecommendationPromptBuilder.build(context);

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(prompts, context, 'CARE RECOMMENDATION ANALYSIS');
      }

      // Step 4: Get AI analysis or mock response
      let suggestions: Suggestion[];
      let overallScore: number;
      let summary: string;

      if (this.config.enableAICalls) {
        const aiResult = await this.callAI(
          prompts.systemPrompt,
          prompts.userPrompt,
          payload.userId
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
        plantId: payload.plantId,
        analyzedAt: new Date(),
        context,
        suggestions,
        overallScore,
        summary,
      };
    } catch (error) {
      logAI.error('Care recommendation analysis failed', {
        plantId: payload.plantId,
        userId: payload.userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Create mock response for testing without AI calls
   */
  private createMockResponse(context: CareRecommendationContext): {
    suggestions: Suggestion[];
    overallScore: number;
    summary: string;
  } {
    const suggestions: Suggestion[] = [];
    const issues = { critical: 0, warnings: 0, minor: 0 };

    // Mock watering recommendation
    if (!context.recommendations.requestedType || context.recommendations.requestedType === 'watering') {
      const wateringAdvice = context.seasonalContext.isGrowingSeason
        ? `Water every ${context.plant.waterIntervalDays} days during the growing season. Check soil moisture before watering - the top inch should be dry. Water deeply at the base of the plant early in the morning.`
        : `Reduce watering frequency during dormancy. Water every ${context.plant.waterIntervalDays + 2} days, allowing soil to dry more between waterings.`;

      suggestions.push(
        this.createSuggestion(
          'improvement',
          'watering',
          'Watering Schedule Recommendation',
          wateringAdvice,
          [context.plant.id],
          'medium'
        )
      );
    }

    // Mock fertilizing recommendation
    if (!context.recommendations.requestedType || context.recommendations.requestedType === 'fertilizing') {
      if (context.seasonalContext.isGrowingSeason) {
        const fertInterval = context.plant.fertIntervalDays || 14;
        suggestions.push(
          this.createSuggestion(
            'improvement',
            'fertilizing',
            'Fertilization Schedule',
            `Apply a balanced fertilizer (10-10-10 NPK) every ${fertInterval} days during the growing season. Dilute to half strength and apply after watering to prevent root burn. This supports healthy growth and flowering.`,
            [context.plant.id],
            'medium'
          )
        );
      } else {
        suggestions.push(
          this.createSuggestion(
            'optimization',
            'seasonal_care',
            'Dormant Season Care',
            'Hold off on fertilizer during winter dormancy. Plants need fewer nutrients when not actively growing. Resume fertilizing in early spring when new growth appears.',
            [context.plant.id],
            'low'
          )
        );
      }
    }

    // Mock pruning recommendation
    if (!context.recommendations.requestedType || context.recommendations.requestedType === 'pruning') {
      const pruningTiming =
        context.seasonalContext.currentSeason === 'spring'
          ? 'Spring is an ideal time for pruning. Remove dead or damaged growth and shape the plant before the main growing season.'
          : context.seasonalContext.currentSeason === 'fall'
            ? 'Light pruning in fall can help prepare the plant for dormancy. Remove spent blooms and damaged leaves.'
            : 'Avoid heavy pruning during summer heat or winter dormancy. Light maintenance pruning only if needed.';

      suggestions.push(
        this.createSuggestion(
          'optimization',
          'pruning',
          'Pruning Guidance',
          pruningTiming,
          [context.plant.id],
          'low'
        )
      );
    }

    // Mock general maintenance
    suggestions.push(
      this.createSuggestion(
        'optimization',
        'general_maintenance',
        'Regular Plant Inspection',
        'Check your plant weekly for signs of pests, diseases, or nutrient deficiencies. Remove any dead leaves promptly. Rotate the plant periodically for even growth. Monitor soil drainage and adjust watering as needed.',
        [context.plant.id],
        'low'
      )
    );

    const score = this.calculateScore(issues);

    return {
      suggestions,
      overallScore: score,
      summary: `Mock analysis: ${context.plant.name} care plan generated for ${context.seasonalContext.currentSeason}. Current watering interval: ${context.plant.waterIntervalDays} days. ${suggestions.length} care recommendations provided. This is test data - enable AI calls to get real analysis.`,
    };
  }
}
