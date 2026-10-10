import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

interface CorrelationContext {
  correlationId: string;
}

// AsyncLocalStorage instance for managing correlation IDs across async boundaries
const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Get the current correlation ID from async context
 * @returns The correlation ID or undefined if not set
 */
export function getCorrelationId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.correlationId;
}

/**
 * Set the correlation ID in the current async context
 * Note: This only works within a runWithCorrelationId callback
 * @param correlationId The correlation ID to set
 */
export function setCorrelationId(correlationId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.correlationId = correlationId;
  }
}

/**
 * Generate a new correlation ID using UUID v4
 * @returns A new UUID v4 correlation ID
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Run a callback with a specific correlation ID in async context
 * The correlation ID will be available to all async operations within the callback
 * @param correlationId The correlation ID to use
 * @param callback The async callback to execute
 * @returns The result of the callback
 */
export async function runWithCorrelationId<T>(
  correlationId: string,
  callback: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run({ correlationId }, callback);
}

/**
 * Run a synchronous callback with a specific correlation ID in async context
 * @param correlationId The correlation ID to use
 * @param callback The synchronous callback to execute
 * @returns The result of the callback
 */
export function runWithCorrelationIdSync<T>(
  correlationId: string,
  callback: () => T
): T {
  return asyncLocalStorage.run({ correlationId }, callback);
}
