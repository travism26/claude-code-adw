/**
 * OpenAI Provider
 *
 * AI provider implementation for OpenAI models (GPT-4, etc.).
 * Uses the official openai package.
 */

import OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
import {
  AIProviderConfig,
  AIProviderError,
  AIProviderErrorType,
  AIProviderResponse,
  ChatCompletionParams,
} from './types';
import { logAI } from '../../logging/logger';

/**
 * OpenAI-specific provider configuration
 */
export interface OpenAIProviderConfig extends AIProviderConfig {
  name: 'openai';
}

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI | null = null;

  constructor(config: OpenAIProviderConfig) {
    super(config);
    this.initializeClient();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the OpenAI client if API key is available
   */
  private initializeClient(): void {
    if (this.config.apiKey) {
      try {
        this.client = new OpenAI({
          apiKey: this.config.apiKey,
        });
        logAI.info("Provider initialized", {
          service: "OpenAIProvider",
          provider: "openai",
          model: this.config.defaultModel,
          hasApiKey: !!this.config.apiKey,
        });
      } catch (error) {
        logAI.error("API error - provider initialization failed", {
          service: "OpenAIProvider",
          provider: "openai",
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          retryable: false,
        });
        this.client = null;
      }
    }
  }

  // ==========================================================================
  // Abstract Method Implementations
  // ==========================================================================

  /**
   * Check if the provider is available
   */
  isAvailable(): boolean {
    return this.client !== null && !!this.config.apiKey;
  }

  /**
   * Execute chat completion using OpenAI API
   */
  protected async executeChat(params: ChatCompletionParams): Promise<AIProviderResponse> {
    if (!this.client) {
      throw new AIProviderError(
        'OpenAI client not initialized',
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        'openai'
      );
    }

    // Build the request - OpenAI accepts system messages inline
    const response = await this.client.chat.completions.create({
      model: params.model || this.config.defaultModel,
      max_tokens: params.maxTokens || this.config.maxTokens || 1024,
      temperature: params.temperature ?? this.config.temperature ?? 0.7,
      messages: params.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })) as any,
    });

    // Extract content from response
    const message = response.choices[0]?.message?.content;
    if (!message) {
      throw new AIProviderError(
        'No content in OpenAI response',
        AIProviderErrorType.VALIDATION,
        'openai'
      );
    }

    return {
      content: message,
      model: response.model,
      provider: 'openai',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      rawResponse: response,
    };
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  /**
   * Override error normalization for OpenAI-specific errors
   */
  protected normalizeError(error: unknown): AIProviderError {
    if (error instanceof OpenAI.APIError) {
      const statusCode = error.status;
      let errorType = this.getErrorTypeFromStatusCode(statusCode);
      let message = error.message;

      // Handle specific OpenAI error cases
      if (statusCode === 401) {
        message = 'Invalid OpenAI API key';
        errorType = AIProviderErrorType.AUTHENTICATION;
      } else if (statusCode === 429) {
        message = 'OpenAI rate limit exceeded';
        errorType = AIProviderErrorType.RATE_LIMIT;
      } else if (statusCode === 400) {
        // Check for specific error types
        if (message.includes('model')) {
          errorType = AIProviderErrorType.MODEL_NOT_FOUND;
        } else if (message.includes('content_policy')) {
          errorType = AIProviderErrorType.CONTENT_FILTERED;
        }
      }

      return new AIProviderError(message, errorType, 'openai', {
        statusCode,
        cause: error,
      });
    }

    // Fall back to base implementation for non-OpenAI errors
    return super.normalizeError(error);
  }
}
