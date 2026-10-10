/**
 * Grow Photo Analysis Service
 *
 * AI-powered visual analysis of cannabis plant photos
 * Detects nutrient deficiencies, pests, diseases, and environmental stress
 * using vision-capable AI models (Claude Vision API)
 */

import { BaseAIService } from '../core/BaseAIService';
import { GrowPhotoContextBuilder } from './GrowPhotoContextBuilder';
import { GrowPhotoPromptBuilder } from './GrowPhotoPromptBuilder';
import {
  PhotoAnalysisResult,
  PhotoAnalysisPayload,
  GrowPhotoContext,
  HealthStatus,
  IssueSeverity,
  IssueType,
} from './types';
import { messageBus, MessageBusEvent } from '../../messageBus';
import { logAI } from '../../logging/logger';

/**
 * Feature flag for enabling/disabling AI calls
 * When false, returns mock responses for testing
 */
const ENABLE_AI_CALLS = process.env.ENABLE_AI === 'true';

export class GrowPhotoAnalysisService extends BaseAIService {
  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
      maxRetries: 3,
    });
  }

  /**
   * Execute photo analysis from queue worker
   * Implements the uniform execute() interface required by BaseAIService
   *
   * @param payload - Photo analysis job payload from queue
   * @returns Photo analysis result with detected issues
   */
  async execute(payload: PhotoAnalysisPayload): Promise<PhotoAnalysisResult> {
    const correlationId = `photo-analysis-${payload.photoId}-${Date.now()}`;

    try {
      logAI.info('Executing photo analysis', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        photoId: payload.photoId,
        logId: payload.logId,
        userId: payload.userId,
        aiTaskId: payload.aiTaskId,
        triggeredBy: payload.triggeredBy,
      });

      // Perform analysis
      const result = await this.analyzePhoto(payload.photoId, payload.userId);

      // Publish completion event
      await this.publishCompletionEvent(result, payload);

      logAI.info('Photo analysis completed successfully', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        photoId: payload.photoId,
        overallHealth: result.overallHealth,
        issueCount: result.issues.length,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logAI.error('Photo analysis execution failed', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        photoId: payload.photoId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Analyze a cannabis plant photo for health issues
   *
   * @param photoId - ID of the photo to analyze
   * @param userId - ID of the user requesting analysis (for ownership verification)
   * @returns Analysis result with detected issues and remediation steps
   */
  async analyzePhoto(photoId: string, userId: string): Promise<PhotoAnalysisResult> {
    const correlationId = `photo-analysis-${photoId}-${Date.now()}`;

    try {
      logAI.info('Starting photo analysis', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        photoId,
        userId,
        aiEnabled: this.config.enableAICalls,
      });

      // Step 1: Build context (gather data)
      const context = await GrowPhotoContextBuilder.build(photoId, userId);

      logAI.debug('Context built successfully', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        photoId,
        hasImage: !!context.imageBase64,
        imageSize: context.imageBase64?.length || 0,
        phase: context.grow?.phase,
        daysInPhase: context.grow?.daysInPhase,
      });

      // Step 2: Build prompts
      const { systemPrompt, userPrompt } = GrowPhotoPromptBuilder.build(context);

      logAI.debug('Prompts built successfully', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
      });

      // Step 3: Call vision AI or return mock response
      let aiResponse: any;

      if (this.config.enableAICalls) {
        logAI.info('Calling vision AI', {
          service: 'GrowPhotoAnalysisService',
          correlationId,
          imageSize: context.imageBase64.length,
          mimeType: context.mimeType,
        });

        aiResponse = await this.callVisionAI(
          systemPrompt,
          userPrompt,
          [{ base64: context.imageBase64, mimeType: context.mimeType }],
          userId
        );
      } else {
        logAI.info('AI calls disabled, using mock response', {
          service: 'GrowPhotoAnalysisService',
          correlationId,
        });

        aiResponse = null;
      }

      // Step 4: Parse response or use mock
      const result = aiResponse
        ? this.parseAIResponse(aiResponse, context)
        : this.createMockResponse(context);

      logAI.info('Photo analysis completed', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        photoId,
        overallHealth: result.overallHealth,
        issueCount: result.issues.length,
        confidence: result.confidence,
        usedMock: !aiResponse,
      });

      return result;
    } catch (error) {
      logAI.error('Photo analysis failed', {
        service: 'GrowPhotoAnalysisService',
        correlationId,
        photoId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Parse AI response into PhotoAnalysisResult format
   */
  protected parseAIResponse(aiResponse: any, context?: any): PhotoAnalysisResult {
    return {
      analyzedAt: new Date(),
      context: context || {},
      overallHealth: aiResponse.overallHealth || HealthStatus.GOOD,
      issues: aiResponse.issues || [],
      generalObservations: aiResponse.generalObservations || [],
      confidence: aiResponse.confidence || 75,
      summary: aiResponse.summary || 'Analysis completed',
      suggestions: [], // Not used in photo analysis but required by BaseAnalysisResponse
      overallScore: this.healthStatusToScore(aiResponse.overallHealth || HealthStatus.GOOD),
    };
  }

  /**
   * Create realistic mock response for testing
   * Simulates AI response with common cannabis deficiency patterns
   */
  private createMockResponse(context: GrowPhotoContext): PhotoAnalysisResult {
    logAI.debug('Creating mock photo analysis response', {
      service: 'GrowPhotoAnalysisService',
      photoId: context.photoId,
      phase: context.grow?.phase,
    });

    // Mock response simulates nitrogen deficiency (common in veg phase)
    return {
      analyzedAt: new Date(),
      context: context,
      overallHealth: HealthStatus.FAIR,
      issues: [
        {
          type: IssueType.NITROGEN_DEFICIENCY,
          severity: IssueSeverity.MODERATE,
          confidence: 75,
          description:
            'Lower leaves showing yellowing (chlorosis) consistent with nitrogen deficiency. ' +
            'Yellowing starts at leaf tips and progresses inward. Upper leaves still appear healthy green.',
          affectedArea: 'Lower 2-3 fan leaves',
          remediation: [
            'Increase nitrogen in nutrient solution (NPK ratio should favor N in veg)',
            'Check pH level - nitrogen absorption optimal at pH 6.0-6.5 in soil, 5.5-6.0 in hydro',
            'Flush with pH-balanced water if salt buildup suspected, then resume feeding',
            'Monitor progression - yellowing should stop spreading within 3-5 days of correction',
          ],
        },
      ],
      generalObservations: [
        'Plant structure appears healthy with good internode spacing',
        'New growth at top shows vigorous development',
        'Overall plant color is good except for affected lower leaves',
      ],
      confidence: 75,
      summary:
        'Plant shows moderate nitrogen deficiency affecting lower leaves. ' +
        'Otherwise healthy structure and vigor. Address nitrogen levels and monitor pH.',
      suggestions: [], // Not used in photo analysis
      overallScore: 65, // Fair health = 65/100
    };
  }

  /**
   * Publish completion event to MessageBus
   * Notifies WebSocket clients that photo analysis is complete
   */
  protected async publishCompletionEvent(
    result: PhotoAnalysisResult,
    payload: PhotoAnalysisPayload
  ): Promise<void> {
    try {
      messageBus.publish(MessageBusEvent.GROW_PHOTO_ANALYSIS_COMPLETED, {
        photoId: payload.photoId,
        logId: payload.logId,
        userId: payload.userId,
        aiTaskId: payload.aiTaskId,
        overallHealth: result.overallHealth,
        issueCount: result.issues.length,
        confidence: result.confidence,
        timestamp: new Date(),
      });

      logAI.debug('Published photo analysis completion event', {
        service: 'GrowPhotoAnalysisService',
        photoId: payload.photoId,
        event: MessageBusEvent.GROW_PHOTO_ANALYSIS_COMPLETED,
      });
    } catch (error) {
      logAI.error('Failed to publish photo analysis completion event', {
        service: 'GrowPhotoAnalysisService',
        photoId: payload.photoId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - event publishing failures shouldn't break analysis
    }
  }

  /**
   * Convert health status to numeric score (0-100)
   */
  private healthStatusToScore(health: HealthStatus): number {
    const scores: Record<HealthStatus, number> = {
      [HealthStatus.EXCELLENT]: 95,
      [HealthStatus.GOOD]: 80,
      [HealthStatus.FAIR]: 65,
      [HealthStatus.POOR]: 40,
      [HealthStatus.CRITICAL]: 20,
    };

    return scores[health] || 50;
  }
}
