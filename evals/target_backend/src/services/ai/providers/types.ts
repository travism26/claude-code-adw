/**
 * AI Provider Types
 *
 * Defines interfaces and types for the provider abstraction layer.
 * All AI providers must implement these interfaces.
 */

// ============================================================================
// Provider Names and Configuration
// ============================================================================

/**
 * Supported AI provider names
 */
export type AIProviderName = "anthropic" | "openai" | "openrouter";

/**
 * Configuration for initializing an AI provider
 */
export interface AIProviderConfig {
  /** API key for the provider */
  apiKey: string;
  /** Default model to use for this provider */
  defaultModel: string;
  /** Provider name identifier */
  name: AIProviderName;
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Optional maximum tokens for responses */
  maxTokens?: number;
  /** Optional temperature for response generation */
  temperature?: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Text content block for multi-part messages
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content block for vision API calls
 */
export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Message structure for chat completions
 * Supports both text-only messages (backward compatible) and multi-part messages with images
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<TextContent | ImageContent>;
}

/**
 * Parameters for chat completion requests
 */
export interface ChatCompletionParams {
  /** Messages to send to the model */
  messages: ChatMessage[];
  /** Optional model override (uses provider default if not specified) */
  model?: string;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Temperature for response generation (0-1) */
  temperature?: number;
  /** Optional system prompt (convenience - will be prepended to messages) */
  systemPrompt?: string;
  /** Optional images for vision API calls */
  images?: Array<{ base64: string; mimeType: string }>;
}

/**
 * Token usage information from a completion
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Standardized response from any AI provider
 */
export interface AIProviderResponse {
  /** The generated content */
  content: string;
  /** Model that generated the response */
  model: string;
  /** Provider that handled the request */
  provider: AIProviderName;
  /** Token usage information */
  usage?: TokenUsage;
  /** Raw response from the provider (for debugging) */
  rawResponse?: any;
}

// ============================================================================
// Provider Status
// ============================================================================

/**
 * Health status of a provider
 */
export interface ProviderStatus {
  /** Provider name */
  name: AIProviderName;
  /** Whether the provider is available and ready */
  available: boolean;
  /** Human-readable status message */
  message: string;
  /** Last time the provider was checked */
  lastChecked?: Date;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Interface that all AI providers must implement
 */
export interface AIProvider {
  /** Provider name identifier */
  readonly name: AIProviderName;

  /**
   * Check if the provider is available (has valid configuration)
   */
  isAvailable(): boolean;

  /**
   * Get the current status of the provider
   */
  getStatus(): ProviderStatus;

  /**
   * Execute a chat completion request
   * @param params - Chat completion parameters
   * @returns Standardized response
   * @throws AIProviderError on failure
   */
  chat(params: ChatCompletionParams): Promise<AIProviderResponse>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error types for categorizing provider failures
 */
export enum AIProviderErrorType {
  /** Authentication failed (invalid API key) */
  AUTHENTICATION = "AUTHENTICATION",
  /** Rate limit exceeded */
  RATE_LIMIT = "RATE_LIMIT",
  /** Request validation failed */
  VALIDATION = "VALIDATION",
  /** Provider service unavailable */
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  /** Network or connection error */
  NETWORK = "NETWORK",
  /** Request timeout */
  TIMEOUT = "TIMEOUT",
  /** Model not found or not accessible */
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  /** Content filtered or blocked */
  CONTENT_FILTERED = "CONTENT_FILTERED",
  /** Unknown or unexpected error */
  UNKNOWN = "UNKNOWN",
}

/**
 * Custom error class for AI provider errors
 * Provides context about which provider failed and why
 */
export class AIProviderError extends Error {
  /** Error type for categorization */
  readonly type: AIProviderErrorType;
  /** Provider that generated the error */
  readonly provider: AIProviderName;
  /** HTTP status code if applicable */
  readonly statusCode?: number;
  /** Whether this error is retryable */
  readonly retryable: boolean;
  /** Original error if wrapped */
  readonly cause?: Error;

  constructor(
    message: string,
    type: AIProviderErrorType,
    provider: AIProviderName,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "AIProviderError";
    this.type = type;
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? this.isRetryableType(type);
    this.cause = options?.cause;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIProviderError);
    }
  }

  /**
   * Determine if an error type is typically retryable
   */
  private isRetryableType(type: AIProviderErrorType): boolean {
    switch (type) {
      case AIProviderErrorType.RATE_LIMIT:
      case AIProviderErrorType.SERVICE_UNAVAILABLE:
      case AIProviderErrorType.NETWORK:
      case AIProviderErrorType.TIMEOUT:
        return true;
      case AIProviderErrorType.AUTHENTICATION:
      case AIProviderErrorType.VALIDATION:
      case AIProviderErrorType.MODEL_NOT_FOUND:
      case AIProviderErrorType.CONTENT_FILTERED:
      case AIProviderErrorType.UNKNOWN:
      default:
        return false;
    }
  }

  /**
   * Create a human-readable string representation
   */
  toString(): string {
    const parts = [
      `AIProviderError [${this.provider}/${this.type}]: ${this.message}`,
    ];
    if (this.statusCode) {
      parts.push(`(HTTP ${this.statusCode})`);
    }
    if (this.retryable) {
      parts.push("[retryable]");
    }
    return parts.join(" ");
  }
}
