/**
 * Garden Analysis Service
 *
 * Main service for analyzing garden layouts and providing AI-powered recommendations.
 * This is a slim orchestrator that delegates to specialized components.
 *
 * Usage Example:
 * ```typescript
 * const service = new GardenAnalysisService();
 * const analysis = await service.execute({ gardenId: 'garden-uuid', userId: 'user-uuid' });
 * ```
 */

import {
  BaseAIService,
  PromptLogger,
  Suggestion,
  GardenAnalysisPayload,
} from "../core";
import { GardenContextBuilder } from "./GardenContextBuilder";
import { GardenPromptBuilder } from "./GardenPromptBuilder";
import { GardenAnalysisResponse, GardenContext } from "./types";
import { MessageBusEvent } from "../../messageBus";
import { GardenAnalysis } from "../../../models/GardenAnalysis";
import { logAI } from "../../logging/logger";
/**
 * Feature flag - Controlled via ENABLE_AI environment variable
 * Set ENABLE_AI=true in .env to enable AI API calls
 */
const ENABLE_AI_CALLS = process.env.ENABLE_AI === "true";

export class GardenAnalysisService extends BaseAIService {
  private contextBuilder: GardenContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new GardenContextBuilder();
  }

  /**
   * Execute garden analysis with automatic persistence
   *
   * This is the main entry point called by the worker.
   * Performs analysis and persists results to database if aiTaskId is provided.
   *
   * @param payload - Garden analysis payload with gardenId, userId, and optional aiTaskId
   * @returns Analysis results with suggestions, score, and summary
   */
  async execute(
    payload: GardenAnalysisPayload
  ): Promise<GardenAnalysisResponse> {
    const { gardenId, userId, aiTaskId } = payload;

    // Step 1: Perform analysis
    const result = await this.analyzeGarden(gardenId, userId);

    // Step 2: Persist to database if running from worker (aiTaskId present)
    if (aiTaskId) {
      await this.persistAnalysis(gardenId, userId, result, aiTaskId);
    }

    return result;
  }

  /**
   * Analyze a garden and provide AI-powered recommendations
   *
   * Note: This method only performs analysis, it does NOT persist results.
   * For analysis with persistence, use execute() instead.
   */
  async analyzeGarden(
    gardenId: string,
    userId: string
  ): Promise<GardenAnalysisResponse> {
    try {
      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(gardenId, userId);

      // Step 2: Build AI prompts
      const prompts = GardenPromptBuilder.build(context);

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(prompts, context, "GARDEN ANALYSIS");
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
          gardenId,
          userId,
          responseLength: JSON.stringify(aiResult).length,
          responseType: typeof aiResult,
          responseKeys: aiResult ? Object.keys(aiResult) : [],
          suggestionsType: typeof aiResult?.suggestions,
          suggestionsIsArray: Array.isArray(aiResult?.suggestions)
        });

        suggestions = aiResult.suggestions || [];
        overallScore = aiResult.overallScore || 0;
        summary = aiResult.summary || "No summary available";

        logAI.debug('Suggestions extracted', {
          gardenId,
          suggestionCount: suggestions.length,
          overallScore,
          summaryLength: summary?.length
        });
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
        gardenId,
        analyzedAt: new Date(),
        context,
        suggestions,
        overallScore,
        summary,
      };
    } catch (error) {
      logAI.error('Garden analysis failed', {
        gardenId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Publish garden analysis completion event to message bus
   * This allows WebSocket service and other subscribers to react to completed analysis
   */
  protected async publishCompletionEvent(
    result: any,
    payload: any
  ): Promise<void> {
    const { gardenId, userId, analysisId } = payload;

    try {
      this.messageBus.publish(MessageBusEvent.GARDEN_ANALYSIS_COMPLETED, {
        gardenId,
        userId,
        analysisId,
        overallScore: result.overallScore,
        suggestionCount: result.suggestions.length,
        timestamp: new Date(),
      });

      logAI.info('Garden analysis completion event published', {
        gardenId,
        userId,
        analysisId,
        event: MessageBusEvent.GARDEN_ANALYSIS_COMPLETED
      });
    } catch (error) {
      logAI.error('Failed to publish completion event', {
        gardenId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw - event publishing failures shouldn't break the analysis
    }
  }

  /**
   * Create mock response for testing without AI calls
   */
  private createMockResponse(context: GardenContext): {
    suggestions: Suggestion[];
    overallScore: number;
    summary: string;
  } {
    const suggestions: Suggestion[] = [];

    // Status-aware mock suggestions
    const plannedPlots = context.plots.filter((p) => p.status === "planned");
    const plantedPlots = context.plots.filter((p) => p.status === "planted");
    const harvestedPlots = context.plots.filter(
      (p) => p.status === "harvested"
    );

    // Mock suggestion for planned plots (easy to change)
    if (plannedPlots.length > 0) {
      suggestions.push(
        this.createSuggestion(
          "optimization",
          "layout",
          "Optimal Plant Selection for Planned Plots",
          `You have ${plannedPlots.length} plot(s) in planning stage. Consider companion planting strategies and optimal spacing before planting.`,
          plannedPlots.map((p) => p.id),
          "medium"
        )
      );
    }

    // Mock suggestion for planted plots (care-focused, avoid relocation)
    if (plantedPlots.length > 0) {
      suggestions.push(
        this.createSuggestion(
          "improvement",
          "care",
          "Care Optimization for Established Plants",
          `Your ${plantedPlots.length} planted plot(s) are established. Focus on care routines and avoid major layout changes.`,
          plantedPlots.map((p) => p.id),
          "medium"
        )
      );
    }

    // Mock suggestion for harvested plots (crop rotation)
    if (harvestedPlots.length > 0) {
      suggestions.push(
        this.createSuggestion(
          "optimization",
          "seasonal_timing",
          "Crop Rotation for Harvested Plots",
          `${harvestedPlots.length} plot(s) have been harvested. Consider crop rotation to maintain soil health.`,
          harvestedPlots.map((p) => p.id),
          "low"
        )
      );
    }

    // Original spacing optimization for backward compatibility
    // Generate when there are multiple plots (regardless of status)
    if (context.plots.length > 1) {
      suggestions.push(
        this.createSuggestion(
          "optimization",
          "spacing",
          "Spacing Optimization",
          "Consider optimizing plant spacing based on mature plant sizes and root systems.",
          context.plots.map((p) => p.id).slice(0, 3), // Limit to first 3 plots
          "low"
        )
      );
    }

    // Mock companion conflict warning
    if (context.metrics.companionConflicts > 0) {
      suggestions.push(
        this.createSuggestion(
          "warning",
          "companion_planting",
          "Harmful Companion Pairings Detected",
          `Found ${context.metrics.companionConflicts} harmful companion planting combinations in your garden. These plants may inhibit each other's growth.`,
          context.plots
            .filter((p) => p.plant !== null)
            .map((p) => p.id)
            .slice(0, 2),
          "high"
        )
      );
    }

    // Mock zone compatibility issue
    if (context.metrics.zoneCompatibilityIssues > 0) {
      suggestions.push(
        this.createSuggestion(
          "warning",
          "zone_compatibility",
          "Zone Compatibility Concerns",
          `${context.metrics.zoneCompatibilityIssues} plant(s) may not be well-suited for your hardiness zone.`,
          context.plots
            .filter((p) => p.plant !== null)
            .map((p) => p.id)
            .slice(0, context.metrics.zoneCompatibilityIssues),
          "medium"
        )
      );
    }

    const score = this.calculateScore({
      critical: context.metrics.companionConflicts,
      warnings: context.metrics.zoneCompatibilityIssues,
      minor: 0,
    });

    return {
      suggestions,
      overallScore: score,
      summary: `Mock analysis: Your garden has ${context.metrics.occupiedPlots} occupied plots with ${context.metrics.uniquePlants} unique plants. Status: ${context.metrics.plannedPlots} planned, ${context.metrics.plantedPlots} planted, ${context.metrics.harvestedPlots} harvested. ${suggestions.length} recommendations generated. This is test data - enable AI calls to get real analysis.`,
    };
  }

  /**
   * Persist garden analysis results to database
   *
   * Marks all previous analyses for this garden as not current,
   * then creates a new garden analysis record.
   *
   * @param gardenId - The garden ID
   * @param userId - The user ID
   * @param result - Analysis result to persist
   * @param aiTaskId - AI task ID for audit trail
   */
  private async persistAnalysis(
    gardenId: string,
    userId: string,
    result: GardenAnalysisResponse,
    aiTaskId: string
  ): Promise<void> {
    try {
      logAI.debug('Persisting analysis', {
        gardenId,
        userId,
        aiTaskId,
        suggestionsCount: result.suggestions?.length,
        suggestionsType: typeof result.suggestions,
        suggestionsIsArray: Array.isArray(result.suggestions),
        overallScore: result.overallScore,
        summaryLength: result.summary?.length
      });

      // Mark all previous analyses for this garden as not current
      await GardenAnalysis.update(
        { is_current: false },
        { where: { garden_id: gardenId, is_current: true } }
      );

      // Create new garden analysis record
      const analysis = await GardenAnalysis.create({
        garden_id: gardenId,
        user_id: userId,
        ai_task_id: aiTaskId,
        suggestions: result.suggestions || [],
        overall_score: result.overallScore || 0,
        summary: result.summary || "No summary available",
        is_current: true,
        analyzed_at: new Date(),
      });

      logAI.info('Analysis saved', {
        gardenId,
        userId,
        analysisId: analysis.id,
        aiTaskId,
        suggestionCount: result.suggestions?.length,
        overallScore: result.overallScore
      });

      // Verify what was saved
      const savedAnalysis = await GardenAnalysis.findByPk(analysis.id);
      logAI.debug('Verified saved data', {
        analysisId: analysis.id,
        suggestionsCount: savedAnalysis?.suggestions?.length,
        suggestionsType: typeof savedAnalysis?.suggestions,
        overallScore: savedAnalysis?.overall_score
      });
    } catch (error) {
      logAI.error('Failed to persist analysis', {
        gardenId,
        userId,
        aiTaskId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw - persistence failures shouldn't break the analysis
      // The analysis result will still be returned to the caller
    }
  }
}
