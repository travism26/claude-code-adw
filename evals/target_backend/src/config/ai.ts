/**
 * AI Service Configuration
 *
 * Configuration for AI model integration (Anthropic Claude, OpenAI, and OpenRouter)
 * Provides settings for API access, model selection, provider fallback, and rate limiting
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported AI provider names
 */
export type AIProviderName = "anthropic" | "openai" | "openrouter";

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  apiKey: string;
  defaultModel: string;
  enabled: boolean;
}

/**
 * OpenRouter-specific configuration (extends base provider config)
 */
export interface OpenRouterConfig extends ProviderConfig {
  /** Site URL for OpenRouter attribution */
  siteUrl?: string;
  /** Site name for OpenRouter attribution */
  siteName?: string;
}

// ============================================================================
// Main Configuration Interface
// ============================================================================

export interface AIConfig {
  // Individual provider configurations (backward compatible)
  anthropic: {
    apiKey: string;
    defaultModel: string;
  };
  openai: {
    apiKey: string;
    defaultModel: string;
  };

  // New provider-based configuration
  providers: {
    anthropic: ProviderConfig;
    openai: ProviderConfig;
    openrouter: OpenRouterConfig;
  };

  // Provider selection
  defaultProvider: AIProviderName;
  fallbackProviders: AIProviderName[];

  // Request configuration
  maxTokens: number;
  temperature: number;
  timeout: number; // milliseconds

  // Retry configuration
  retryAttempts: number;
  retryDelay: number; // milliseconds
  maxRetryDelay: number; // milliseconds

  // Development mode
  mockMode: boolean; // Enable mock responses for development without API keys
}

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Parse a comma-separated list of provider names
 */
function parseFallbackProviders(
  fallbackStr: string | undefined
): AIProviderName[] {
  if (!fallbackStr) {
    return [];
  }

  const validProviders: AIProviderName[] = [
    "anthropic",
    "openai",
    "openrouter",
  ];
  return fallbackStr
    .split(",")
    .map((s) => s.trim().toLowerCase() as AIProviderName)
    .filter((p) => validProviders.includes(p));
}

/**
 * Determine the default provider based on available API keys
 */
function determineDefaultProvider(
  envDefault: string | undefined,
  anthropicKey: string | undefined,
  openaiKey: string | undefined,
  openrouterKey: string | undefined
): AIProviderName {
  // Use explicit default if set
  if (envDefault) {
    const normalized = envDefault.toLowerCase() as AIProviderName;
    if (["anthropic", "openai", "openrouter"].includes(normalized)) {
      return normalized;
    }
  }

  // Otherwise, use the first available provider
  if (anthropicKey) return "anthropic";
  if (openaiKey) return "openai";
  if (openrouterKey) return "openrouter";

  // Default to anthropic
  return "anthropic";
}

/**
 * Get default fallback providers based on the primary provider
 */
function getDefaultFallbackProviders(
  primary: AIProviderName
): AIProviderName[] {
  const all: AIProviderName[] = ["anthropic", "openai", "openrouter"];
  return all.filter((p) => p !== primary);
}

/**
 * Load AI configuration from environment variables
 * Maintains backward compatibility with existing env vars
 */
function loadAIConfig(): AIConfig {
  // Get API keys
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || "";
  const openaiApiKey = process.env.OPENAI_API_KEY || "";
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || "";

  // Check if mock mode is enabled (inverse of ENABLE_AI)
  const mockMode = process.env.ENABLE_AI !== "true";

  // Validate API key availability
  const hasAnyKey = !!(anthropicApiKey || openaiApiKey || openrouterApiKey);
  if (!hasAnyKey && process.env.NODE_ENV !== "test" && !mockMode) {
    console.warn(
      "AI Service: No API keys configured. Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY, or set ENABLE_AI=false for development"
    );
  }

  if (mockMode && !process.env.TEST_QUIET) {
    console.log(
      "AI Service: Running in MOCK MODE (ENABLE_AI !== true) - no actual API calls will be made"
    );
  }

  // Determine default provider
  const defaultProvider = determineDefaultProvider(
    process.env.AI_DEFAULT_PROVIDER,
    anthropicApiKey,
    openaiApiKey,
    openrouterApiKey
  );

  // Parse fallback providers
  const fallbackProviders = parseFallbackProviders(
    process.env.AI_FALLBACK_PROVIDERS
  );

  // Build the configuration
  const config: AIConfig = {
    // Backward compatible provider configs
    anthropic: {
      apiKey: anthropicApiKey,
      defaultModel:
        process.env.AI_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
    },
    openai: {
      apiKey: openaiApiKey,
      defaultModel: process.env.AI_OPENAI_MODEL || "gpt-4-turbo-preview",
    },

    // New provider-based configuration
    providers: {
      anthropic: {
        apiKey: anthropicApiKey,
        defaultModel:
          process.env.AI_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
        enabled: !!anthropicApiKey,
      },
      openai: {
        apiKey: openaiApiKey,
        defaultModel: process.env.AI_OPENAI_MODEL || "gpt-4-turbo-preview",
        enabled: !!openaiApiKey,
      },
      openrouter: {
        apiKey: openrouterApiKey,
        defaultModel:
          process.env.AI_OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
        enabled: !!openrouterApiKey,
        siteUrl: process.env.OPENROUTER_SITE_URL,
        siteName: process.env.OPENROUTER_SITE_NAME,
      },
    },

    // Provider selection
    defaultProvider,
    fallbackProviders:
      fallbackProviders.length > 0
        ? fallbackProviders
        : getDefaultFallbackProviders(defaultProvider),

    // Request configuration
    // Note: Garden analysis responses with multiple suggestions often require 2000+ tokens
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || "4096", 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
    timeout: parseInt(process.env.AI_TIMEOUT || "30000", 10), // 30 seconds

    // Retry configuration
    retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || "3", 10),
    retryDelay: parseInt(process.env.AI_RETRY_DELAY || "1000", 10), // 1 second
    maxRetryDelay: parseInt(process.env.AI_MAX_RETRY_DELAY || "10000", 10), // 10 seconds

    // Development mode
    mockMode,
  };

  return config;
}

// ============================================================================
// Export Configuration
// ============================================================================

export const aiConfig = loadAIConfig();

export default aiConfig;
