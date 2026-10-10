/**
 * Grow Nutrient Recommendation Service
 *
 * Main service for generating AI-powered nutrient recommendations for cannabis grows.
 * Provides personalized feeding schedules based on strain, phase, grow method, and goals.
 *
 * Usage Example:
 * ```typescript
 * const service = new GrowNutrientRecommendationService();
 * const recommendation = await service.execute({
 *   growId: 'grow-uuid',
 *   userId: 'user-uuid',
 *   type: 'full_schedule',
 *   goal: 'balanced'
 * });
 * ```
 */

import { BaseAIService, PromptLogger } from '../../core';
import { GrowContextBuilder } from '../GrowContextBuilder';
import { GrowNutrientPromptBuilder } from './GrowNutrientPromptBuilder';
import {
  NutrientRecommendation,
  NutrientRecommendationPayload,
  RecommendationType,
  OptimizationGoal,
  NutrientScheduleItem,
  NutrientScheduleNutrient,
} from './types';
import { GrowContext } from '../types';
import { MessageBusEvent } from '../../../messageBus';
import { logAI } from '../../../logging/logger';

/**
 * Feature flag - Controlled via ENABLE_AI environment variable
 * Set ENABLE_AI=true in .env to enable AI API calls
 */
const ENABLE_AI_CALLS = process.env.ENABLE_AI === 'true';

export class GrowNutrientRecommendationService extends BaseAIService {
  private contextBuilder: GrowContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new GrowContextBuilder();
  }

  /**
   * Execute nutrient recommendation with automatic event publishing
   *
   * This is the main entry point called by the worker.
   * Generates recommendations and publishes completion event via WebSocket.
   *
   * @param payload - Nutrient recommendation payload with growId, userId, type, goal, deficiency
   * @returns Recommendation with summary, schedule, tips, and warnings
   */
  async execute(
    payload: NutrientRecommendationPayload
  ): Promise<NutrientRecommendation> {
    const {
      growId,
      userId,
      type = 'full_schedule',
      goal = 'balanced',
      deficiency,
      aiTaskId,
    } = payload;

    logAI.info('Executing nutrient recommendation', {
      growId,
      userId,
      type,
      goal,
      deficiency,
      aiTaskId,
    });

    try {
      // Step 1: Generate recommendation
      const result = await this.generateRecommendation(
        growId,
        userId,
        type,
        goal,
        deficiency
      );

      // Step 2: Publish completion event (WebSocket notification)
      await this.publishCompletionEvent(result, { growId, userId, aiTaskId });

      logAI.info('Nutrient recommendation completed', {
        growId,
        userId,
        type,
        scheduleWeeks: result.totalWeeks,
        tipsCount: result.additionalTips.length,
        warningsCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      logAI.error('Nutrient recommendation failed', {
        growId,
        userId,
        type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Generate nutrient recommendation using AI or mock data
   *
   * This method performs the core recommendation logic:
   * 1. Build context from grow data
   * 2. Build prompts with cannabis-specific knowledge
   * 3. Call AI provider or generate mock response
   * 4. Parse and validate response
   */
  async generateRecommendation(
    growId: string,
    userId: string,
    type: RecommendationType,
    goal?: OptimizationGoal,
    deficiency?: string
  ): Promise<NutrientRecommendation> {
    try {
      logAI.debug('Starting nutrient recommendation generation', {
        growId,
        userId,
        type,
        goal,
        deficiency,
      });

      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(growId, userId);

      // Step 2: Build AI prompts
      const prompts = GrowNutrientPromptBuilder.build(context, type, {
        goal,
        deficiency,
      });

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(
          prompts,
          context,
          `NUTRIENT RECOMMENDATION (${type}${goal ? ` - ${goal}` : ''})`
        );
      }

      // Step 4: Get AI recommendation or mock response
      let recommendation: Omit<
        NutrientRecommendation,
        'growId' | 'userId' | 'recommendationType' | 'optimizationGoal' | 'deficiencyType' | 'analyzedAt' | 'context'
      >;

      if (this.config.enableAICalls) {
        const aiResult = await this.callAI(
          prompts.systemPrompt,
          prompts.userPrompt,
          userId
        );

        logAI.debug('AI response received', {
          growId,
          userId,
          responseLength: JSON.stringify(aiResult).length,
          responseKeys: aiResult ? Object.keys(aiResult) : [],
          hasSchedule: Array.isArray(aiResult?.schedule),
          scheduleLength: Array.isArray(aiResult?.schedule)
            ? aiResult.schedule.length
            : 0,
        });

        recommendation = {
          summary: aiResult.summary || 'No summary provided',
          schedule: aiResult.schedule || [],
          additionalTips: aiResult.additionalTips || [],
          warnings: aiResult.warnings || [],
          totalWeeks: aiResult.totalWeeks || aiResult.schedule?.length || 0,
          suggestions: aiResult.suggestions || [],
          overallScore: aiResult.overallScore || 0,
        };
      } else {
        const mockResponse = this.createMockResponse(context, type, goal);
        recommendation = mockResponse;

        PromptLogger.logAIDisabled();

        // Log mock response preview if logging is enabled
        if (this.config.logPrompts) {
          PromptLogger.logMockResponse(mockResponse);
        }
      }

      return {
        growId,
        userId,
        recommendationType: type,
        optimizationGoal: goal,
        deficiencyType: deficiency,
        analyzedAt: new Date(),
        context,
        ...recommendation,
      };
    } catch (error) {
      logAI.error('Nutrient recommendation generation failed', {
        growId,
        userId,
        type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Publish nutrient recommendation completion event to message bus
   * This allows WebSocket service and other subscribers to react to completed recommendations
   */
  protected async publishCompletionEvent(
    result: NutrientRecommendation,
    payload: any
  ): Promise<void> {
    const { growId, userId, aiTaskId } = payload;

    try {
      this.messageBus.publish(
        MessageBusEvent.GROW_NUTRIENT_RECOMMENDATION_COMPLETED,
        {
          growId,
          userId,
          taskId: aiTaskId,
          recommendationType: result.recommendationType,
          totalWeeks: result.totalWeeks,
          recommendation: result, // Include full recommendation for immediate display
          timestamp: new Date(),
        }
      );

      logAI.info('Nutrient recommendation completion event published', {
        growId,
        userId,
        taskId: aiTaskId,
        event: MessageBusEvent.GROW_NUTRIENT_RECOMMENDATION_COMPLETED,
      });
    } catch (error) {
      logAI.error('Failed to publish completion event', {
        growId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - event publishing failures shouldn't break the recommendation
    }
  }

  /**
   * Create mock response for testing without AI calls
   */
  public createMockResponse(
    context: GrowContext,
    type: RecommendationType,
    goal?: OptimizationGoal
  ): Omit<
    NutrientRecommendation,
    'growId' | 'userId' | 'recommendationType' | 'optimizationGoal' | 'deficiencyType' | 'analyzedAt' | 'context'
  > {
    const growMethod = context.grow.growMethod || 'soil';
    const phase = context.grow.phase;
    const isHydro = growMethod === 'hydro' || growMethod === 'dwc' || growMethod === 'coco';

    // Generate mock schedule based on phase
    const schedule: NutrientScheduleItem[] = [];

    // Helper to create water parameters
    const createWaterParams = (
      phaseType: string,
      weekInPhase: number
    ) => {
      const phMin = isHydro ? 5.5 : 6.0;
      const phMax = isHydro ? 6.5 : 7.0;

      let ecMin: number, ecMax: number, ppmMin: number, ppmMax: number;

      if (phaseType === 'vegetative') {
        ecMin = 0.8 + weekInPhase * 0.1;
        ecMax = 1.2 + weekInPhase * 0.1;
      } else if (phaseType === 'flowering') {
        ecMin = 1.2 + weekInPhase * 0.1;
        ecMax = 1.8 + weekInPhase * 0.1;
      } else {
        ecMin = 0.2;
        ecMax = 0.4;
      }

      ppmMin = Math.round(ecMin * 500);
      ppmMax = Math.round(ecMax * 500);

      return { phMin, phMax, ecMin, ecMax, ppmMin, ppmMax };
    };

    // Generate schedule based on current phase
    if (phase === 'vegetative' || phase === 'germination') {
      // Veg weeks
      for (let week = 1; week <= 6; week++) {
        const nutrients: NutrientScheduleNutrient[] = [
          {
            productName: 'Generic Veg Nutrient A',
            brand: 'Generic Nutrients',
            npkRatio: '3-1-2',
            type: 'base',
            dosageMlPerGallon: 5 + week * 0.5,
            frequency: 'Every watering',
            notes: 'Base nutrient for vegetative growth',
          },
          {
            productName: 'Generic Veg Nutrient B',
            brand: 'Generic Nutrients',
            npkRatio: '2-1-3',
            type: 'base',
            dosageMlPerGallon: 5 + week * 0.5,
            frequency: 'Every watering',
          },
        ];

        if (isHydro) {
          nutrients.push({
            productName: 'Cal-Mag Plus',
            type: 'supplement',
            dosageMlPerGallon: 3,
            frequency: 'Every watering',
            notes: 'Essential for coco/hydro grows',
          });
        }

        schedule.push({
          phase: 'vegetative',
          weekNumber: week,
          weekLabel: `Veg Week ${week}`,
          nutrients,
          waterParameters: createWaterParams('vegetative', week),
          notes: week === 1 ? 'Start with lower dosages and increase gradually' : undefined,
        });
      }

      // Add flowering weeks
      for (let week = 1; week <= 8; week++) {
        const nutrients: NutrientScheduleNutrient[] = [
          {
            productName: 'Generic Bloom Nutrient A',
            brand: 'Generic Nutrients',
            npkRatio: '1-3-2',
            type: 'base',
            dosageMlPerGallon: 6 + week * 0.3,
            frequency: 'Every watering',
            notes: 'Base nutrient for flowering',
          },
          {
            productName: 'Generic Bloom Nutrient B',
            brand: 'Generic Nutrients',
            npkRatio: '0-3-3',
            type: 'base',
            dosageMlPerGallon: 6 + week * 0.3,
            frequency: 'Every watering',
          },
        ];

        if (week >= 3) {
          nutrients.push({
            productName: 'Bloom Booster (PK 13-14)',
            type: 'supplement',
            dosageMlPerGallon: 2,
            frequency: '2x per week',
            notes: 'Increase bud density and weight',
          });
        }

        schedule.push({
          phase: 'flowering',
          weekNumber: week,
          weekLabel: `Flower Week ${week}`,
          nutrients,
          waterParameters: createWaterParams('flowering', week),
          notes:
            week === 1
              ? 'Transition week - gradually reduce nitrogen'
              : week === 7
                ? 'Begin monitoring trichomes for harvest timing'
                : undefined,
        });
      }

      // Flush week
      schedule.push({
        phase: 'harvest',
        weekNumber: 1,
        weekLabel: 'Flush Week',
        nutrients: [],
        waterParameters: {
          phMin: isHydro ? 5.5 : 6.0,
          phMax: isHydro ? 6.5 : 7.0,
          ecMin: 0,
          ecMax: 0.2,
          ppmMin: 0,
          ppmMax: 100,
        },
        notes: 'Plain pH-adjusted water only. Improves taste and smoothness.',
      });
    } else if (phase === 'flowering') {
      // Currently in flower, generate remaining flower schedule
      const weeksInFlower = Math.floor(context.metrics.daysInPhase / 7);

      for (let week = weeksInFlower + 1; week <= 8; week++) {
        const nutrients: NutrientScheduleNutrient[] = [
          {
            productName: 'Generic Bloom Nutrient A',
            brand: 'Generic Nutrients',
            npkRatio: '1-3-2',
            type: 'base',
            dosageMlPerGallon: 6 + week * 0.3,
            frequency: 'Every watering',
          },
          {
            productName: 'Generic Bloom Nutrient B',
            brand: 'Generic Nutrients',
            npkRatio: '0-3-3',
            type: 'base',
            dosageMlPerGallon: 6 + week * 0.3,
            frequency: 'Every watering',
          },
        ];

        if (week >= 3) {
          nutrients.push({
            productName: 'Bloom Booster (PK 13-14)',
            type: 'supplement',
            dosageMlPerGallon: 2,
            frequency: '2x per week',
          });
        }

        schedule.push({
          phase: 'flowering',
          weekNumber: week,
          weekLabel: `Flower Week ${week}`,
          nutrients,
          waterParameters: createWaterParams('flowering', week),
        });
      }

      // Flush
      schedule.push({
        phase: 'harvest',
        weekNumber: 1,
        weekLabel: 'Flush Week',
        nutrients: [],
        waterParameters: {
          phMin: isHydro ? 5.5 : 6.0,
          phMax: isHydro ? 6.5 : 7.0,
          ecMin: 0,
          ecMax: 0.2,
          ppmMin: 0,
          ppmMax: 100,
        },
        notes: 'Plain pH-adjusted water only.',
      });
    }

    // Generate tips and warnings
    const additionalTips: string[] = [
      `For ${growMethod} growing, maintain pH between ${isHydro ? '5.5-6.5' : '6.0-7.0'} for optimal nutrient uptake`,
      'Always pH-adjust your water AFTER adding nutrients',
      'Start with lower dosages and increase gradually to avoid nutrient burn',
      'Monitor runoff EC/PPM to prevent salt buildup in the medium',
      'Keep detailed logs of feeding schedule and plant response',
    ];

    if (isHydro) {
      additionalTips.push(
        'Check pH daily in hydro systems - it can drift quickly',
        'Change reservoir weekly to prevent pathogens and nutrient imbalances'
      );
    }

    if (goal === 'yield') {
      additionalTips.push(
        'For maximum yield, maintain higher EC levels (upper end of ranges)',
        'Consider adding carbohydrate supplements in late flowering for weight'
      );
    } else if (goal === 'quality') {
      additionalTips.push(
        'For maximum quality, use moderate EC levels and longer flush (2 weeks)',
        'Focus on terpene-enhancing supplements in late flowering'
      );
    }

    const warnings: string[] = [
      'Overfeeding is more harmful than underfeeding - watch for nutrient burn (leaf tip browning)',
      'Always check pH first if you see deficiency symptoms - most deficiencies are pH lockout, not lack of nutrients',
      'Nutrient lockout occurs when pH is outside optimal range, even with nutrients present',
    ];

    if (type === 'deficiency_fix') {
      warnings.push(
        'Do not drastically increase nutrient levels without confirming pH is correct',
        'Allow 3-5 days to see improvement after fixing deficiency'
      );
    }

    const summaryText =
      type === 'full_schedule'
        ? `Mock full feeding schedule for ${context.grow.strainName} in ${phase} phase (${growMethod}). ${schedule.length} weeks total from current phase through harvest. ${goal === 'yield' ? 'Optimized for maximum yield with higher EC targets.' : goal === 'quality' ? 'Optimized for quality with moderate feeding and extended flush.' : 'Balanced approach for good yield and quality.'}`
        : type === 'phase_adjustment'
          ? `Mock phase adjustment recommendation for transition to ${phase === 'vegetative' ? 'flowering' : 'next phase'}. Adjust NPK ratios and EC levels gradually over 1-2 weeks.`
          : type === 'deficiency_fix'
            ? `Mock deficiency remediation plan. Verify pH is correct (${isHydro ? '5.5-6.5' : '6.0-7.0'}), then apply targeted nutrient supplement. Monitor for improvement over 3-5 days.`
            : `Mock optimization recommendation for ${goal || 'balanced'} results. Fine-tune EC levels and add supplements for enhanced ${goal === 'yield' ? 'yield' : goal === 'quality' ? 'quality' : 'overall performance'}.`;

    return {
      summary: `${summaryText} Enable AI calls (ENABLE_AI=true) for real personalized recommendations.`,
      schedule,
      additionalTips,
      warnings,
      totalWeeks: schedule.length,
      suggestions: [],
      overallScore: 85,
    };
  }
}
