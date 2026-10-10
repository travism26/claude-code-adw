/**
 * Base Provider Abstract Class
 *
 * Provides common functionality for all AI providers including:
 * - Configuration validation
 * - Error normalization
 * - Status reporting
 *
 * Concrete providers extend this class and implement the abstract methods.
 */

import {
  AIProvider,
  AIProviderConfig,
  AIProviderError,
  AIProviderErrorType,
  AIProviderName,
  AIProviderResponse,
  ChatCompletionParams,
  ChatMessage,
  ProviderStatus,
} from './types';

export abstract class BaseProvider implements AIProvider {
  /** Provider configuration */
  protected readonly config: AIProviderConfig;

  /** Provider name identifier */
  readonly name: AIProviderName;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.name = config.name;
    this.validateConfig();
  }

  // ==========================================================================
  // Abstract Methods - Must be implemented by concrete providers
  // ==========================================================================

  /**
   * Check if the provider is available and ready to handle requests
   * Implementations should verify API key is set and client is initialized
   */
  abstract isAvailable(): boolean;

  /**
   * Execute the chat completion request using the provider's SDK
   * This is the core implementation that each provider must provide
   *
   * @param params - Chat completion parameters with normalized messages
   * @returns Provider response with content and metadata
   * @throws Error on failure (will be normalized by chat())
   */
  protected abstract executeChat(params: ChatCompletionParams): Promise<AIProviderResponse>;

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Get the current status of the provider
   */
  getStatus(): ProviderStatus {
    const available = this.isAvailable();
    return {
      name: this.name,
      available,
      message: available
        ? `${this.name} provider is ready`
        : `${this.name} provider is not available (missing API key or configuration)`,
      lastChecked: new Date(),
    };
  }

  /**
   * Execute a chat completion request with error normalization
   * This is the public interface - it wraps executeChat with error handling
   *
   * @param params - Chat completion parameters
   * @returns Standardized response
   * @throws AIProviderError on failure
   */
  async chat(params: ChatCompletionParams): Promise<AIProviderResponse> {
    // Check availability before making request
    if (!this.isAvailable()) {
      throw new AIProviderError(
        `${this.name} provider is not available`,
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        this.name,
        { retryable: false }
      );
    }

    // Normalize messages with system prompt if provided
    const normalizedParams = this.normalizeParams(params);

    try {
      return await this.executeChat(normalizedParams);
    } catch (error) {
      // If it's already an AIProviderError, re-throw it
      if (error instanceof AIProviderError) {
        throw error;
      }

      // Otherwise, normalize the error
      throw this.normalizeError(error);
    }
  }

  // ==========================================================================
  // Protected Methods
  // ==========================================================================

  /**
   * Validate the provider configuration
   * Override in subclasses for provider-specific validation
   */
  protected validateConfig(): void {
    if (!this.config.name) {
      throw new Error('Provider name is required');
    }
    if (!this.config.defaultModel) {
      throw new Error(`Default model is required for ${this.config.name} provider`);
    }
  }

  /**
   * Normalize chat completion parameters
   * Adds system prompt to messages if provided separately
   */
  protected normalizeParams(params: ChatCompletionParams): ChatCompletionParams {
    const messages: ChatMessage[] = [];

    // Add system prompt as first message if provided
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt,
      });
    }

    // Add the rest of the messages
    messages.push(...params.messages);

    return {
      ...params,
      messages,
      model: params.model || this.config.defaultModel,
      maxTokens: params.maxTokens || this.config.maxTokens,
      temperature: params.temperature ?? this.config.temperature,
    };
  }

  /**
   * Normalize an error into an AIProviderError
   * Override in subclasses for provider-specific error handling
   *
   * @param error - The error to normalize
   * @returns AIProviderError with appropriate type and metadata
   */
  protected normalizeError(error: unknown): AIProviderError {
    // Handle known error types
    if (error instanceof Error) {
      const message = error.message || 'Unknown error occurred';
      const statusCode = (error as any).status || (error as any).statusCode;

      // Try to determine error type from status code
      let errorType = AIProviderErrorType.UNKNOWN;
      if (statusCode) {
        errorType = this.getErrorTypeFromStatusCode(statusCode);
      } else if (this.isNetworkError(error)) {
        errorType = AIProviderErrorType.NETWORK;
      } else if (this.isTimeoutError(error)) {
        errorType = AIProviderErrorType.TIMEOUT;
      }

      return new AIProviderError(message, errorType, this.name, {
        statusCode,
        cause: error,
      });
    }

    // Handle non-Error objects
    return new AIProviderError(
      String(error),
      AIProviderErrorType.UNKNOWN,
      this.name
    );
  }

  /**
   * Map HTTP status codes to error types
   */
  protected getErrorTypeFromStatusCode(statusCode: number): AIProviderErrorType {
    switch (statusCode) {
      case 401:
        return AIProviderErrorType.AUTHENTICATION;
      case 403:
        return AIProviderErrorType.AUTHENTICATION;
      case 404:
        return AIProviderErrorType.MODEL_NOT_FOUND;
      case 422:
        return AIProviderErrorType.VALIDATION;
      case 429:
        return AIProviderErrorType.RATE_LIMIT;
      case 500:
      case 502:
      case 503:
      case 504:
        return AIProviderErrorType.SERVICE_UNAVAILABLE;
      default:
        if (statusCode >= 400 && statusCode < 500) {
          return AIProviderErrorType.VALIDATION;
        }
        if (statusCode >= 500) {
          return AIProviderErrorType.SERVICE_UNAVAILABLE;
        }
        return AIProviderErrorType.UNKNOWN;
    }
  }

  /**
   * Check if an error is a network-related error
   */
  protected isNetworkError(error: Error): boolean {
    const networkErrorIndicators = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'network',
      'fetch failed',
    ];

    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code?.toLowerCase() || '';

    return networkErrorIndicators.some(
      (indicator) =>
        errorMessage.includes(indicator.toLowerCase()) ||
        errorCode.includes(indicator.toLowerCase())
    );
  }

  /**
   * Check if an error is a timeout error
   */
  protected isTimeoutError(error: Error): boolean {
    const timeoutIndicators = ['timeout', 'timed out', 'ETIMEDOUT'];

    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code?.toLowerCase() || '';

    return timeoutIndicators.some(
      (indicator) =>
        errorMessage.includes(indicator.toLowerCase()) ||
        errorCode.includes(indicator.toLowerCase())
    );
  }
}
