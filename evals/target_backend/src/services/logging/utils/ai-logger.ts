import { logAI } from '../logger';

/**
 * AI provider call metadata
 */
export interface AICallMetadata {
  provider: string;
  model: string;
  operation: string;
  userId?: string;
  gardenId?: string;
  plantId?: string;
  messageCount?: number;
  [key: string]: any;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Log an AI provider call with timing
 * @param metadata Call metadata
 * @param fn Async function to execute
 * @returns Result of the function
 */
export async function logAICall<T>(
  metadata: AICallMetadata,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  logAI.info('AI provider call started', {
    provider: metadata.provider,
    model: metadata.model,
    operation: metadata.operation,
    userId: metadata.userId,
    gardenId: metadata.gardenId,
    plantId: metadata.plantId,
    messageCount: metadata.messageCount,
  });

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    logAI.info('AI provider call completed', {
      provider: metadata.provider,
      model: metadata.model,
      operation: metadata.operation,
      duration,
      userId: metadata.userId,
      gardenId: metadata.gardenId,
      plantId: metadata.plantId,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logAI.error('AI provider call failed', {
      provider: metadata.provider,
      model: metadata.model,
      operation: metadata.operation,
      duration,
      error: error.message,
      stack: error.stack,
      userId: metadata.userId,
      gardenId: metadata.gardenId,
      plantId: metadata.plantId,
    });

    throw error;
  }
}

/**
 * Log AI token usage and estimated cost
 * @param provider AI provider name
 * @param model Model name
 * @param usage Token usage
 * @param estimatedCost Estimated cost in USD (optional)
 * @param metadata Additional metadata
 */
export function logAITokenUsage(
  provider: string,
  model: string,
  usage: TokenUsage,
  estimatedCost?: number,
  metadata?: Record<string, any>
): void {
  logAI.info('AI token usage', {
    provider,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    estimatedCost,
    ...metadata,
  });
}
