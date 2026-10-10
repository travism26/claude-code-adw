/**
 * AI Wrapper Service
 *
 * @deprecated This class is deprecated. Use the new provider architecture instead:
 *
 * ```typescript
 * import { aiProviderManager } from './ai/providers';
 *
 * const response = await aiProviderManager.chat({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 * ```
 *
 * The new architecture provides:
 * - Multiple provider support (Anthropic, OpenAI, OpenRouter)
 * - Automatic fallback when a provider fails
 * - Retry logic with exponential backoff
 * - Better error handling with typed errors
 *
 * For domain-specific AI services, extend BaseAIService which now uses
 * the provider manager internally.
 *
 * This file is kept for backwards compatibility during the transition period.
 *
 * ----
 *
 * ORIGINAL DESCRIPTION:
 * Internal-only service for AI model integration (Anthropic Claude and OpenAI)
 * Provides secure, validated AI inference for plant care recommendations
 *
 * IMPORTANT: This service is for internal use only. It should never be exposed
 * directly to users via HTTP endpoints to prevent prompt injection attacks.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AITask } from '../models/AITask';
import { aiConfig } from '../config/ai';
import { messageBus, MessageBusEvent } from './messageBus';
import mockResponses from '../mocks/ai-responses.json';
import { logAI } from './logging/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export type AIRequestType =
  | 'plant_update_suggestion'
  | 'weather_based_action'
  | 'care_recommendation'
  | 'pest_diagnosis'
  | 'garden_analysis'
  | 'general';

export type AITaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AIRequest {
  taskId: string;
  type: AIRequestType;
  payload: Record<string, any>;
  userId?: string;
  plantId?: string;
}

export interface AISuggestion {
  action: string;
  reason: string;
  confidence: number; // 0-1 scale
  additionalInfo?: Record<string, any>;
}

export interface AIResponse {
  taskId: string;
  status: AITaskStatus;
  suggestion?: AISuggestion;
  error?: string;
}

// ============================================================================
// AI Wrapper Service Class
// ============================================================================

export class AIWrapper {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    // Skip initialization if in mock mode
    if (aiConfig.mockMode) {
      logAI.info('AIWrapper running in mock mode', {
        provider: 'mock',
        skipApiInit: true
      });
      return;
    }

    // Initialize Anthropic client if API key is available
    if (aiConfig.anthropic.apiKey) {
      try {
        this.anthropic = new Anthropic({
          apiKey: aiConfig.anthropic.apiKey,
        });
        logAI.info('Provider initialized', {
          provider: 'anthropic',
          model: aiConfig.anthropic.defaultModel
        });
      } catch (error) {
        logAI.error('Failed to initialize provider', {
          provider: 'anthropic',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    // Initialize OpenAI client if API key is available
    if (aiConfig.openai.apiKey) {
      try {
        this.openai = new OpenAI({
          apiKey: aiConfig.openai.apiKey,
        });
        logAI.info('Provider initialized', {
          provider: 'openai',
          model: aiConfig.openai.defaultModel
        });
      } catch (error) {
        logAI.error('Failed to initialize provider', {
          provider: 'openai',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    // Ensure at least one client is available
    if (!this.anthropic && !this.openai) {
      logAI.warn('No AI providers available', {
        message: 'Please configure ANTHROPIC_API_KEY or OPENAI_API_KEY',
        availableProviders: []
      });
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Make an AI request and return the response
   * This is the main entry point for the AI service
   *
   * @param request - AI request with taskId, type, and payload
   * @returns AI response with suggestion or error
   */
  public async makeRequest(request: AIRequest): Promise<AIResponse> {
    try {
      // Step 1: Validate request
      this.validate(request);

      // Step 2: Create or update task record with 'processing' status
      await this.updateTaskStatus(request, 'processing');

      // Step 3: Call AI API (or use mock if in mock mode)
      let aiResult: any;
      let modelUsed: string;

      if (aiConfig.mockMode) {
        // Use mock response
        aiResult = this.generateMockResponse(request);
        modelUsed = 'mock-ai-service';
        logAI.debug('Mock response generated', {
          taskId: request.taskId,
          taskType: request.type
        });
      } else {
        // Real AI API calls
        try {
          if (this.anthropic && aiConfig.defaultProvider === 'anthropic') {
            aiResult = await this.callClaudeAPI(request);
            modelUsed = aiConfig.anthropic.defaultModel;
          } else if (this.openai) {
            aiResult = await this.callOpenAIAPI(request);
            modelUsed = aiConfig.openai.defaultModel;
          } else {
            throw new Error('No AI provider available');
          }
        } catch (primaryError) {
          // Fallback to alternative provider
          logAI.warn('Primary provider unavailable, trying fallback', {
            taskId: request.taskId,
            primaryProvider: aiConfig.defaultProvider,
            error: primaryError instanceof Error ? primaryError.message : String(primaryError)
          });
          if (this.openai && aiConfig.defaultProvider === 'anthropic') {
            aiResult = await this.callOpenAIAPI(request);
            modelUsed = aiConfig.openai.defaultModel;
          } else if (this.anthropic && aiConfig.defaultProvider === 'openai') {
            aiResult = await this.callClaudeAPI(request);
            modelUsed = aiConfig.anthropic.defaultModel;
          } else {
            throw primaryError;
          }
        }
      }

      // Step 4: Sanitize response
      const suggestion = this.sanitize(aiResult);

      // Step 5: Store result in database
      await this.storeResult(request.taskId, request, suggestion, modelUsed);

      return {
        taskId: request.taskId,
        status: 'completed',
        suggestion,
      };
    } catch (error: any) {
      // Handle errors and update task status
      logAI.error('AI request failed', {
        taskId: request.taskId,
        taskType: request.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      await this.updateTaskStatus(request, 'failed', error.message);

      return {
        taskId: request.taskId,
        status: 'failed',
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  // ==========================================================================
  // Private Methods - Validation
  // ==========================================================================

  private validate(request: AIRequest): void {
    // Check required fields
    if (!request.taskId) {
      throw new Error('taskId is required');
    }
    if (!request.type) {
      throw new Error('type is required');
    }
    if (!request.payload || typeof request.payload !== 'object') {
      throw new Error('payload is required and must be an object');
    }

    // Validate task type
    const validTypes: AIRequestType[] = [
      'plant_update_suggestion',
      'weather_based_action',
      'care_recommendation',
      'pest_diagnosis',
      'garden_analysis',
      'general',
    ];
    if (!validTypes.includes(request.type)) {
      throw new Error(
        `Invalid task type. Must be one of: ${validTypes.join(', ')}`
      );
    }
  }

  // ==========================================================================
  // Private Methods - AI API Integration
  // ==========================================================================

  /**
   * Call Anthropic Claude API
   */
  private async callClaudeAPI(request: AIRequest): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const { systemPrompt, userPrompt } = this.buildPrompts(request);

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < aiConfig.retryAttempts; attempt++) {
      try {
        const response = await this.anthropic.messages.create({
          model: aiConfig.anthropic.defaultModel,
          max_tokens: aiConfig.maxTokens,
          temperature: aiConfig.temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        // Extract text from response
        const textContent = response.content.find((block) => block.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Claude response');
        }

        return this.parseAIResponse(textContent.text);
      } catch (error: any) {
        lastError = error;
        logAI.warn('Retry attempt', {
          provider: 'anthropic',
          attempt: attempt + 1,
          maxAttempts: aiConfig.retryAttempts,
          error: error.message
        });

        if (attempt < aiConfig.retryAttempts - 1) {
          const delay = aiConfig.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Claude API failed after retries');
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAIAPI(request: AIRequest): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const { systemPrompt, userPrompt } = this.buildPrompts(request);

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < aiConfig.retryAttempts; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: aiConfig.openai.defaultModel,
          max_tokens: aiConfig.maxTokens,
          temperature: aiConfig.temperature,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        const message = response.choices[0]?.message?.content;
        if (!message) {
          throw new Error('No content in OpenAI response');
        }

        return this.parseAIResponse(message);
      } catch (error: any) {
        lastError = error;
        logAI.warn('Retry attempt', {
          provider: 'openai',
          attempt: attempt + 1,
          maxAttempts: aiConfig.retryAttempts,
          error: error.message
        });

        if (attempt < aiConfig.retryAttempts - 1) {
          const delay = aiConfig.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('OpenAI API failed after retries');
  }

  // ==========================================================================
  // Private Methods - Prompt Building
  // ==========================================================================

  private buildPrompts(request: AIRequest): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = `You are GrowBuddy AI, an expert gardening assistant specializing in plant care recommendations.
Your responses must be in JSON format with the following structure:
{
  "action": "A clear, actionable recommendation",
  "reason": "Brief explanation of why this action is recommended",
  "confidence": 0.85,
  "additionalInfo": {}
}

Confidence should be a number between 0 and 1, where 1 is completely certain.
Keep responses concise, practical, and focused on actionable advice.`;

    let userPrompt: string;

    switch (request.type) {
      case 'plant_update_suggestion':
        userPrompt = this.buildPlantUpdatePrompt(request.payload);
        break;

      case 'weather_based_action':
        userPrompt = this.buildWeatherActionPrompt(request.payload);
        break;

      case 'care_recommendation':
        userPrompt = this.buildCareRecommendationPrompt(request.payload);
        break;

      case 'pest_diagnosis':
        userPrompt = this.buildPestDiagnosisPrompt(request.payload);
        break;

      case 'general':
        userPrompt = this.buildGeneralPrompt(request.payload);
        break;

      default:
        userPrompt = JSON.stringify(request.payload);
    }

    return { systemPrompt, userPrompt };
  }

  private buildPlantUpdatePrompt(payload: Record<string, any>): string {
    return `Analyze this plant's current status and provide a care recommendation:
Plant: ${payload.plantName || 'Unknown'}
Current Conditions: ${JSON.stringify(payload.currentConditions || {})}
Recent Care History: ${JSON.stringify(payload.recentCare || {})}
Environmental Data: ${JSON.stringify(payload.environment || {})}

Based on this information, what care action should the gardener take next?`;
  }

  private buildWeatherActionPrompt(payload: Record<string, any>): string {
    return `Based on upcoming weather conditions, recommend actions for this garden:
Weather Forecast: ${JSON.stringify(payload.weatherForecast || {})}
Plants in Garden: ${JSON.stringify(payload.plants || [])}
Current Season: ${payload.season || 'Unknown'}
Hardiness Zone: ${payload.zone || 'Unknown'}

What actions should the gardener take to prepare for or respond to this weather?`;
  }

  private buildCareRecommendationPrompt(payload: Record<string, any>): string {
    return `Provide general care recommendations for this plant:
Plant Type: ${payload.plantType || 'Unknown'}
Growth Stage: ${payload.growthStage || 'Unknown'}
Location: ${payload.location || 'Unknown'}
Additional Context: ${JSON.stringify(payload.context || {})}

What care does this plant need right now?`;
  }

  private buildPestDiagnosisPrompt(payload: Record<string, any>): string {
    return `Help diagnose and treat a potential pest or disease issue:
Plant: ${payload.plantName || 'Unknown'}
Symptoms: ${payload.symptoms || 'No symptoms provided'}
Photos Description: ${payload.photoDescription || 'No photos'}
Recent Changes: ${payload.recentChanges || 'None'}

What is likely affecting this plant and how should it be treated?`;
  }

  private buildGeneralPrompt(payload: Record<string, any>): string {
    return `${payload.question || payload.prompt || JSON.stringify(payload)}`;
  }

  // ==========================================================================
  // Private Methods - Response Processing
  // ==========================================================================

  /**
   * Parse AI response text into structured format
   */
  private parseAIResponse(responseText: string): any {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(responseText);
      return parsed;
    } catch (error) {
      // If not JSON, try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          // Fall through to structured extraction
        }
      }

      // If still no JSON, create structured response from text
      return {
        action: responseText.substring(0, 200),
        reason: 'AI response was not in expected JSON format',
        confidence: 0.5,
        additionalInfo: {
          rawResponse: responseText,
        },
      };
    }
  }

  /**
   * Sanitize AI response to remove potentially harmful content
   */
  private sanitize(result: any): AISuggestion {
    // Ensure result has required fields
    const action = this.sanitizeString(result.action || result.recommendation || '');
    const reason = this.sanitizeString(result.reason || result.explanation || '');
    const confidence = this.sanitizeConfidence(result.confidence);

    return {
      action,
      reason,
      confidence,
      additionalInfo: result.additionalInfo || {},
    };
  }

  private sanitizeString(text: string): string {
    if (typeof text !== 'string') {
      return String(text);
    }

    // Remove HTML tags
    let sanitized = text.replace(/<[^>]*>/g, '');

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove potentially harmful protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:text\/html/gi, '');

    // Trim excessive whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');

    return sanitized;
  }

  private sanitizeConfidence(confidence: any): number {
    const num = parseFloat(confidence);
    if (isNaN(num)) {
      return 0.5; // Default confidence
    }
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, num));
  }

  // ==========================================================================
  // Private Methods - Database Operations
  // ==========================================================================

  /**
   * Update task status in database
   */
  private async updateTaskStatus(
    request: AIRequest,
    status: AITaskStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      // Validate that request has required fields
      if (!request.taskId) {
        logAI.error('Cannot update task status: missing taskId', {
          userId: request.userId,
          taskType: request.type
        });
        return;
      }

      const [task, created] = await AITask.findOrCreate({
        where: { id: request.taskId },
        defaults: {
          id: request.taskId,
          user_id: request.userId || null,
          plant_id: request.plantId || null,
          task_type: request.type,
          status,
          request_payload: request.payload,
          error_message: errorMessage || null,
        },
      });

      // Ensure task was created or found
      if (!task) {
        logAI.error('Failed to create or find task', {
          taskId: request.taskId,
          taskType: request.type
        });
        return;
      }

      if (!created && task) {
        await task.update({
          status,
          error_message: errorMessage || null,
          completed_at: status === 'completed' || status === 'failed' ? new Date() : null,
        });
      }

      logAI.info('Task status updated', {
        taskId: request.taskId,
        status,
        created
      });
    } catch (error: any) {
      logAI.error('Failed to update task status', {
        taskId: request.taskId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw - we don't want DB errors to stop AI processing
    }
  }

  /**
   * Store AI result in database
   */
  private async storeResult(
    taskId: string,
    request: AIRequest,
    suggestion: AISuggestion,
    modelUsed: string
  ): Promise<void> {
    try {
      const task = await AITask.findByPk(taskId);
      if (task) {
        await task.update({
          status: 'completed',
          response_data: suggestion,
          model_used: modelUsed,
          completed_at: new Date(),
        });
      } else {
        // Create new task if it doesn't exist
        await AITask.create({
          id: taskId,
          user_id: request.userId || null,
          plant_id: request.plantId || null,
          task_type: request.type,
          status: 'completed',
          request_payload: request.payload,
          response_data: suggestion,
          model_used: modelUsed,
          completed_at: new Date(),
        });
      }

      // Publish AI result ready event if userId is available
      if (request.userId) {
        messageBus.publish(MessageBusEvent.AI_RESULT_READY, {
          taskId: taskId,
          userId: request.userId,
          plantId: request.plantId,
          suggestion: {
            type: request.type,
            content: suggestion.action,
            confidence: suggestion.confidence,
            actionItems: suggestion.reason ? [suggestion.reason] : undefined,
          },
          timestamp: new Date(),
        });
      }

      logAI.info('AI result stored', {
        taskId,
        taskType: request.type,
        modelUsed,
        confidence: suggestion.confidence
      });
    } catch (error) {
      logAI.error('Failed to store AI result', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw - we already have the result, DB storage is secondary
    }
  }

  // ==========================================================================
  // Mock Response Generation (for development without API keys)
  // ==========================================================================

  /**
   * Generate mock AI responses for development/testing
   * Loads responses from JSON file and interpolates placeholders
   */
  private generateMockResponse(request: AIRequest): any {
    // Get the mock response template for this request type
    const template = (mockResponses as any)[request.type] || (mockResponses as any).general;

    // Deep clone the template to avoid mutating the original
    const response = JSON.parse(JSON.stringify(template));

    // Replace placeholders in action and reason with actual values
    response.action = this.interpolateTemplate(response.action, request.payload);
    response.reason = this.interpolateTemplate(response.reason, request.payload);

    // Handle special cases for dynamic data
    if (request.type === 'weather_based_action' && request.payload.plants) {
      response.additionalInfo.affectedPlants = request.payload.plants.slice(0, 3);
    }

    if (request.type === 'general' && (request.payload.question || request.payload.prompt)) {
      const text = request.payload.question || request.payload.prompt;
      response.action = `Here's guidance on: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`;
    }

    // Add slight confidence variation to make it more realistic
    const confidenceVariation = (Math.random() - 0.5) * 0.1; // +/- 0.05
    response.confidence = Math.max(0.5, Math.min(0.95, response.confidence + confidenceVariation));

    return response;
  }

  /**
   * Replace template placeholders like {plantName} with actual values
   */
  private interpolateTemplate(template: string, payload: Record<string, any>): string {
    let result = template;

    // Replace {key} placeholders with payload values or defaults
    const placeholders: Record<string, string> = {
      plantName: payload.plantName || 'plant',
      plantType: payload.plantType || 'plant',
      growthStage: payload.growthStage || 'active growth',
      symptoms: payload.symptoms || 'discolored leaves, sticky residue',
      location: payload.location || 'garden',
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
