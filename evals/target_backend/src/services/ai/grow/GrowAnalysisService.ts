/**
 * Grow Analysis Service
 *
 * Main service for analyzing cannabis grows and providing AI-powered recommendations.
 * This is a slim orchestrator that delegates to specialized components.
 *
 * Usage Example:
 * ```typescript
 * const service = new GrowAnalysisService();
 * const analysis = await service.execute({ growId: 'grow-uuid', userId: 'user-uuid' });
 * ```
 */

import {
  BaseAIService,
  PromptLogger,
  Suggestion,
} from '../core';
import { GrowContextBuilder } from './GrowContextBuilder';
import { GrowPromptBuilder } from './GrowPromptBuilder';
import {
  GrowAnalysisResponse,
  GrowContext,
  GrowAnalysisPayload,
  AnalysisType,
} from './types';
import { MessageBusEvent } from '../../messageBus';
import { logAI } from '../../logging/logger';

/**
 * Feature flag - Controlled via ENABLE_AI environment variable
 * Set ENABLE_AI=true in .env to enable AI API calls
 */
const ENABLE_AI_CALLS = process.env.ENABLE_AI === 'true';

export class GrowAnalysisService extends BaseAIService {
  private contextBuilder: GrowContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new GrowContextBuilder();
  }

  /**
   * Execute grow analysis with automatic persistence
   *
   * This is the main entry point called by the worker.
   * Performs analysis and persists results to database if aiTaskId is provided.
   *
   * @param payload - Grow analysis payload with growId, userId, type, and optional aiTaskId
   * @returns Analysis results with suggestions, score, and summary
   */
  async execute(payload: GrowAnalysisPayload): Promise<GrowAnalysisResponse> {
    const { growId, userId, type = 'general', aiTaskId } = payload;

    logAI.info('Executing grow analysis', { growId, userId, type, aiTaskId });

    // Step 1: Perform analysis
    const result = await this.analyzeGrow(growId, userId, type);

    // Step 2: Persist to database if running from worker (aiTaskId present)
    if (aiTaskId) {
      await this.persistAnalysis(growId, userId, result, aiTaskId);
    }

    // Step 3: Publish completion event
    await this.publishCompletionEvent(result, { growId, userId, aiTaskId });

    return result;
  }

  /**
   * Analyze a grow and provide AI-powered recommendations
   *
   * Note: This method only performs analysis, it does NOT persist results.
   * For analysis with persistence, use execute() instead.
   */
  async analyzeGrow(
    growId: string,
    userId: string,
    analysisType: AnalysisType = 'general'
  ): Promise<GrowAnalysisResponse> {
    try {
      logAI.debug('Starting grow analysis', { growId, userId, analysisType });

      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(growId, userId);

      // Step 2: Build AI prompts
      const prompts = GrowPromptBuilder.build(context, analysisType);

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(prompts, context, `GROW ANALYSIS (${analysisType})`);
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

        logAI.debug('AI response received', {
          growId,
          userId,
          responseLength: JSON.stringify(aiResult).length,
          responseType: typeof aiResult,
          responseKeys: aiResult ? Object.keys(aiResult) : [],
          suggestionsType: typeof aiResult?.suggestions,
          suggestionsIsArray: Array.isArray(aiResult?.suggestions),
        });

        suggestions = aiResult.suggestions || [];
        overallScore = aiResult.overallScore || 0;
        summary = aiResult.summary || 'No summary available';

        logAI.debug('Suggestions extracted', {
          growId,
          suggestionCount: suggestions.length,
          overallScore,
          summaryLength: summary?.length,
        });
      } else {
        const mockResponse = this.createMockResponse(context, analysisType);
        suggestions = mockResponse.suggestions;
        overallScore = mockResponse.overallScore;
        summary = mockResponse.summary;

        PromptLogger.logAIDisabled();

        // Log mock response preview if logging is enabled
        if (this.config.logPrompts) {
          PromptLogger.logMockResponse(mockResponse);
        }
      }

      logAI.info('Grow analysis completed', {
        growId,
        userId,
        analysisType,
        suggestionCount: suggestions.length,
        overallScore,
      });

      return {
        growId,
        userId,
        analysisType,
        analyzedAt: new Date(),
        context,
        suggestions,
        overallScore,
        summary,
      };
    } catch (error) {
      logAI.error('Grow analysis failed', {
        growId,
        userId,
        analysisType,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Publish grow analysis completion event to message bus
   * This allows WebSocket service and other subscribers to react to completed analysis
   */
  protected async publishCompletionEvent(
    result: GrowAnalysisResponse,
    payload: any
  ): Promise<void> {
    const { growId, userId, aiTaskId } = payload;

    try {
      this.messageBus.publish(MessageBusEvent.GROW_ANALYSIS_COMPLETED, {
        growId,
        userId,
        analysisId: aiTaskId,
        analysisType: result.analysisType,
        overallScore: result.overallScore,
        suggestionCount: result.suggestions.length,
        timestamp: new Date(),
      });

      logAI.info('Grow analysis completion event published', {
        growId,
        userId,
        analysisId: aiTaskId,
        event: MessageBusEvent.GROW_ANALYSIS_COMPLETED,
      });
    } catch (error) {
      logAI.error('Failed to publish completion event', {
        growId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - event publishing failures shouldn't break the analysis
    }
  }

  /**
   * Create mock response for testing without AI calls
   */
  private createMockResponse(
    context: GrowContext,
    analysisType: AnalysisType
  ): {
    suggestions: Suggestion[];
    overallScore: number;
    summary: string;
  } {
    const suggestions: Suggestion[] = [];

    // Environment-based mock suggestions
    if (context.environment.hasTrends) {
      // Temperature check
      if (context.environment.temperature.average !== null) {
        const avgTemp = context.environment.temperature.average;
        if (
          context.grow.phase === 'vegetative' &&
          (avgTemp < 70 || avgTemp > 85)
        ) {
          suggestions.push(
            this.createSuggestion(
              'warning',
              'environment',
              'Temperature Out of Optimal Range',
              `Average temperature is ${avgTemp.toFixed(1)}°F. Vegetative phase optimal range is 70-85°F. Consider adjusting climate control.`,
              [],
              'high'
            )
          );
        } else if (
          context.grow.phase === 'flowering' &&
          (avgTemp < 68 || avgTemp > 79)
        ) {
          suggestions.push(
            this.createSuggestion(
              'warning',
              'environment',
              'Temperature Adjustment for Flowering',
              `Average temperature is ${avgTemp.toFixed(1)}°F. Flowering phase optimal range is 68-79°F for best resin production.`,
              [],
              'medium'
            )
          );
        }
      }

      // Humidity check
      if (context.environment.humidity.average !== null) {
        const avgHumidity = context.environment.humidity.average;
        if (context.grow.phase === 'flowering' && avgHumidity > 50) {
          suggestions.push(
            this.createSuggestion(
              'warning',
              'environment',
              'High Humidity Risk in Flowering',
              `Average humidity is ${avgHumidity.toFixed(1)}%. Reduce to 40-50% in flowering to prevent mold and bud rot.`,
              [],
              'high'
            )
          );
        }
      }

      // VPD check
      if (context.environment.vpd.average !== null) {
        const avgVpd = context.environment.vpd.average;
        if (avgVpd < 0.8 || avgVpd > 1.5) {
          suggestions.push(
            this.createSuggestion(
              'optimization',
              'environment',
              'VPD Optimization Opportunity',
              `Current VPD average is ${avgVpd.toFixed(2)} kPa. Target 0.8-1.2 kPa in veg, 1.0-1.5 kPa in flower for optimal transpiration.`,
              [],
              'medium'
            )
          );
        }
      }

      // pH check
      if (context.environment.ph.average !== null) {
        const avgPh = context.environment.ph.average;
        const isHydro =
          context.grow.growMethod === 'hydro' ||
          context.grow.growMethod === 'dwc' ||
          context.grow.growMethod === 'coco';
        const optimalLow = isHydro ? 5.5 : 6.0;
        const optimalHigh = isHydro ? 6.0 : 6.5;

        if (avgPh < optimalLow || avgPh > optimalHigh) {
          suggestions.push(
            this.createSuggestion(
              'warning',
              'nutrients',
              'pH Out of Range',
              `Average pH is ${avgPh.toFixed(1)}. For ${context.grow.growMethod || 'your grow method'}, target ${optimalLow}-${optimalHigh} for optimal nutrient uptake.`,
              [],
              'high'
            )
          );
        }
      }
    } else {
      // No environment data
      suggestions.push(
        this.createSuggestion(
          'improvement',
          'environment',
          'Start Tracking Environmental Data',
          'No environmental data recorded. Tracking temperature, humidity, pH, and VPD is crucial for optimizing cannabis cultivation.',
          [],
          'high'
        )
      );
    }

    // Nutrient-based suggestions
    if (context.nutrients.length === 0) {
      if (context.grow.phase !== 'germination') {
        suggestions.push(
          this.createSuggestion(
            'improvement',
            'nutrients',
            'Configure Nutrient Schedule',
            'No nutrient schedule configured. Cannabis requires different NPK ratios for vegetative (high N) vs flowering (high P/K) phases.',
            [],
            'medium'
          )
        );
      }
    } else if (analysisType === 'nutrients') {
      suggestions.push(
        this.createSuggestion(
          'optimization',
          'nutrients',
          'Nutrient Schedule Review',
          `You have ${context.nutrients.length} nutrient(s) configured. Consider reviewing NPK ratios match current ${context.grow.phase} phase needs.`,
          [],
          'low'
        )
      );
    }

    // Growth progression
    if (context.metrics.growthRate !== null) {
      const growthRate = context.metrics.growthRate;
      if (growthRate < 0.1 && context.grow.phase === 'vegetative') {
        suggestions.push(
          this.createSuggestion(
            'warning',
            'environment',
            'Slow Growth Rate Detected',
            `Growth rate is ${growthRate.toFixed(2)} inches/day in vegetative phase. This may indicate stress or suboptimal conditions.`,
            [],
            'medium'
          )
        );
      }
    }

    // Phase-specific suggestions
    if (context.grow.phase === 'flowering' && analysisType === 'harvest_timing') {
      const daysInFlower = context.metrics.daysInPhase;
      const estimatedTotal =
        context.grow.strainType === 'indica'
          ? 60
          : context.grow.strainType === 'sativa'
            ? 84
            : 70; // hybrid default

      const daysRemaining = estimatedTotal - daysInFlower;
      suggestions.push(
        this.createSuggestion(
          'optimization',
          'harvest',
          'Harvest Window Estimate',
          `Day ${daysInFlower} of flowering. Based on ${context.grow.strainType || 'hybrid'} characteristics, approximately ${daysRemaining} days remaining. Start checking trichomes daily after day 45.`,
          [],
          'medium'
        )
      );
    }

    // Calculate score
    const hasEnvironment = context.environment.hasTrends ? 25 : 0;
    const hasNutrients = context.nutrients.length > 0 ? 25 : 0;
    const hasGoodPh =
      context.environment.ph.average !== null &&
      context.environment.ph.average >= 5.5 &&
      context.environment.ph.average <= 6.5
        ? 20
        : 0;
    const hasGoodVpd =
      context.environment.vpd.average !== null &&
      context.environment.vpd.average >= 0.8 &&
      context.environment.vpd.average <= 1.5
        ? 20
        : 0;
    const logsBonus = Math.min(context.logs.length * 2, 10);

    const score = hasEnvironment + hasNutrients + hasGoodPh + hasGoodVpd + logsBonus;

    return {
      suggestions,
      overallScore: score,
      summary: `Mock analysis (${analysisType}): ${context.grow.strainName} in ${context.grow.phase} phase, day ${context.metrics.daysInPhase}. ${context.logs.length} log entries, ${context.nutrients.length} nutrients configured. ${suggestions.length} recommendations generated. Enable AI calls for real analysis.`,
    };
  }

  /**
   * Persist grow analysis results to database
   *
   * Marks all previous analyses for this grow as not current,
   * then creates a new grow analysis record.
   *
   * @param growId - The grow ID
   * @param userId - The user ID
   * @param result - Analysis result to persist
   * @param aiTaskId - AI task ID for audit trail
   */
  private async persistAnalysis(
    growId: string,
    userId: string,
    result: GrowAnalysisResponse,
    aiTaskId: string
  ): Promise<void> {
    try {
      logAI.debug('Persisting analysis', {
        growId,
        userId,
        aiTaskId,
        suggestionsCount: result.suggestions?.length,
        suggestionsType: typeof result.suggestions,
        suggestionsIsArray: Array.isArray(result.suggestions),
        overallScore: result.overallScore,
        summaryLength: result.summary?.length,
      });

      // Import GrowAnalysis model dynamically to avoid circular dependency
      const { GrowAnalysis } = await import('../../../models/GrowAnalysis');

      // Mark all previous analyses for this grow as not current
      await GrowAnalysis.update(
        { is_current: false },
        {
          where: {
            grow_id: growId,
            is_current: true,
          },
        }
      );

      // Create new analysis record
      const analysis = await GrowAnalysis.create({
        grow_id: growId,
        user_id: userId,
        ai_task_id: aiTaskId,
        suggestions: result.suggestions || [],
        overall_score: result.overallScore || 0,
        summary: result.summary || 'No summary available',
        is_current: true,
        analyzed_at: result.analyzedAt,
      });

      logAI.info('Analysis persisted', {
        growId,
        userId,
        analysisId: analysis.id,
        aiTaskId,
      });
    } catch (error) {
      logAI.error('Failed to persist analysis', {
        growId,
        userId,
        aiTaskId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
