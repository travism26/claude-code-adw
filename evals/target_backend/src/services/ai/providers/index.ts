/**
 * AI Providers Module
 *
 * Exports the provider manager singleton and all provider-related types.
 * This is the main entry point for using the AI provider system.
 *
 * Usage:
 * ```typescript
 * import { aiProviderManager } from './services/ai/providers';
 *
 * const response = await aiProviderManager.chat({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 * ```
 */

import { aiConfig } from '../../../config/ai';
import { AIProviderManager, ProviderManagerConfig } from '../AIProviderManager';
import { AnthropicProvider, AnthropicProviderConfig } from './AnthropicProvider';
import { OpenAIProvider, OpenAIProviderConfig } from './OpenAIProvider';
import { OpenRouterProvider, OpenRouterProviderConfig } from './OpenRouterProvider';
import { logAI } from '../../logging/logger';

// Re-export types
export * from './types';
export { BaseProvider } from './BaseProvider';
export { AnthropicProvider, AnthropicProviderConfig } from './AnthropicProvider';
export { OpenAIProvider, OpenAIProviderConfig } from './OpenAIProvider';
export { OpenRouterProvider, OpenRouterProviderConfig } from './OpenRouterProvider';

// ==========================================================================
// Provider Manager Factory
// ==========================================================================

/**
 * Create and configure the provider manager with all available providers
 */
function createProviderManager(): AIProviderManager {
  // Create manager with configuration from aiConfig
  const managerConfig: ProviderManagerConfig = {
    defaultProvider: aiConfig.defaultProvider,
    fallbackProviders: aiConfig.fallbackProviders,
    retryAttempts: aiConfig.retryAttempts,
    retryDelay: aiConfig.retryDelay,
    maxRetryDelay: aiConfig.maxRetryDelay,
  };

  const manager = new AIProviderManager(managerConfig);

  // Register Anthropic provider if enabled
  if (aiConfig.providers.anthropic.enabled) {
    const anthropicConfig: AnthropicProviderConfig = {
      name: 'anthropic',
      apiKey: aiConfig.providers.anthropic.apiKey,
      defaultModel: aiConfig.providers.anthropic.defaultModel,
      maxTokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
      timeout: aiConfig.timeout,
    };
    manager.register(new AnthropicProvider(anthropicConfig));
  }

  // Register OpenAI provider if enabled
  if (aiConfig.providers.openai.enabled) {
    const openaiConfig: OpenAIProviderConfig = {
      name: 'openai',
      apiKey: aiConfig.providers.openai.apiKey,
      defaultModel: aiConfig.providers.openai.defaultModel,
      maxTokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
      timeout: aiConfig.timeout,
    };
    manager.register(new OpenAIProvider(openaiConfig));
  }

  // Register OpenRouter provider if enabled
  if (aiConfig.providers.openrouter.enabled) {
    const openrouterConfig: OpenRouterProviderConfig = {
      name: 'openrouter',
      apiKey: aiConfig.providers.openrouter.apiKey,
      defaultModel: aiConfig.providers.openrouter.defaultModel,
      maxTokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
      timeout: aiConfig.timeout,
      siteUrl: aiConfig.providers.openrouter.siteUrl,
      siteName: aiConfig.providers.openrouter.siteName,
    };
    manager.register(new OpenRouterProvider(openrouterConfig));
  }

  // Log initialization status
  const status = manager.getProvidersStatus();
  const availableProviders = status.filter((s) => s.available).map((s) => s.name);

  if (availableProviders.length > 0) {
    logAI.info("Provider manager initialized", {
      service: "AIProviderFactory",
      supportedProviders: availableProviders,
      providerCount: availableProviders.length,
      defaultProvider: aiConfig.defaultProvider,
    });
  } else if (!aiConfig.mockMode) {
    logAI.warn("All providers unhealthy - no providers available", {
      service: "AIProviderFactory",
      providers: status.map((s) => s.name),
      fallbackStrategy: aiConfig.mockMode ? 'mock' : 'none',
      message: 'Check API key configuration',
    });
  }

  return manager;
}

// ==========================================================================
// Singleton Export
// ==========================================================================

/**
 * Singleton instance of the AI Provider Manager
 * Use this for all AI requests in the application
 */
export const aiProviderManager = createProviderManager();

/**
 * Re-export the AIProviderManager class for testing and custom configurations
 */
export { AIProviderManager, ProviderManagerConfig } from '../AIProviderManager';
