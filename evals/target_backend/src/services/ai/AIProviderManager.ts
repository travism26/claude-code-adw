/**
 * AI Provider Manager
 *
 * Orchestrates multiple AI providers with fallback and retry logic.
 * Provides a unified interface for making AI requests regardless of provider.
 */

import {
  AIProvider,
  AIProviderError,
  AIProviderErrorType,
  AIProviderName,
  AIProviderResponse,
  ChatCompletionParams,
  ProviderStatus,
} from './providers/types';
import { logAI } from '../logging/logger';

/**
 * Configuration for the provider manager
 */
export interface ProviderManagerConfig {
  /** Default provider to use */
  defaultProvider?: AIProviderName;
  /** Ordered list of fallback providers */
  fallbackProviders?: AIProviderName[];
  /** Number of retry attempts per provider */
  retryAttempts?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  /** Maximum delay between retries in milliseconds */
  maxRetryDelay?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ProviderManagerConfig> = {
  defaultProvider: 'anthropic',
  fallbackProviders: ['openai', 'openrouter'],
  retryAttempts: 3,
  retryDelay: 1000,
  maxRetryDelay: 10000,
};

export class AIProviderManager {
  private providers: Map<AIProviderName, AIProvider> = new Map();
  private config: Required<ProviderManagerConfig>;

  constructor(config: ProviderManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Provider Registration
  // ==========================================================================

  /**
   * Register a provider with the manager
   */
  register(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
    logAI.info("Provider added to pool", {
      service: "AIProviderManager",
      provider: provider.name,
      priority: this.providers.size,
      isAvailable: provider.isAvailable(),
    });
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: AIProviderName): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get status of all providers
   */
  getProvidersStatus(): ProviderStatus[] {
    return this.getAllProviders().map((provider) => provider.getStatus());
  }

  // ==========================================================================
  // Provider Selection
  // ==========================================================================

  /**
   * Get the first available provider based on priority
   * Priority: defaultProvider > fallbackProviders > any available
   */
  getAvailableProvider(): AIProvider | null {
    const orderedProviders = this.getOrderedProviders();

    for (const name of orderedProviders) {
      const provider = this.providers.get(name);
      if (provider?.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Get providers in priority order
   */
  private getOrderedProviders(): AIProviderName[] {
    const ordered: AIProviderName[] = [];
    const seen = new Set<AIProviderName>();

    // Add default provider first
    if (this.config.defaultProvider) {
      ordered.push(this.config.defaultProvider);
      seen.add(this.config.defaultProvider);
    }

    // Add fallback providers in order
    for (const name of this.config.fallbackProviders) {
      if (!seen.has(name)) {
        ordered.push(name);
        seen.add(name);
      }
    }

    // Add any remaining registered providers
    for (const name of this.providers.keys()) {
      if (!seen.has(name)) {
        ordered.push(name);
        seen.add(name);
      }
    }

    return ordered;
  }

  // ==========================================================================
  // Chat Completion
  // ==========================================================================

  /**
   * Execute a chat completion with automatic provider selection and fallback
   *
   * @param params - Chat completion parameters
   * @returns Provider response
   * @throws AIProviderError if all providers fail
   */
  async chat(params: ChatCompletionParams): Promise<AIProviderResponse> {
    const orderedProviders = this.getOrderedProviders();
    const availableProviders = orderedProviders.filter(
      (name) => this.providers.get(name)?.isAvailable()
    );

    if (availableProviders.length === 0) {
      throw new AIProviderError(
        'No AI providers available',
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        this.config.defaultProvider
      );
    }

    let lastError: AIProviderError | null = null;

    // Try each provider in order
    for (const providerName of availableProviders) {
      const provider = this.providers.get(providerName)!;

      try {
        // Attempt with retries for this provider
        return await this.chatWithRetry(provider, params);
      } catch (error) {
        lastError =
          error instanceof AIProviderError
            ? error
            : new AIProviderError(
                String(error),
                AIProviderErrorType.UNKNOWN,
                providerName
              );

        logAI.warn("Provider fallback initiated", {
          service: "AIProviderManager",
          fromProvider: providerName,
          toProvider: availableProviders[availableProviders.indexOf(providerName) + 1] || 'none',
          reason: lastError.message,
          errorType: lastError.type,
        });

        // Continue to next provider
      }
    }

    // All providers failed
    logAI.error("All providers failed", {
      service: "AIProviderManager",
      attemptCount: availableProviders.length,
      errors: lastError?.message || 'Unknown error',
      errorType: lastError?.type || AIProviderErrorType.SERVICE_UNAVAILABLE,
    });

    throw new AIProviderError(
      `All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`,
      lastError?.type || AIProviderErrorType.SERVICE_UNAVAILABLE,
      this.config.defaultProvider,
      { cause: lastError || undefined }
    );
  }

  /**
   * Execute chat completion with retry logic for a single provider
   */
  private async chatWithRetry(
    provider: AIProvider,
    params: ChatCompletionParams
  ): Promise<AIProviderResponse> {
    let lastError: AIProviderError | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        return await provider.chat(params);
      } catch (error) {
        lastError =
          error instanceof AIProviderError
            ? error
            : new AIProviderError(
                String(error),
                AIProviderErrorType.UNKNOWN,
                provider.name
              );

        logAI.warn("Retry triggered", {
          service: "AIProviderManager",
          provider: provider.name,
          attempt: attempt + 1,
          maxAttempts: this.config.retryAttempts,
          reason: lastError.message,
          errorType: lastError.type,
          retryable: lastError.retryable,
        });

        // Don't retry non-retryable errors
        if (!lastError.retryable) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.retryAttempts - 1) {
          const delay = Math.min(
            this.config.retryDelay * Math.pow(2, attempt),
            this.config.maxRetryDelay
          );
          logAI.debug("Retry delay applied", {
            service: "AIProviderManager",
            provider: provider.name,
            delay,
            attempt: attempt + 1,
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new AIProviderError(
      `${provider.name} failed after ${this.config.retryAttempts} attempts`,
      AIProviderErrorType.SERVICE_UNAVAILABLE,
      provider.name
    );
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if any provider is available
   */
  hasAvailableProvider(): boolean {
    return this.getAvailableProvider() !== null;
  }

  /**
   * Perform a health check by making a minimal API call to verify credentials
   * Returns success status and any error details
   */
  async healthCheck(): Promise<{ success: boolean; provider?: AIProviderName; error?: string }> {
    const provider = this.getAvailableProvider();

    if (!provider) {
      return {
        success: false,
        error: 'No AI providers configured or available'
      };
    }

    try {
      // Make a minimal API call - just ask for a single word response
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Reply with only the word: pong' }],
        maxTokens: 10,
        temperature: 0,
      });

      // Verify we got a response
      if (response.content) {
        return {
          success: true,
          provider: provider.name
        };
      }

      return {
        success: false,
        provider: provider.name,
        error: 'Empty response from provider'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        provider: provider.name,
        error: message
      };
    }
  }

  /**
   * Get the default provider name
   */
  getDefaultProviderName(): AIProviderName {
    return this.config.defaultProvider;
  }

  /**
   * Update the default provider
   */
  setDefaultProvider(name: AIProviderName): void {
    this.config.defaultProvider = name;
  }
}
