/**
 * Garden Event Handler
 *
 * Listens to garden plot CRUD events and triggers debounced AI analysis.
 * Implements debouncing to avoid triggering analysis on every single change.
 *
 * Pattern:
 * 1. User creates/updates/deletes plot
 * 2. Event published to MessageBus
 * 3. This handler receives event and starts/resets debounce timer (5 seconds)
 * 4. After 5 seconds of no changes, enqueues garden_analysis job
 * 5. Worker processes job, publishes GARDEN_ANALYSIS_COMPLETED event
 */

import {
  messageBus,
  MessageBusEvent,
  GardenPlotCreatedPayload,
  GardenPlotUpdatedPayload,
  GardenPlotDeletedPayload,
} from "../messageBus";
import { queueGardenAnalysisJob } from "../queue";
import { logApi } from "../logging/logger";

/**
 * Configuration for debouncing
 */
const DEBOUNCE_DELAY_MS = 5000; // 5 seconds

/**
 * Handles garden events and triggers debounced AI analysis
 */
export class GardenEventHandler {
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private inFlightAnalysis: Set<string>;
  private unsubscribeFunctions: Array<() => void>;

  constructor() {
    this.debounceTimers = new Map();
    this.inFlightAnalysis = new Set();
    this.unsubscribeFunctions = [];
  }

  /**
   * Initialize the handler and subscribe to events
   */
  public initialize(): void {
    logApi.info('Garden event handler initialized', {
      registeredEvents: [
        MessageBusEvent.GARDEN_PLOT_CREATED,
        MessageBusEvent.GARDEN_PLOT_UPDATED,
        MessageBusEvent.GARDEN_PLOT_DELETED
      ]
    });

    // Subscribe to all garden plot events
    this.unsubscribeFunctions.push(
      messageBus.subscribe(
        MessageBusEvent.GARDEN_PLOT_CREATED,
        this.handleGardenPlotEvent.bind(this)
      )
    );

    this.unsubscribeFunctions.push(
      messageBus.subscribe(
        MessageBusEvent.GARDEN_PLOT_UPDATED,
        this.handleGardenPlotEvent.bind(this)
      )
    );

    this.unsubscribeFunctions.push(
      messageBus.subscribe(
        MessageBusEvent.GARDEN_PLOT_DELETED,
        this.handleGardenPlotEvent.bind(this)
      )
    );

    logApi.debug('Subscribed to garden plot events', {
      eventCount: this.unsubscribeFunctions.length
    });
  }

  /**
   * Handle garden plot events (created/updated/deleted)
   * Implements debouncing logic per garden
   */
  private async handleGardenPlotEvent(
    payload:
      | GardenPlotCreatedPayload
      | GardenPlotUpdatedPayload
      | GardenPlotDeletedPayload
  ): Promise<void> {
    const { gardenId, userId, plotId } = payload;

    logApi.debug('Garden plot event received', {
      eventType: 'timestamp' in payload ? MessageBusEvent.GARDEN_PLOT_CREATED : MessageBusEvent.GARDEN_PLOT_UPDATED,
      gardenId,
      plotId,
      userId
    });

    // Clear existing timer for this garden if any
    const existingTimer = this.debounceTimers.get(gardenId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      logApi.debug('Cleared existing debounce timer', {
        gardenId
      });
    }

    // Start new debounce timer
    const timer = setTimeout(() => {
      this.triggerGardenAnalysis(gardenId, userId);
    }, DEBOUNCE_DELAY_MS);

    this.debounceTimers.set(gardenId, timer);

    logApi.debug('Debounce timer started', {
      gardenId,
      delayMs: DEBOUNCE_DELAY_MS
    });
  }

  /**
   * Trigger garden analysis by enqueueing a job
   * Prevents duplicate analysis for the same garden
   */
  private async triggerGardenAnalysis(
    gardenId: string,
    userId: string
  ): Promise<void> {
    try {
      // Remove the timer from the map
      this.debounceTimers.delete(gardenId);

      // Check if analysis is already in progress for this garden
      if (this.inFlightAnalysis.has(gardenId)) {
        logApi.warn('Event handler skipped', {
          gardenId,
          reason: 'analysis_already_in_progress'
        });
        return;
      }

      // Mark as in-flight
      this.inFlightAnalysis.add(gardenId);

      logApi.info('Enqueueing garden analysis job', {
        gardenId,
        userId,
        triggeredBy: 'garden_plot_change'
      });

      // Enqueue the analysis job using singleton queue
      const job = await queueGardenAnalysisJob({
        gardenId,
        userId,
        triggeredBy: "garden_plot_change",
        timestamp: new Date().toISOString(),
      });

      logApi.info('Garden analysis job enqueued', {
        gardenId,
        userId,
        jobId: job.id
      });

      // Clean up in-flight tracking after a reasonable timeout (e.g., 5 minutes)
      // This prevents the set from growing indefinitely if a job fails silently
      setTimeout(() => {
        this.inFlightAnalysis.delete(gardenId);
        logApi.debug('Cleared in-flight tracking', {
          gardenId
        });
      }, 5 * 60 * 1000); // 5 minutes
    } catch (error) {
      logApi.error('Failed to enqueue garden analysis', {
        gardenId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Remove from in-flight on error
      this.inFlightAnalysis.delete(gardenId);
    }
  }

  /**
   * Shutdown the handler and clean up resources
   */
  public async shutdown(): Promise<void> {
    logApi.info('Garden event handler shutting down', {
      pendingTimers: this.debounceTimers.size,
      subscribers: this.unsubscribeFunctions.length
    });

    // Clear all pending timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Unsubscribe from all events
    for (const unsubscribe of this.unsubscribeFunctions) {
      unsubscribe();
    }
    this.unsubscribeFunctions = [];

    // Queue is managed globally, no need to close it here

    logApi.info('Garden event handler shutdown complete', {});
  }

  /**
   * Get current status for monitoring/debugging
   */
  public getStatus(): {
    pendingDebounces: number;
    inFlightAnalysis: number;
  } {
    return {
      pendingDebounces: this.debounceTimers.size,
      inFlightAnalysis: this.inFlightAnalysis.size,
    };
  }
}
