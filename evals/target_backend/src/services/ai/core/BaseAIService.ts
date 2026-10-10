/**
 * Base class for all AI services
 * Provides common functionality like AI provider integration,
 * response parsing, and mock response generation
 */

import { aiConfig } from "../../../config/ai";
import { aiProviderManager, AIProviderResponse } from "../providers";
import { AIServiceConfig, Suggestion } from "./types";
import { messageBus } from "../../messageBus";
import { logAI } from "../../logging/logger";

export abstract class BaseAIService {
  protected config: AIServiceConfig;
  protected messageBus = messageBus;

  constructor(config: Partial<AIServiceConfig> = {}) {
    this.config = {
      enableAICalls: false,
      logPrompts: true,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Execute the AI service with given payload
   *
   * This is the main entry point for all AI services. Each service must implement
   * this method to handle its specific domain logic (analysis + persistence).
   *
   * **Uniform Interface Pattern:**
   * - All AI services expose the same `execute()` method
   * - Worker calls `service.execute(payload)` for any service type
   * - Simplifies worker code - no domain-specific logic needed
   *
   * **Implementation Responsibilities:**
   * 1. Perform domain-specific analysis (e.g., analyze garden, diagnose pest)
   * 2. Persist results to database if `aiTaskId` is provided in payload
   * 3. Return analysis results in service-specific format
   *
   * **Payload Structure:**
   * - Must include `userId` (string)
   * - Should include `aiTaskId` (string | undefined) - if present, persist results
   * - Include domain-specific fields (e.g., gardenId, plantId, etc.)
   *
   * @example
   * ```typescript
   * // In GardenAnalysisService:
   * async execute(payload: { gardenId: string, userId: string, aiTaskId?: string }) {
   *   // 1. Analyze
   *   const result = await this.analyzeGarden(payload.gardenId, payload.userId);
   *
   *   // 2. Persist if running from worker (aiTaskId present)
   *   if (payload.aiTaskId) {
   *     await this.persistAnalysis(payload.gardenId, payload.userId, result, payload.aiTaskId);
   *   }
   *
   *   return result;
   * }
   * ```
   *
   * @param payload - Service-specific payload containing analysis parameters and optional aiTaskId
   * @returns Promise resolving to service-specific analysis result
   */
  abstract execute(payload: any): Promise<any>;

  /**
   * Publish completion event to message bus (optional hook - override in subclasses)
   *
   * This is a template method that services can optionally override to publish
   * domain-specific completion events to the MessageBus. The base implementation
   * does nothing - events are opt-in per service.
   *
   * **When to override:**
   * - When your service needs to notify other parts of the system about completion
   * - When WebSocket notifications should be sent to users
   * - When other services need to react to your analysis completing
   *
   * **When NOT to override:**
   * - If no other system needs to know about completion (default behavior)
   * - If the analysis is purely internal with no side effects
   *
   * @example
   * ```typescript
   * // In your service class (e.g., GardenAnalysisService.ts):
   * protected async publishCompletionEvent(result: any, payload: any): Promise<void> {
   *   try {
   *     const { gardenId, userId, analysisId } = payload;
   *
   *     this.messageBus.publish(MessageBusEvent.GARDEN_ANALYSIS_COMPLETED, {
   *       gardenId,
   *       userId,
   *       analysisId,
   *       overallScore: result.overallScore,
   *       suggestionCount: result.suggestions.length,
   *       timestamp: new Date(),
   *     });
   *
   *     console.log(`Published completion event for garden ${gardenId}`);
   *   } catch (error) {
   *     console.error('Failed to publish completion event:', error);
   *     // Don't throw - event publishing failures shouldn't break the analysis
   *   }
   * }
   * ```
   *
   * @param result - The analysis result object returned by your analyze() method
   * @param payload - The original request payload (includes analysisId from worker)
   */
  protected async publishCompletionEvent(
    _result: any,
    _payload: any
  ): Promise<void> {
    // Default: no event published
    // Subclasses can override to publish domain-specific events
  }

  /**
   * Make an AI request with the given prompts using the provider manager
   *
   * This method uses the new provider abstraction layer which supports:
   * - Multiple providers (Anthropic, OpenAI, OpenRouter)
   * - Automatic fallback when a provider fails
   * - Retry logic with exponential backoff
   *
   * @param systemPrompt - System prompt for the AI
   * @param userPrompt - User prompt/query for the AI
   * @param _userId - User ID for logging (optional, not used for provider calls)
   * @returns Parsed AI response or null if AI calls are disabled
   */
  protected async callAI(
    systemPrompt: string,
    userPrompt: string,
    _userId?: string
  ): Promise<any> {
    // Return null if AI calls are disabled (service will handle mock response)
    if (!this.config.enableAICalls) {
      return null;
    }

    // Check if we're in mock mode
    if (aiConfig.mockMode) {
      logAI.debug("Mock mode enabled, returning null for mock handling", {
        service: "BaseAIService",
        mockMode: true,
      });
      return null;
    }

    // Log prompts if enabled
    if (this.config.logPrompts) {
      logAI.debug("Prompt constructed", {
        service: "BaseAIService",
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        systemPromptPreview: systemPrompt.substring(0, 100),
        userPromptPreview: userPrompt.substring(0, 100),
      });
    }

    // Log AI call start
    const callStartTime = Date.now();
    logAI.info("AI call started", {
      service: "BaseAIService",
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      maxTokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
    });

    // Call the provider manager with chat completion
    const response: AIProviderResponse = await aiProviderManager.chat({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt,
      maxTokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
    });

    // Log AI call completion with provider and token usage
    const duration = Date.now() - callStartTime;
    logAI.info("AI call completed", {
      service: "BaseAIService",
      provider: response.provider,
      model: response.model,
      duration,
      inputTokens: response.usage?.promptTokens,
      outputTokens: response.usage?.completionTokens,
      totalTokens: response.usage?.totalTokens,
    });

    // Parse the response content
    return this.parseAIResponseContent(response.content);
  }

  /**
   * Make a vision AI request with images and prompts using the provider manager
   *
   * This method extends the standard callAI with vision capabilities:
   * - Supports image content blocks (base64 encoded)
   * - Uses same provider abstraction (fallback, retry)
   * - Higher token usage due to image processing
   *
   * @param systemPrompt - System prompt for the AI
   * @param userPrompt - User prompt/query for the AI
   * @param images - Array of base64 encoded images with MIME types
   * @param _userId - User ID for logging (optional)
   * @returns Parsed AI response or null if AI calls are disabled
   */
  protected async callVisionAI(
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; mimeType: string }>,
    _userId?: string
  ): Promise<any> {
    // Return null if AI calls are disabled (service will handle mock response)
    if (!this.config.enableAICalls) {
      return null;
    }

    // Check if we're in mock mode
    if (aiConfig.mockMode) {
      logAI.debug("Mock mode enabled, returning null for mock handling", {
        service: "BaseAIService",
        mockMode: true,
        visionCall: true,
      });
      return null;
    }

    // Validate images
    if (!images || images.length === 0) {
      logAI.warn("Vision AI called with no images", {
        service: "BaseAIService",
      });
      throw new Error("At least one image is required for vision AI calls");
    }

    // Log prompts if enabled
    if (this.config.logPrompts) {
      logAI.debug("Vision prompt constructed", {
        service: "BaseAIService",
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        imageCount: images.length,
        imageSizes: images.map(img => img.base64.length),
        systemPromptPreview: systemPrompt.substring(0, 100),
        userPromptPreview: userPrompt.substring(0, 100),
      });
    }

    // Log vision AI call start
    const callStartTime = Date.now();
    logAI.info("Vision AI call started", {
      service: "BaseAIService",
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      imageCount: images.length,
      totalImageDataSize: images.reduce((sum, img) => sum + img.base64.length, 0),
      maxTokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
    });

    try {
      // Call the provider manager with vision parameters
      const response: AIProviderResponse = await aiProviderManager.chat({
        messages: [{ role: "user", content: userPrompt }],
        systemPrompt,
        maxTokens: aiConfig.maxTokens,
        temperature: aiConfig.temperature,
        images, // Pass images for vision API
      });

      // Log AI call completion with provider and token usage
      const duration = Date.now() - callStartTime;
      logAI.info("Vision AI call completed", {
        service: "BaseAIService",
        provider: response.provider,
        model: response.model,
        duration,
        inputTokens: response.usage?.promptTokens,
        outputTokens: response.usage?.completionTokens,
        totalTokens: response.usage?.totalTokens,
        imageCount: images.length,
      });

      // Parse the response content
      return this.parseAIResponseContent(response.content);
    } catch (error) {
      logAI.error("Vision AI call failed", {
        service: "BaseAIService",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        imageCount: images.length,
      });
      throw error;
    }
  }

  /**
   * Parse AI response content string into structured data
   * @param content - Raw response content from the AI provider
   */
  protected parseAIResponseContent(content: string): any {
    logAI.debug("Parsing AI response content", {
      service: "BaseAIService",
      responseLength: content.length,
      responsePreview: content.substring(0, 500) + (content.length > 500 ? "..." : ""),
    });

    // Trim whitespace from content
    const trimmedContent = content.trim();

    // Strategy 1: Try to parse as direct JSON first
    try {
      const parsed = JSON.parse(trimmedContent);
      logAI.debug("Response parsed successfully - direct JSON", {
        service: "BaseAIService",
        strategy: "direct_json",
      });
      return this.validateAndNormalizeParsedResponse(parsed);
    } catch (directParseError) {
      logAI.debug("Direct JSON parse failed, trying other strategies", {
        service: "BaseAIService",
        strategy: "direct_json",
        error: (directParseError as Error).message,
      });
    }

    // Strategy 2: Extract JSON from markdown code blocks (```json ... ```)
    const markdownJsonMatch = trimmedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownJsonMatch) {
      logAI.debug("Found markdown code block in response", {
        service: "BaseAIService",
        strategy: "markdown_block",
      });
      try {
        const parsed = JSON.parse(markdownJsonMatch[1].trim());
        logAI.debug("Response parsed successfully - markdown block", {
          service: "BaseAIService",
          strategy: "markdown_block",
        });
        return this.validateAndNormalizeParsedResponse(parsed);
      } catch (markdownParseError) {
        logAI.warn("Failed to parse JSON from markdown block", {
          service: "BaseAIService",
          strategy: "markdown_block",
          error: (markdownParseError as Error).message,
        });
      }
    }

    // Strategy 3: Find JSON object that starts with { and contains "suggestions"
    // This handles cases where the AI adds preamble text before the JSON
    const jsonStartIndex = trimmedContent.indexOf('{');
    if (jsonStartIndex !== -1) {
      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEndIndex = -1;
      for (let i = jsonStartIndex; i < trimmedContent.length; i++) {
        if (trimmedContent[i] === '{') braceCount++;
        if (trimmedContent[i] === '}') braceCount--;
        if (braceCount === 0) {
          jsonEndIndex = i;
          break;
        }
      }

      if (jsonEndIndex !== -1) {
        const jsonCandidate = trimmedContent.substring(jsonStartIndex, jsonEndIndex + 1);
        logAI.debug("Extracted JSON candidate from response", {
          service: "BaseAIService",
          strategy: "json_extraction",
          candidateLength: jsonCandidate.length,
        });
        try {
          const parsed = JSON.parse(jsonCandidate);
          logAI.debug("Response parsed successfully - extracted JSON", {
            service: "BaseAIService",
            strategy: "json_extraction",
          });
          return this.validateAndNormalizeParsedResponse(parsed);
        } catch (extractedParseError) {
          logAI.warn("Failed to parse extracted JSON", {
            service: "BaseAIService",
            strategy: "json_extraction",
            error: (extractedParseError as Error).message,
          });
        }
      }
    }

    // Strategy 4: Try to find JSON array of suggestions (in case model returns different structure)
    const suggestionsArrayMatch = trimmedContent.match(/"suggestions"\s*:\s*\[([\s\S]*?)\]/);
    if (suggestionsArrayMatch) {
      logAI.debug("Found suggestions array in response", {
        service: "BaseAIService",
        strategy: "suggestions_array",
      });
      try {
        // Try to reconstruct a valid JSON object
        const reconstructed = `{"suggestions": [${suggestionsArrayMatch[1]}], "overallScore": 0, "summary": "Parsed from partial response"}`;
        const parsed = JSON.parse(reconstructed);
        logAI.debug("Response parsed successfully - reconstructed from suggestions array", {
          service: "BaseAIService",
          strategy: "suggestions_array",
        });
        return this.validateAndNormalizeParsedResponse(parsed);
      } catch (reconstructError) {
        logAI.warn("Failed to reconstruct JSON from suggestions array", {
          service: "BaseAIService",
          strategy: "suggestions_array",
          error: (reconstructError as Error).message,
        });
      }
    }

    // All parsing attempts failed - return fallback structure
    logAI.error("All parsing attempts failed, returning fallback structure", {
      service: "BaseAIService",
      contentLength: trimmedContent.length,
      contentPreview: trimmedContent.substring(0, 300),
    });
    return {
      suggestions: [],
      overallScore: 0,
      summary: "Failed to parse AI response. Raw content: " + trimmedContent.substring(0, 300),
      rawContent: trimmedContent,
      parseError: true,
    };
  }

  /**
   * Validate and normalize the parsed response to ensure it has expected structure
   *
   * IMPORTANT: This method preserves the original response structure while adding
   * default values for common fields. Different AI services expect different response
   * formats (e.g., GardenAnalysis expects suggestions, LayoutGeneration expects layouts).
   */
  private validateAndNormalizeParsedResponse(parsed: any): any {
    logAI.debug("Validating parsed response", {
      service: "BaseAIService",
      hasKeys: Object.keys(parsed || {}),
    });

    // Ensure we have a valid object
    if (!parsed || typeof parsed !== 'object') {
      logAI.warn("Validation failed - parsed response is not an object", {
        service: "BaseAIService",
        parsedType: typeof parsed,
        willRetry: false,
      });
      return {
        suggestions: [],
        overallScore: 0,
        summary: "Invalid response structure",
        rawContent: JSON.stringify(parsed),
      };
    }

    // Preserve the original response structure but add defaults for common fields
    // This allows different services to receive their expected response format
    // (e.g., layouts for LayoutGenerationService, suggestions for GardenAnalysisService)
    const normalized = {
      ...parsed, // Preserve all original fields (including layouts, etc.)
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 0,
      summary: typeof parsed.summary === 'string' ? parsed.summary : "No summary provided",
    };

    logAI.debug("Validation passed - response normalized", {
      service: "BaseAIService",
      suggestionsCount: normalized.suggestions.length,
      overallScore: normalized.overallScore,
      summaryLength: normalized.summary.length,
      hasLayouts: Array.isArray(normalized.layouts),
      layoutsCount: Array.isArray(normalized.layouts) ? normalized.layouts.length : 0,
    });

    return normalized;
  }

  /**
   * Parse AI response - can be overridden by subclasses
   * @deprecated Use parseAIResponseContent instead for new code
   */
  protected parseAIResponse(aiSuggestion: any): any {
    try {
      // Try to parse from additionalInfo first
      const data =
        aiSuggestion.additionalInfo?.analysisData ||
        JSON.parse(aiSuggestion.action);
      return data;
    } catch (error) {
      logAI.error("Failed to parse AI response in deprecated method", {
        service: "BaseAIService",
        method: "parseAIResponse",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return raw suggestion
      return {
        suggestions: [],
        overallScore: 0,
        summary: aiSuggestion.reason || "Failed to parse AI response",
      };
    }
  }

  /**
   * Parse zone string to numeric value for comparison
   */
  protected parseZone(zone: string | null): number | null {
    if (!zone) return null;
    const match = zone.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Calculate a score based on issue counts
   * Base score of 100, deduct points for issues
   */
  protected calculateScore(issues: {
    critical?: number;
    warnings?: number;
    minor?: number;
  }): number {
    const criticalDeduction = (issues.critical || 0) * 15;
    const warningDeduction = (issues.warnings || 0) * 5;
    const minorDeduction = (issues.minor || 0) * 2;

    const score = 100 - criticalDeduction - warningDeduction - minorDeduction;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Create a suggestion object
   */
  protected createSuggestion(
    type: "improvement" | "warning" | "optimization",
    category: string,
    title: string,
    description: string,
    affectedIds: string[],
    priority: "high" | "medium" | "low",
    actionable = true
  ): Suggestion {
    return {
      type,
      category,
      title,
      description,
      affectedIds,
      priority,
      actionable,
    };
  }
}
