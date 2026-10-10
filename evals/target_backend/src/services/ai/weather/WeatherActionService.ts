/**
 * Weather Action Service
 *
 * Main service for analyzing weather forecasts and providing AI-powered protective recommendations.
 * This is a slim orchestrator that delegates to specialized components.
 *
 * Usage Example:
 * ```typescript
 * const service = new WeatherActionService();
 * const analysis = await service.analyze({ gardenId: 'garden-uuid', userId: 'user-uuid' });
 * ```
 */

import {
  BaseAIService,
  PromptLogger,
  Suggestion,
  WeatherActionPayload,
} from "../core";
import { WeatherActionContextBuilder } from "./WeatherActionContextBuilder";
import { WeatherActionPromptBuilder } from "./WeatherActionPromptBuilder";
import {
  WeatherActionResponse,
  WeatherActionContext,
  WeatherForecast,
} from "./types";
import { logAI } from "../../logging/logger";

/**
 * Feature flag - Set to true when ready to enable AI API calls
 */
const ENABLE_AI_CALLS = false;

export class WeatherActionService extends BaseAIService {
  private contextBuilder: WeatherActionContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new WeatherActionContextBuilder();
  }

  /**
   * Execute plant care analysis
   * TODO: Add persistence logic when ready
   */
  async execute(payload: WeatherActionPayload): Promise<WeatherActionResponse> {
    const { gardenId, userId } = payload;
    return await this.analyze({ gardenId, userId });
  }

  /**
   * Analyze weather forecast and provide AI-powered recommendations
   */
  async analyze(payload: {
    gardenId?: string;
    userId: string;
    weatherForecast?: WeatherForecast[];
    location?: string;
  }): Promise<WeatherActionResponse> {
    try {
      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(payload);

      // Step 2: Build AI prompts
      const prompts = WeatherActionPromptBuilder.build(context);

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(prompts, context, "WEATHER ACTION ANALYSIS");
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
        summary = aiResult.summary || "No summary available";
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
        gardenId: payload.gardenId,
        analyzedAt: new Date(),
        context,
        suggestions,
        overallScore,
        summary,
      };
    } catch (error) {
      logAI.error('Weather action analysis failed', {
        gardenId: payload.gardenId,
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
  private createMockResponse(context: WeatherActionContext): {
    suggestions: Suggestion[];
    overallScore: number;
    summary: string;
  } {
    const suggestions: Suggestion[] = [];
    const issues = { critical: 0, warnings: 0, minor: 0 };

    const affectedPlantIds = context.plants.map((p) => p.id);

    // Mock frost warning
    if (context.risks.frost) {
      suggestions.push(
        this.createSuggestion(
          "warning",
          "frost_protection",
          "Frost Protection Needed",
          "Freezing temperatures are forecast. Bring sensitive plants indoors or cover with frost blankets. Water plants before sunset to help retain heat. Focus on tender plants like tomatoes, peppers, and basil.",
          affectedPlantIds.slice(0, 3),
          "high"
        )
      );
      issues.critical++;
    }

    // Mock heat stress warning
    if (context.risks.heatStress) {
      suggestions.push(
        this.createSuggestion(
          "warning",
          "heat_management",
          "Heat Stress Prevention",
          "Extreme heat expected. Water deeply in early morning. Consider providing shade cloth for sensitive plants during peak afternoon heat. Mulch around plants to retain moisture.",
          affectedPlantIds,
          "high"
        )
      );
      issues.critical++;
    }

    // Mock drought recommendation
    if (context.risks.drought) {
      suggestions.push(
        this.createSuggestion(
          "improvement",
          "water_management",
          "Increase Watering Schedule",
          "Low precipitation forecast over the next week. Increase watering frequency and water deeply to encourage deep root growth. Check soil moisture daily.",
          affectedPlantIds,
          "medium"
        )
      );
      issues.warnings++;
    }

    // Mock excessive rain warning
    if (context.risks.excessiveRain) {
      suggestions.push(
        this.createSuggestion(
          "warning",
          "water_management",
          "Prepare for Heavy Rain",
          "Heavy rainfall expected. Ensure proper drainage to prevent waterlogging. Consider covering delicate plants. Check for standing water after storms.",
          affectedPlantIds,
          "medium"
        )
      );
      issues.warnings++;
    }

    // If no risks, provide general optimization tip
    if (
      !context.risks.frost &&
      !context.risks.heatStress &&
      !context.risks.drought &&
      !context.risks.excessiveRain
    ) {
      suggestions.push(
        this.createSuggestion(
          "optimization",
          "general_weather",
          "Favorable Weather Conditions",
          "Weather conditions look favorable for the next week. This is a good time for routine maintenance, fertilizing, and checking plant health. Maintain regular watering schedule.",
          affectedPlantIds,
          "low"
        )
      );
    }

    const score = this.calculateScore(issues);

    const risksText = [
      context.risks.frost && "frost",
      context.risks.heatStress && "heat",
      context.risks.drought && "drought",
      context.risks.excessiveRain && "heavy rain",
    ]
      .filter(Boolean)
      .join(", ");

    return {
      suggestions,
      overallScore: score,
      summary: `Mock analysis: ${context.plants.length} plant(s) analyzed for ${
        context.weather.location
      }. ${
        risksText
          ? `Weather risks: ${risksText}. `
          : "No immediate weather threats. "
      }${
        suggestions.length
      } recommendations generated. This is test data - enable AI calls to get real analysis.`,
    };
  }
}
