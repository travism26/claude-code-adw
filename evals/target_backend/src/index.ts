import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import routes from "./routes";
import { getSequelize } from "./config/sequelize";
import { initializeModels } from "./models";
import { initializeQueues, shutdownQueues, areQueuesHealthy } from "./services/queue";
import { Server, createServer } from "http";
import { WebSocketService } from "./services/websocket";
import { GardenEventHandler } from "./services/events";
import { correlationMiddleware } from "./services/logging/middleware/correlation";
import { requestLoggingMiddleware } from "./services/logging/middleware/request";
import { errorLoggingMiddleware } from "./services/logging/middleware/error";
import { logApi } from "./services/logging/logger";

const app: Express = express();

// Logging middleware - MUST be first to capture all requests
app.use(correlationMiddleware);
app.use(requestLoggingMiddleware);

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api", routes);

// Error logging middleware - MUST be after routes
app.use(errorLoggingMiddleware);

// Health check endpoint
let wsService: WebSocketService | null = null;
let gardenEventHandler: GardenEventHandler | null = null;

app.get("/health", async (req, res) => {
  const queueHealthy = await areQueuesHealthy();
  const wsStats = wsService ? wsService.getStats() : { status: "not_initialized", totalConnections: 0, totalUsers: 0 };

  res.json({
    status: "healthy",
    queue: queueHealthy ? "connected" : "disconnected",
    websocket: wsStats.status,
    websocketConnections: wsStats.totalConnections,
    websocketUsers: wsStats.totalUsers
  });
});

// Connect to database and start server
const PORT = process.env.PORT || 3000;
let server: Server;
let httpServer: Server;

const start = async () => {
  try {
    logApi.info("Connecting to database...");
    const sequelize = await getSequelize();
    await sequelize.authenticate();
    logApi.info("Database connection established");

    // Initialize models before syncing
    await initializeModels();

    // Sync models in development
    if (process.env.NODE_ENV === "development") {
      await sequelize.sync();
      logApi.info("Database models synchronized");
    }

    // Initialize queue service (API server only enqueues jobs, does NOT process them)
    // Worker process runs separately via: npm run start:worker
    logApi.info("Initializing queue service...");
    await initializeQueues();

    // Check queue health
    const queueHealthy = await areQueuesHealthy();
    if (queueHealthy) {
      logApi.info("Queue service connected to Redis successfully");
    } else {
      logApi.warn("Queue service Redis connection failed - queue features may not work");
    }

    logApi.info("NOTE: Worker process must be started separately with: npm run start:worker");

    // Initialize garden event handler
    logApi.info("Initializing garden event handler...");
    gardenEventHandler = new GardenEventHandler();
    gardenEventHandler.initialize();
    logApi.info("Garden event handler initialized successfully");

    // Create HTTP server (needed for Socket.IO)
    httpServer = createServer(app);

    // Initialize WebSocket service
    logApi.info("Initializing WebSocket service...");
    wsService = new WebSocketService(httpServer, sequelize);
    logApi.info("WebSocket service initialized successfully");

    // Start HTTP server
    server = httpServer;
    httpServer.listen(PORT, () => {
      logApi.info("Server running", { port: PORT });
      logApi.info("WebSocket server ready", { port: PORT });
    });
  } catch (error) {
    logApi.error("Error starting server", { error });
    process.exit(1);
  }
};

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  logApi.info("Starting graceful shutdown", { signal });

  try {
    // Shutdown WebSocket service first
    if (wsService) {
      logApi.info("Shutting down WebSocket service...");
      await wsService.shutdown();
      logApi.info("WebSocket service shutdown complete");
    }

    // Shutdown garden event handler
    if (gardenEventHandler) {
      logApi.info("Shutting down garden event handler...");
      await gardenEventHandler.shutdown();
      logApi.info("Garden event handler shutdown complete");
    }

    // Shutdown queue service (worker runs in separate process)
    logApi.info("Shutting down queue service...");
    await shutdownQueues();
    logApi.info("Queue service shutdown complete");

    // Stop accepting new connections
    if (server) {
      server.close(() => {
        logApi.info("HTTP server closed");
      });
    }

    logApi.info("Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    logApi.error("Error during shutdown", { error });
    process.exit(1);
  }
};

// Register shutdown handlers
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
