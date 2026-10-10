/**
 * OpenRouter Provider
 *
 * AI provider implementation for OpenRouter, which provides access to
 * multiple AI models through a unified API (Claude, GPT, Llama, etc.).
 *
 * OpenRouter uses an OpenAI-compatible API, so we use the OpenAI SDK
 * with a custom base URL.
 *
 * @see https://openrouter.ai/docs/quickstart
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
 * OpenRouter-specific provider configuration
 */
export interface OpenRouterProviderConfig extends AIProviderConfig {
  name: 'openrouter';
  /** Site URL for OpenRouter attribution (optional but recommended) */
  siteUrl?: string;
  /** Site name for OpenRouter attribution (optional but recommended) */
  siteName?: string;
}

/** OpenRouter API base URL */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider extends BaseProvider {
  private client: OpenAI | null = null;
  private siteUrl?: string;
  private siteName?: string;

  constructor(config: OpenRouterProviderConfig) {
    super(config);
    this.siteUrl = config.siteUrl;
    this.siteName = config.siteName;
    this.initializeClient();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the OpenAI client configured for OpenRouter
   */
  private initializeClient(): void {
    if (this.config.apiKey) {
      try {
        // Build default headers for OpenRouter attribution
        const defaultHeaders: Record<string, string> = {};

        if (this.siteUrl) {
          defaultHeaders['HTTP-Referer'] = this.siteUrl;
        }
        if (this.siteName) {
          defaultHeaders['X-Title'] = this.siteName;
        }

        this.client = new OpenAI({
          baseURL: OPENROUTER_BASE_URL,
          apiKey: this.config.apiKey,
          defaultHeaders:
            Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
        });
        logAI.info("Provider initialized", {
          service: "OpenRouterProvider",
          provider: "openrouter",
          model: this.config.defaultModel,
          hasApiKey: !!this.config.apiKey,
          endpoint: OPENROUTER_BASE_URL,
        });
      } catch (error) {
        logAI.error("API error - provider initialization failed", {
          service: "OpenRouterProvider",
          provider: "openrouter",
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
   * Execute chat completion using OpenRouter API
   * OpenRouter uses the same format as OpenAI
   */
  protected async executeChat(params: ChatCompletionParams): Promise<AIProviderResponse> {
    if (!this.client) {
      throw new AIProviderError(
        'OpenRouter client not initialized',
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        'openrouter'
      );
    }

    // Build the request - OpenRouter accepts the same format as OpenAI
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
    const finishReason = response.choices[0]?.finish_reason;

    // Log response details including finish_reason
    logAI.debug('OpenRouter response received', {
      service: 'OpenRouterProvider',
      model: response.model,
      finishReason,
      contentLength: message?.length || 0,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    });

    if (!message) {
      throw new AIProviderError(
        'No content in OpenRouter response',
        AIProviderErrorType.VALIDATION,
        'openrouter'
      );
    }

    // Check if response was truncated due to length limit
    if (finishReason === 'length') {
      logAI.warn('OpenRouter response truncated due to max_tokens limit', {
        service: 'OpenRouterProvider',
        contentLength: message.length,
        maxTokens: params.maxTokens || this.config.maxTokens || 1024,
        completionTokens: response.usage?.completion_tokens,
      });
    }

    return {
      content: message,
      model: response.model,
      provider: 'openrouter',
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
   * Override error normalization for OpenRouter-specific errors
   */
  protected normalizeError(error: unknown): AIProviderError {
    if (error instanceof OpenAI.APIError) {
      const statusCode = error.status;
      let errorType = this.getErrorTypeFromStatusCode(statusCode);
      let message = error.message;

      // Handle specific OpenRouter error cases
      if (statusCode === 401) {
        message = 'Invalid OpenRouter API key';
        errorType = AIProviderErrorType.AUTHENTICATION;
      } else if (statusCode === 429) {
        message = 'OpenRouter rate limit exceeded';
        errorType = AIProviderErrorType.RATE_LIMIT;
      } else if (statusCode === 400) {
        // Check for specific error types
        if (message.includes('model')) {
          errorType = AIProviderErrorType.MODEL_NOT_FOUND;
        } else if (message.includes('content') || message.includes('moderation')) {
          errorType = AIProviderErrorType.CONTENT_FILTERED;
        }
      } else if (statusCode === 402) {
        // OpenRouter uses 402 for payment/credits issues
        message = 'OpenRouter credits exhausted or payment required';
        errorType = AIProviderErrorType.AUTHENTICATION;
      }

      return new AIProviderError(message, errorType, 'openrouter', {
        statusCode,
        cause: error,
      });
    }

    // Fall back to base implementation for non-OpenAI errors
    return super.normalizeError(error);
  }
}
