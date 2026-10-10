/**
 * Pest Diagnosis Service
 *
 * Main service for diagnosing plant pests and diseases using AI analysis.
 * This is a slim orchestrator that delegates to specialized components.
 *
 * Usage Example:
 * ```typescript
 * const service = new PestDiagnosisService();
 * const analysis = await service.analyze({
 *   plantId: 'plant-uuid',
 *   userId: 'user-uuid',
 *   symptoms: { description: 'Yellow spots on leaves', severity: 'moderate' }
 * });
 * ```
 */

import { BaseAIService, PromptLogger, Suggestion, PestDiagnosisPayload } from '../core';
import { PestDiagnosisContextBuilder } from './PestDiagnosisContextBuilder';
import { PestDiagnosisPromptBuilder } from './PestDiagnosisPromptBuilder';
import { PestDiagnosisResponse, PestDiagnosisContext } from './types';
import { logAI } from '../../logging/logger';

/**
 * Feature flag - Set to true when ready to enable AI API calls
 */
const ENABLE_AI_CALLS = false;

export class PestDiagnosisService extends BaseAIService {
  private contextBuilder: PestDiagnosisContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new PestDiagnosisContextBuilder();
  }

  /**
   * Execute pest diagnosis
   * TODO: Add persistence logic when ready
   */
  async execute(payload: PestDiagnosisPayload): Promise<PestDiagnosisResponse> {
    return await this.analyze(payload as any);
  }

  /**
   * Analyze plant symptoms and provide AI-powered pest/disease diagnosis
   */
  async analyze(payload: {
    plantId: string;
    userId: string;
    symptoms: {
      description: string;
      affectedParts?: string[];
      severity?: 'mild' | 'moderate' | 'severe';
      photoUrls?: string[];
    };
    recentChanges?: {
      newLocation?: boolean;
      wateringChange?: boolean;
      fertilizingChange?: boolean;
      otherChanges?: string;
    };
    recentWeather?: string;
  }): Promise<PestDiagnosisResponse> {
    try {
      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(payload);

      // Step 2: Build AI prompts
      const prompts = PestDiagnosisPromptBuilder.build(context);

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(prompts, context, 'PEST DIAGNOSIS ANALYSIS');
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
      logAI.error('Pest diagnosis analysis failed', {
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
  private createMockResponse(context: PestDiagnosisContext): {
    suggestions: Suggestion[];
    overallScore: number;
    summary: string;
  } {
    const suggestions: Suggestion[] = [];
    const issues = { critical: 0, warnings: 0, minor: 0 };

    // Determine priority based on severity
    const priority =
      context.symptoms.severity === 'severe'
        ? 'high'
        : context.symptoms.severity === 'moderate'
          ? 'medium'
          : 'low';

    if (context.symptoms.severity === 'severe') {
      issues.critical++;
    } else if (context.symptoms.severity === 'moderate') {
      issues.warnings++;
    } else {
      issues.minor++;
    }

    // Mock diagnosis based on affected parts
    const affectedParts = context.symptoms.affectedParts.join(', ');

    if (context.symptoms.affectedParts.includes('leaves')) {
      suggestions.push(
        this.createSuggestion(
          'warning',
          'pest_treatment',
          'Possible Pest Infestation Detected',
          `Symptoms on ${affectedParts} suggest a possible aphid or spider mite infestation. Inspect leaves closely for small insects or webbing. TREATMENT: Spray affected areas with insecticidal soap or neem oil. Apply every 5-7 days for 2-3 weeks. Remove heavily infested leaves. Monitor daily for changes.`,
          [context.plant.id],
          priority
        )
      );
    }

    if (
      context.symptoms.description.toLowerCase().includes('yellow') ||
      context.symptoms.description.toLowerCase().includes('wilting')
    ) {
      suggestions.push(
        this.createSuggestion(
          'improvement',
          'environmental_issue',
          'Check Watering and Drainage',
          'Yellowing or wilting can indicate overwatering, underwatering, or poor drainage. Check soil moisture - it should be moist but not soggy. Ensure pot has drainage holes. Adjust watering frequency based on soil dryness.',
          [context.plant.id],
          'medium'
        )
      );
    }

    // Mock prevention suggestion
    suggestions.push(
      this.createSuggestion(
        'optimization',
        'prevention',
        'Preventive Care Measures',
        'To prevent future pest issues: 1) Inspect plants weekly for early signs of problems, 2) Maintain good air circulation around plants, 3) Remove dead leaves promptly, 4) Quarantine new plants for 2 weeks, 5) Keep growing area clean. Consider introducing beneficial insects like ladybugs.',
        [context.plant.id],
        'low'
      )
    );

    // Mock monitoring suggestion
    suggestions.push(
      this.createSuggestion(
        'improvement',
        'monitoring',
        'Ongoing Monitoring Required',
        'Monitor plant closely over the next 2 weeks. Look for: spreading symptoms, new pest activity, or signs of improvement. Take photos weekly to track progress. If symptoms worsen or spread to other plants, consider consulting a local extension office or plant specialist.',
        [context.plant.id],
        'medium'
      )
    );

    const score = this.calculateScore(issues);

    return {
      suggestions,
      overallScore: score,
      summary: `Mock diagnosis: ${context.plant.name} showing ${context.symptoms.severity} symptoms on ${affectedParts}. Likely pest infestation or environmental stress. ${suggestions.length} treatment recommendations provided. This is test data - enable AI calls to get real diagnosis.`,
    };
  }
}
