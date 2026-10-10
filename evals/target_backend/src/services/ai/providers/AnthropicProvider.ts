/**
 * Anthropic Provider
 *
 * AI provider implementation for Anthropic's Claude models.
 * Uses the official @anthropic-ai/sdk package.
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './BaseProvider';
import {
  AIProviderConfig,
  AIProviderError,
  AIProviderErrorType,
  AIProviderResponse,
  ChatCompletionParams,
  ChatMessage,
} from './types';
import { logAI } from '../../logging/logger';

/**
 * Anthropic-specific provider configuration
 */
export interface AnthropicProviderConfig extends AIProviderConfig {
  name: 'anthropic';
}

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic | null = null;

  constructor(config: AnthropicProviderConfig) {
    super(config);
    this.initializeClient();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the Anthropic client if API key is available
   */
  private initializeClient(): void {
    if (this.config.apiKey) {
      try {
        this.client = new Anthropic({
          apiKey: this.config.apiKey,
        });
        logAI.info("Provider initialized", {
          service: "AnthropicProvider",
          provider: "anthropic",
          model: this.config.defaultModel,
          hasApiKey: !!this.config.apiKey,
        });
      } catch (error) {
        logAI.error("API error - provider initialization failed", {
          service: "AnthropicProvider",
          provider: "anthropic",
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
   * Execute chat completion using Anthropic API
   */
  protected async executeChat(params: ChatCompletionParams): Promise<AIProviderResponse> {
    if (!this.client) {
      throw new AIProviderError(
        'Anthropic client not initialized',
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        'anthropic'
      );
    }

    // Extract system message and user/assistant messages
    const { systemPrompt, userMessages } = this.separateMessages(params.messages, params.images);

    // Build the request
    const response = await this.client.messages.create({
      model: params.model || this.config.defaultModel,
      max_tokens: params.maxTokens || this.config.maxTokens || 1024,
      temperature: params.temperature ?? this.config.temperature ?? 0.7,
      system: systemPrompt,
      messages: userMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })) as any,
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AIProviderError(
        'No text content in Anthropic response',
        AIProviderErrorType.VALIDATION,
        'anthropic'
      );
    }

    return {
      content: textContent.text,
      model: response.model,
      provider: 'anthropic',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      rawResponse: response,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Separate system messages from user/assistant messages
   * Anthropic API handles system prompt separately
   * Supports image content blocks for vision API calls
   */
  private separateMessages(
    messages: ChatMessage[],
    images?: Array<{ base64: string; mimeType: string }>
  ): {
    systemPrompt: string;
    userMessages: ChatMessage[];
  } {
    const systemMessages: string[] = [];
    const userMessages: ChatMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are always text
        if (typeof message.content === 'string') {
          systemMessages.push(message.content);
        } else {
          // If system message has content blocks, extract text parts
          const textParts = message.content
            .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
            .map((block) => block.text);
          systemMessages.push(...textParts);
        }
      } else {
        // For user/assistant messages, check if we need to add images
        if (message.role === 'user' && images && images.length > 0 && typeof message.content === 'string') {
          // Convert text message to multi-part content with images
          const contentBlocks: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> = [
            { type: 'text', text: message.content }
          ];

          // Add image blocks
          for (const image of images) {
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: image.base64
              }
            });
          }

          userMessages.push({
            ...message,
            content: contentBlocks as any // TypeScript might complain but Anthropic SDK accepts this
          });

          // Log vision API call
          logAI.info('Vision API call with images', {
            service: 'AnthropicProvider',
            imageCount: images.length,
            imageSizes: images.map(img => img.base64.length),
          });
        } else {
          userMessages.push(message);
        }
      }
    }

    // Combine all system messages into one
    const systemPrompt = systemMessages.join('\n\n');

    // Ensure there's at least one user message
    if (userMessages.length === 0) {
      throw new AIProviderError(
        'At least one user message is required',
        AIProviderErrorType.VALIDATION,
        'anthropic'
      );
    }

    return { systemPrompt, userMessages };
  }

  /**
   * Override error normalization for Anthropic-specific errors
   */
  protected normalizeError(error: unknown): AIProviderError {
    if (error instanceof Anthropic.APIError) {
      const statusCode = error.status;
      let errorType = this.getErrorTypeFromStatusCode(statusCode);
      let message = error.message;

      // Handle specific Anthropic error cases
      if (statusCode === 401) {
        message = 'Invalid Anthropic API key';
        errorType = AIProviderErrorType.AUTHENTICATION;
      } else if (statusCode === 429) {
        message = 'Anthropic rate limit exceeded';
        errorType = AIProviderErrorType.RATE_LIMIT;
      } else if (statusCode === 400 && message.includes('content')) {
        errorType = AIProviderErrorType.CONTENT_FILTERED;
      }

      return new AIProviderError(message, errorType, 'anthropic', {
        statusCode,
        cause: error,
      });
    }

    // Fall back to base implementation for non-Anthropic errors
    return super.normalizeError(error);
  }
}
