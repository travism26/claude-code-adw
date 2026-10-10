import EventEmitter from 'events';
import { logApi } from './logging/logger';

/**
 * Event types for the message bus
 */
export enum MessageBusEvent {
  AI_RESULT_READY = 'ai_result_ready',
  AI_TASK_COMPLETED = 'ai_task_completed',
  AI_TASK_FAILED = 'ai_task_failed',
  AI_TASK_STARTED = 'ai_task_started',
  NOTIFICATION_CREATED = 'notification_created',
  NOTIFICATION_READ = 'notification_read',
  GARDEN_PLOT_CREATED = 'garden_plot_created',
  GARDEN_PLOT_UPDATED = 'garden_plot_updated',
  GARDEN_PLOT_DELETED = 'garden_plot_deleted',
  GARDEN_ANALYSIS_COMPLETED = 'garden_analysis_completed',
  GROW_ANALYSIS_COMPLETED = 'grow_analysis_completed',
  GROW_PHOTO_ANALYSIS_COMPLETED = 'grow_photo_analysis_completed',
  GROW_NUTRIENT_RECOMMENDATION_COMPLETED = 'grow_nutrient_recommendation_completed',
}

/**
 * Payload for AI result ready event
 */
export interface AIResultReadyPayload {
  taskId: string;
  userId: string;
  plantId?: string;
  suggestion: {
    type: string;
    content: string;
    confidence?: number;
    actionItems?: string[];
  };
  timestamp: Date;
}

/**
 * Payload for AI task completed event
 * Enriched with all task data to avoid DB lookups in event handlers
 */
export interface AITaskCompletedPayload {
  taskId: string;
  userId: string;
  taskType: string;
  plantId?: string;
  requestPayload?: any;
  timestamp: Date;
}

/**
 * Payload for AI task failed event
 */
export interface AITaskFailedPayload {
  taskId: string;
  userId: string;
  error: string;
  timestamp: Date;
}

/**
 * Payload for AI task started event
 */
export interface AITaskStartedPayload {
  taskId: string;
  userId: string;
  timestamp: Date;
}

/**
 * Payload for notification created event
 */
export interface NotificationCreatedPayload {
  notificationId: string;
  userId: string;
  message: string;
  link?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

/**
 * Payload for notification read event
 */
export interface NotificationReadPayload {
  notificationId: string;
  userId: string;
  timestamp: Date;
}

/**
 * Payload for garden plot created event
 */
export interface GardenPlotCreatedPayload {
  gardenId: string;
  plotId: string;
  userId: string;
  timestamp: Date;
}

/**
 * Payload for garden plot updated event
 */
export interface GardenPlotUpdatedPayload {
  gardenId: string;
  plotId: string;
  userId: string;
  timestamp: Date;
}

/**
 * Payload for garden plot deleted event
 */
export interface GardenPlotDeletedPayload {
  gardenId: string;
  plotId: string;
  userId: string;
  timestamp: Date;
}

/**
 * Payload for garden analysis completed event
 */
export interface GardenAnalysisCompletedPayload {
  gardenId: string;
  userId: string;
  analysisId: string;
  overallScore: number;
  suggestionCount: number;
  timestamp: Date;
}

/**
 * Payload for grow analysis completed event
 */
export interface GrowAnalysisCompletedPayload {
  growId: string;
  userId: string;
  analysisId: string;
  analysisType: string;
  overallScore: number;
  suggestionCount: number;
  timestamp: Date;
}

/**
 * Payload for grow photo analysis completed event
 */
export interface GrowPhotoAnalysisCompletedPayload {
  photoId: string;
  logId: string;
  userId: string;
  aiTaskId?: string;
  overallHealth: string;
  issueCount: number;
  confidence: number;
  timestamp: Date;
}

/**
 * Payload for grow nutrient recommendation completed event
 * Includes full recommendation for immediate display via WebSocket
 */
export interface GrowNutrientRecommendationCompletedPayload {
  growId: string;
  userId: string;
  taskId?: string;
  recommendationType: string;
  totalWeeks: number;
  recommendation: any; // Full recommendation object for display
  timestamp: Date;
}

/**
 * Type-safe event payloads mapping
 */
export type MessageBusEventPayloads = {
  [MessageBusEvent.AI_RESULT_READY]: AIResultReadyPayload;
  [MessageBusEvent.AI_TASK_COMPLETED]: AITaskCompletedPayload;
  [MessageBusEvent.AI_TASK_FAILED]: AITaskFailedPayload;
  [MessageBusEvent.AI_TASK_STARTED]: AITaskStartedPayload;
  [MessageBusEvent.NOTIFICATION_CREATED]: NotificationCreatedPayload;
  [MessageBusEvent.NOTIFICATION_READ]: NotificationReadPayload;
  [MessageBusEvent.GARDEN_PLOT_CREATED]: GardenPlotCreatedPayload;
  [MessageBusEvent.GARDEN_PLOT_UPDATED]: GardenPlotUpdatedPayload;
  [MessageBusEvent.GARDEN_PLOT_DELETED]: GardenPlotDeletedPayload;
  [MessageBusEvent.GARDEN_ANALYSIS_COMPLETED]: GardenAnalysisCompletedPayload;
  [MessageBusEvent.GROW_ANALYSIS_COMPLETED]: GrowAnalysisCompletedPayload;
  [MessageBusEvent.GROW_PHOTO_ANALYSIS_COMPLETED]: GrowPhotoAnalysisCompletedPayload;
  [MessageBusEvent.GROW_NUTRIENT_RECOMMENDATION_COMPLETED]: GrowNutrientRecommendationCompletedPayload;
};

/**
 * MessageBus - Internal event emitter for service-to-service communication
 *
 * This singleton provides a type-safe, decoupled communication mechanism
 * between services. It allows services to publish events without knowing
 * about subscribers, maintaining clean separation of concerns.
 *
 * @example
 * ```typescript
 * // Publishing an event
 * messageBus.publish(MessageBusEvent.AI_RESULT_READY, {
 *   taskId: '123',
 *   userId: 'user-456',
 *   suggestion: { type: 'care', content: 'Water your plant' },
 *   timestamp: new Date()
 * });
 *
 * // Subscribing to events
 * const unsubscribe = messageBus.subscribe(
 *   MessageBusEvent.AI_RESULT_READY,
 *   (payload) => {
 *     console.log('AI result ready:', payload);
 *   }
 * );
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
class MessageBus extends EventEmitter {
  private static instance: MessageBus;

  private constructor() {
    super();
    // Increase max listeners to prevent warnings in development
    this.setMaxListeners(50);
    logApi.info('Message bus initialized', {
      maxListeners: 50
    });
  }

  /**
   * Get singleton instance of the message bus
   */
  public static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  /**
   * Publish an event to the message bus
   *
   * @param event - The event type to publish
   * @param payload - The event payload
   */
  public publish<E extends MessageBusEvent>(
    event: E,
    payload: MessageBusEventPayloads[E]
  ): void {
    try {
      const subscriberCount = this.listenerCount(event);

      if (subscriberCount === 0) {
        logApi.warn('No subscribers for published event', {
          event,
          payloadType: typeof payload
        });
      }

      this.emit(event, payload);

      logApi.debug('Event published successfully', {
        event,
        subscriberCount
      });
    } catch (error) {
      logApi.error('Error publishing event', {
        event,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw - we don't want event publishing failures to break the calling service
    }
  }

  /**
   * Subscribe to an event on the message bus
   *
   * @param event - The event type to subscribe to
   * @param handler - The callback function to handle the event
   * @returns Unsubscribe function
   */
  public subscribe<E extends MessageBusEvent>(
    event: E,
    handler: (payload: MessageBusEventPayloads[E]) => void | Promise<void>
  ): () => void {
    const wrappedHandler = async (payload: MessageBusEventPayloads[E]) => {
      const startTime = Date.now();
      try {
        await handler(payload);
        const duration = Date.now() - startTime;
        logApi.debug('Event handler executed successfully', {
          event,
          duration
        });
      } catch (error) {
        logApi.error('Error in event handler', {
          event,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        // Don't throw - we don't want handler errors to affect other subscribers
      }
    };

    this.on(event, wrappedHandler);

    const handlerCount = this.listenerCount(event);
    logApi.debug('Event subscriber registered', {
      event,
      handlerCount
    });

    // Return unsubscribe function
    return () => {
      this.off(event, wrappedHandler);
      logApi.debug('Event subscriber unregistered', {
        event
      });
    };
  }

  /**
   * Subscribe to an event with one-time handler
   *
   * @param event - The event type to subscribe to
   * @param handler - The callback function to handle the event (called once)
   */
  public subscribeOnce<E extends MessageBusEvent>(
    event: E,
    handler: (payload: MessageBusEventPayloads[E]) => void | Promise<void>
  ): void {
    const wrappedHandler = async (payload: MessageBusEventPayloads[E]) => {
      try {
        await handler(payload);
      } catch (error) {
        logApi.error('Error in one-time event handler', {
          event,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    };

    this.once(event, wrappedHandler);

    logApi.debug('One-time subscriber registered', {
      event
    });
  }

  /**
   * Get the count of listeners for a specific event
   *
   * @param event - The event type
   * @returns Number of listeners
   */
  public getListenerCount(event: MessageBusEvent): number {
    return this.listenerCount(event);
  }

  /**
   * Remove all listeners for a specific event or all events
   *
   * @param event - Optional event type to clear. If not provided, clears all events.
   */
  public clear(event?: MessageBusEvent): void {
    if (event) {
      this.removeAllListeners(event);
    } else {
      this.removeAllListeners();
      logApi.debug('Clearing all subscribers', {});
    }
  }

  /**
   * For testing purposes - reset the singleton instance
   * @internal
   */
  public static resetInstance(): void {
    if (MessageBus.instance) {
      MessageBus.instance.removeAllListeners();
      MessageBus.instance = null as any;
    }
  }
}

// Export singleton instance
export const messageBus = MessageBus.getInstance();

// Also export the class for testing
export { MessageBus };
