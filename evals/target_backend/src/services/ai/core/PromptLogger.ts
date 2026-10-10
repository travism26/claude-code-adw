/**
 * Reusable utility for logging AI prompts to console
 * Useful for testing and debugging prompt engineering
 */

import { AIPrompts } from './types';
import { logAI } from '../../logging/logger';

export class PromptLogger {
  /**
   * Log prompts to console with formatted output
   */
  static log(prompts: AIPrompts, context: any, title = 'AI PROMPT'): void {
    logAI.debug("Prompt log initialized", {
      service: "PromptLogger",
      title,
      systemPromptLength: prompts.systemPrompt.length,
      userPromptLength: prompts.userPrompt.length,
      contextSize: JSON.stringify(context).length,
    });

    logAI.debug("Prompt formatted - system prompt", {
      service: "PromptLogger",
      format: "text",
      content: prompts.systemPrompt,
    });

    logAI.debug("Prompt formatted - user prompt", {
      service: "PromptLogger",
      format: "text",
      content: prompts.userPrompt,
    });

    logAI.debug("Prompt formatted - context data", {
      service: "PromptLogger",
      format: "json",
      content: JSON.stringify(context, null, 2),
    });
  }

  /**
   * Log a warning that AI calls are disabled
   */
  static logAIDisabled(): void {
    logAI.warn("Prompt logging disabled - AI calls disabled", {
      service: "PromptLogger",
      reason: "env_var",
      message: "AI_CALLS_DISABLED - Returning mock response",
    });
  }

  /**
   * Log analysis results summary
   */
  static logResults(title: string, score: number, suggestionCount: number): void {
    logAI.info("Analysis results summary", {
      service: "PromptLogger",
      title,
      score,
      suggestionCount,
      completed: true,
    });
  }

  /**
   * Log mock response summary
   */
  static logMockResponse(response: {
    suggestions: any[];
    overallScore: number;
    summary: string;
  }): void {
    logAI.debug("Mock response preview - header", {
      service: "PromptLogger",
      mockResponse: true,
    });

    logAI.debug("Mock response - summary", {
      service: "PromptLogger",
      summary: response.summary,
    });

    logAI.debug("Mock response - overall score", {
      service: "PromptLogger",
      overallScore: response.overallScore,
    });

    logAI.debug("Mock response - suggestions count", {
      service: "PromptLogger",
      totalSuggestions: response.suggestions.length,
    });

    // Log first 2 suggestions as examples
    response.suggestions.slice(0, 2).forEach((suggestion, index) => {
      logAI.debug("Mock response - suggestion preview", {
        service: "PromptLogger",
        index: index + 1,
        type: suggestion.type,
        title: suggestion.title,
        category: suggestion.category,
        priority: suggestion.priority,
        descriptionPreview: suggestion.description.substring(0, 100) + (suggestion.description.length > 100 ? '...' : ''),
        affectedCount: suggestion.affectedIds?.length || 0,
      });
    });

    if (response.suggestions.length > 2) {
      logAI.debug("Mock response - additional suggestions", {
        service: "PromptLogger",
        additionalCount: response.suggestions.length - 2,
      });
    }
  }
}
