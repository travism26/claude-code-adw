import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { Sequelize } from 'sequelize';
import { User } from '../../models';
import { messageBus, MessageBusEvent, AIResultReadyPayload, AITaskFailedPayload, AITaskStartedPayload, AITaskCompletedPayload, NotificationCreatedPayload, GardenAnalysisCompletedPayload } from '../messageBus';
import { getWebSocketConfig, WEBSOCKET_EVENTS, WEBSOCKET_ROOMS, MAX_CONNECTIONS_PER_USER } from '../../config/websocket';
import { logApi } from '../logging/logger';
import { notificationService } from '../notificationService';

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Extended Socket interface with authenticated user data
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: User;
}

/**
 * WebSocket Service
 *
 * Manages real-time WebSocket connections using Socket.IO.
 * Subscribes to message bus events and emits notifications to connected clients.
 * Implements authentication, user-specific rooms, and connection management.
 */
export class WebSocketService {
  private io: SocketIOServer;
  private sequelize: Sequelize;
  private config: ReturnType<typeof getWebSocketConfig>;
  private jwtSecret: string;
  private userConnections: Map<string, Set<string>>; // userId -> Set of socket IDs
  private unsubscribeFunctions: Array<() => void> = [];

  constructor(httpServer: HTTPServer, sequelize: Sequelize) {
    this.config = getWebSocketConfig();
    this.sequelize = sequelize;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.userConnections = new Map();

    // Initialize Socket.IO server
    this.io = new SocketIOServer(httpServer, this.config);

    // Set up authentication middleware if required
    if (this.config.authRequired) {
      this.io.use(this.authenticationMiddleware.bind(this));
    }

    // Set up event handlers
    this.setupEventHandlers();

    // Subscribe to message bus events
    this.subscribeToMessageBus();

    logApi.info('WebSocket server started', {
      path: this.config.path,
      authRequired: this.config.authRequired,
    });
  }

  /**
   * Authentication middleware for Socket.IO connections
   */
  private async authenticationMiddleware(
    socket: AuthenticatedSocket,
    next: (err?: Error) => void
  ): Promise<void> {
    try {
      // Get token from handshake auth or query params
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token as string;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;

      // Find user in database
      const user = await User.findByPk(payload.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      // Check connection limit per user
      const userSocketIds = this.userConnections.get(user.id) || new Set();
      if (userSocketIds.size >= MAX_CONNECTIONS_PER_USER) {
        return next(new Error('Maximum connections per user exceeded'));
      }

      // Attach user data to socket
      socket.userId = user.id;
      socket.user = user;

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new Error('Invalid authentication token'));
      }
      if (error instanceof jwt.TokenExpiredError) {
        return next(new Error('Authentication token expired'));
      }
      logApi.error('WebSocket server error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: 'authentication',
      });
      return next(new Error('Authentication failed'));
    }
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on(WEBSOCKET_EVENTS.CONNECTION, (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);

      socket.on(WEBSOCKET_EVENTS.DISCONNECT, () => {
        this.handleDisconnection(socket);
      });

      socket.on(WEBSOCKET_EVENTS.ERROR, (error: Error) => {
        this.handleError(socket, error);
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    const ipAddress = socket.handshake.address;

    if (!userId) {
      logApi.warn('Client authentication failed', {
        clientId: socket.id,
        reason: 'missing_userId',
        ipAddress,
      });
      socket.disconnect(true);
      return;
    }

    // Track connection
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socket.id);

    // Join user-specific room
    socket.join(WEBSOCKET_ROOMS.user(userId));

    logApi.info('Client connected', {
      clientId: socket.id,
      userId,
      ipAddress,
    });

    logApi.debug('Client authenticated', {
      clientId: socket.id,
      userId,
      method: 'jwt',
    });

    logApi.debug('Client joined room', {
      clientId: socket.id,
      roomId: WEBSOCKET_ROOMS.user(userId),
      roomSize: this.userConnections.get(userId)!.size,
    });

    // Emit authentication success
    socket.emit(WEBSOCKET_EVENTS.AUTHENTICATED, {
      message: 'Successfully authenticated',
      userId,
      socketId: socket.id,
    });

    // Log connection stats
    this.logConnectionStats();
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId;

    if (userId) {
      // Calculate connection duration
      const connectTime = socket.handshake.time ? new Date(socket.handshake.time) : new Date();
      const duration = Date.now() - connectTime.getTime();

      logApi.info('Client disconnected', {
        clientId: socket.id,
        userId,
        duration,
        reason: 'client_disconnect',
      });

      logApi.debug('Client left room', {
        clientId: socket.id,
        roomId: WEBSOCKET_ROOMS.user(userId),
        roomSize: Math.max(0, (this.userConnections.get(userId)?.size || 1) - 1),
      });

      // Remove from tracking
      const userSocketIds = this.userConnections.get(userId);
      if (userSocketIds) {
        userSocketIds.delete(socket.id);
        if (userSocketIds.size === 0) {
          this.userConnections.delete(userId);
        }
      }

      // Log connection stats
      this.logConnectionStats();
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(socket: AuthenticatedSocket, error: Error): void {
    logApi.error('WebSocket server error', {
      clientId: socket.id,
      userId: socket.userId,
      error: error.message,
      stack: error.stack,
      affectedClients: 1,
    });
    socket.emit(WEBSOCKET_EVENTS.AUTHENTICATION_ERROR, {
      error: error.message,
    });
  }

  /**
   * Subscribe to message bus events
   */
  private subscribeToMessageBus(): void {
    // Subscribe to AI result ready events
    const unsubAIResultReady = messageBus.subscribe(
      MessageBusEvent.AI_RESULT_READY,
      this.handleAIResultReady.bind(this)
    );
    this.unsubscribeFunctions.push(unsubAIResultReady);

    // Subscribe to AI task failed events
    const unsubAITaskFailed = messageBus.subscribe(
      MessageBusEvent.AI_TASK_FAILED,
      this.handleAITaskFailed.bind(this)
    );
    this.unsubscribeFunctions.push(unsubAITaskFailed);

    // Subscribe to AI task started events
    const unsubAITaskStarted = messageBus.subscribe(
      MessageBusEvent.AI_TASK_STARTED,
      this.handleAITaskStarted.bind(this)
    );
    this.unsubscribeFunctions.push(unsubAITaskStarted);

    // Subscribe to AI task completed events
    const unsubAITaskCompleted = messageBus.subscribe(
      MessageBusEvent.AI_TASK_COMPLETED,
      this.handleAITaskCompleted.bind(this)
    );
    this.unsubscribeFunctions.push(unsubAITaskCompleted);

    // Subscribe to notification created events
    const unsubNotificationCreated = messageBus.subscribe(
      MessageBusEvent.NOTIFICATION_CREATED,
      this.handleNotificationCreated.bind(this)
    );
    this.unsubscribeFunctions.push(unsubNotificationCreated);

    // Subscribe to garden analysis completed events
    const unsubGardenAnalysisCompleted = messageBus.subscribe(
      MessageBusEvent.GARDEN_ANALYSIS_COMPLETED,
      this.handleGardenAnalysisCompleted.bind(this)
    );
    this.unsubscribeFunctions.push(unsubGardenAnalysisCompleted);

    logApi.debug('WebSocket service subscribed to message bus events', {
      eventCount: this.unsubscribeFunctions.length,
    });
  }

  /**
   * Handle AI result ready event from message bus
   */
  private async handleAIResultReady(payload: AIResultReadyPayload): Promise<void> {
    try {
      const { userId, taskId, suggestion, plantId, timestamp } = payload;

      const recipientCount = this.io.to(WEBSOCKET_ROOMS.user(userId)).fetchSockets().then(sockets => sockets.length);

      // Emit to user-specific room
      this.io.to(WEBSOCKET_ROOMS.user(userId)).emit(WEBSOCKET_EVENTS.AI_SUGGESTION_READY, {
        taskId,
        suggestion,
        plantId,
        timestamp: timestamp.toISOString(),
        type: 'success',
      });

      logApi.debug('Message sent', {
        userId,
        messageType: 'ai_suggestion_ready',
        taskId,
        recipientCount: await recipientCount,
      });
    } catch (error) {
      logApi.error('Message delivery failed', {
        userId: payload.userId,
        messageType: 'ai_suggestion_ready',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle AI task failed event from message bus
   */
  private async handleAITaskFailed(payload: AITaskFailedPayload): Promise<void> {
    try {
      const { userId, taskId, error, timestamp } = payload;

      const recipientCount = this.io.to(WEBSOCKET_ROOMS.user(userId)).fetchSockets().then(sockets => sockets.length);

      // Emit to user-specific room
      this.io.to(WEBSOCKET_ROOMS.user(userId)).emit(WEBSOCKET_EVENTS.AI_TASK_FAILED, {
        taskId,
        error,
        timestamp: timestamp.toISOString(),
        type: 'error',
      });

      logApi.debug('Message sent', {
        userId,
        messageType: 'ai_task_failed',
        taskId,
        recipientCount: await recipientCount,
      });
    } catch (error) {
      logApi.error('Message delivery failed', {
        userId: payload.userId,
        messageType: 'ai_task_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle AI task started event from message bus
   */
  private async handleAITaskStarted(payload: AITaskStartedPayload): Promise<void> {
    try {
      const { userId, taskId, timestamp } = payload;

      const recipientCount = this.io.to(WEBSOCKET_ROOMS.user(userId)).fetchSockets().then(sockets => sockets.length);

      // Emit to user-specific room
      this.io.to(WEBSOCKET_ROOMS.user(userId)).emit(WEBSOCKET_EVENTS.AI_TASK_STARTED, {
        taskId,
        timestamp: timestamp.toISOString(),
        type: 'info',
      });

      logApi.debug('Message sent', {
        userId,
        messageType: 'ai_task_started',
        taskId,
        recipientCount: await recipientCount,
      });
    } catch (error) {
      logApi.error('Message delivery failed', {
        userId: payload.userId,
        messageType: 'ai_task_started',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle AI task completed event from message bus
   * Uses enriched payload data to avoid database lookups
   */
  private async handleAITaskCompleted(payload: AITaskCompletedPayload): Promise<void> {
    try {
      const { taskId, userId, taskType } = payload;

      // Generate task-type-specific notification content from payload
      const { message, link } = this.getNotificationContent(payload);

      // Create notification via notificationService
      await notificationService.sendNotification(userId, message, link, 'success');

      logApi.debug('AI task completion notification created', {
        taskId,
        userId,
        taskType,
        message,
        hasLink: !!link,
      });
    } catch (error) {
      logApi.error('Error handling AI task completed event', {
        taskId: payload.taskId,
        userId: payload.userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Handle notification created event from message bus
   */
  private async handleNotificationCreated(payload: NotificationCreatedPayload): Promise<void> {
    try {
      const { notificationId, userId, message, link, type, timestamp } = payload;

      const recipientCount = this.io.to(WEBSOCKET_ROOMS.user(userId)).fetchSockets().then(sockets => sockets.length);

      // Emit to user-specific room
      this.io.to(WEBSOCKET_ROOMS.user(userId)).emit(WEBSOCKET_EVENTS.NOTIFICATION, {
        id: notificationId,
        message,
        link,
        type: type || 'info',
        timestamp: timestamp.toISOString(),
      });

      logApi.debug('Message sent', {
        userId,
        messageType: 'notification',
        notificationId,
        recipientCount: await recipientCount,
      });
    } catch (error) {
      logApi.error('Message delivery failed', {
        userId: payload.userId,
        messageType: 'notification',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle garden analysis completed event from message bus
   */
  private async handleGardenAnalysisCompleted(payload: GardenAnalysisCompletedPayload): Promise<void> {
    try {
      const { gardenId, userId, analysisId, overallScore, suggestionCount, timestamp } = payload;

      const recipientCount = this.io.to(WEBSOCKET_ROOMS.user(userId)).fetchSockets().then(sockets => sockets.length);

      // Emit to user-specific room
      this.io.to(WEBSOCKET_ROOMS.user(userId)).emit(WEBSOCKET_EVENTS.GARDEN_ANALYSIS_COMPLETED, {
        gardenId,
        analysisId,
        overallScore,
        suggestionCount,
        timestamp: timestamp.toISOString(),
        type: 'success',
      });

      logApi.debug('Message sent', {
        userId,
        messageType: 'garden_analysis_completed',
        gardenId,
        recipientCount: await recipientCount,
      });
    } catch (error) {
      logApi.error('Message delivery failed', {
        userId: payload.userId,
        messageType: 'garden_analysis_completed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate task-type-specific notification content
   * Uses enriched payload data instead of database model
   */
  private getNotificationContent(payload: AITaskCompletedPayload): { message: string; link?: string } {
    const { taskType, plantId, requestPayload } = payload;

    switch (taskType) {
      case 'garden_analysis': {
        const gardenId = requestPayload?.gardenId;
        return {
          message: 'Your garden analysis is complete! View your recommendations.',
          link: gardenId ? `/garden-planner/${gardenId}` : '/dashboard',
        };
      }

      case 'plant_update_suggestion':
        return {
          message: 'New care suggestions available for your plant.',
          link: plantId ? `/plants/${plantId}` : '/dashboard',
        };

      case 'care_recommendation':
        return {
          message: 'Your personalized care plan is ready.',
          link: plantId ? `/plants/${plantId}` : '/dashboard',
        };

      case 'pest_diagnosis':
        return {
          message: 'Pest diagnosis complete. View treatment recommendations.',
          link: plantId ? `/plants/${plantId}` : '/dashboard',
        };

      case 'weather_based_action':
        return {
          message: 'Weather-based action plan is ready.',
          link: '/dashboard',
        };

      case 'general':
      default:
        return {
          message: 'Your AI task is complete.',
          link: '/dashboard',
        };
    }
  }

  /**
   * Log connection statistics
   */
  private logConnectionStats(): void {
    const totalUsers = this.userConnections.size;
    const totalConnections = Array.from(this.userConnections.values()).reduce(
      (sum, socketIds) => sum + socketIds.size,
      0
    );

    logApi.info('Connection pool stats', {
      activeConnections: totalConnections,
      rooms: totalUsers,
      totalMessages: 0, // Could track this with a counter if needed
    });
  }

  /**
   * Get connection statistics
   */
  public getStats(): { totalUsers: number; totalConnections: number; status: string } {
    const totalUsers = this.userConnections.size;
    const totalConnections = Array.from(this.userConnections.values()).reduce(
      (sum, socketIds) => sum + socketIds.size,
      0
    );

    return {
      totalUsers,
      totalConnections,
      status: 'connected',
    };
  }

  /**
   * Get user connection count
   */
  public getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size || 0;
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.userConnections.has(userId) && this.userConnections.get(userId)!.size > 0;
  }

  /**
   * Gracefully shutdown the WebSocket service
   */
  public async shutdown(): Promise<void> {
    const startTime = Date.now();
    const totalConnections = Array.from(this.userConnections.values()).reduce(
      (sum, socketIds) => sum + socketIds.size,
      0
    );

    logApi.info('Shutting down WebSocket service', {
      activeConnections: totalConnections,
    });

    // Unsubscribe from message bus events
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];

    // Disconnect all clients
    this.io.disconnectSockets();

    // Close the server
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        const uptime = Date.now() - startTime;
        logApi.info('WebSocket server stopped', {
          uptime,
          totalConnections,
        });
        resolve();
      });
    });
  }

  /**
   * Get the Socket.IO server instance (for testing purposes)
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}
