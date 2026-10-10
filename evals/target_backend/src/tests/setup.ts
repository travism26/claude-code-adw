import { Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import { User, Plant, JournalEntry } from '../models';
import { initializeModels } from '../models';
import express, { Express } from 'express';
import request, { Test } from 'supertest';
import routes from '../routes';

// Singleton instance
let testHelperInstance: TestHelper | null = null;

// Determine database name based on worker ID for parallel test execution
// Mocha worker IDs can be 1-based or non-sequential, so we map them to 0-3
const PARALLEL_WORKERS = 4;
const rawWorkerId = process.env.MOCHA_WORKER_ID;
const workerId = rawWorkerId ? (parseInt(rawWorkerId, 10) % PARALLEL_WORKERS).toString() : '0';
const testDbName = `growbuddy_test_${workerId}`;

// Test database configuration
// Host/port/credentials are env-overridable (same vars as src/config/sequelize.ts)
// so the test suite can target containerized services; defaults are unchanged.
export const testSequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: testDbName,
  logging: false,
  // Add these options to help with connection issues
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  // Add this to help with connection timeouts
  dialectOptions: {
    connectTimeout: 60000,
  },
});

// Log which database this worker is using (suppress with TEST_QUIET=1)
if (!process.env.TEST_QUIET) {
  console.log(`Test worker ${workerId} using database: ${testDbName}`);
}

// TestHelper class for more advanced testing scenarios
interface TestConfig {
  database: {
    sequelize: Sequelize;
  };
  auth: {
    defaultPassword: string;
    defaultEmail: string;
  };
}

export class TestHelper {
  private config: TestConfig;
  private testUser: User | null = null;
  private app: Express;
  private User: typeof User | null = null;
  private Plant: typeof Plant | null = null;
  private JournalEntry: typeof JournalEntry | null = null;
  private sequelize: Sequelize | null = null;

  constructor(config: TestConfig) {
    this.config = config;
    this.app = express();
    this.app.use(express.json());
    this.app.use('/api', routes);
  }

  async initialize() {
    const quiet = !!process.env.TEST_QUIET;
    try {
      if (!quiet) console.log('Testing database connection...');
      await this.config.database.sequelize.authenticate();
      if (!quiet) console.log('Database connection has been established successfully.');

      // Initialize models first
      const { User, Plant, JournalEntry, sequelize } = await initializeModels(
        this.config.database.sequelize
      );
      this.User = User;
      this.Plant = Plant;
      this.JournalEntry = JournalEntry;
      this.sequelize = sequelize;
      if (!quiet) console.log('Models initialized successfully.');

      // In parallel mode, migrations are already run by setup-parallel-dbs.ts
      // So we should NOT sync with force:true as it would drop migrated tables
      // Just verify the database is ready
      if (!quiet) console.log('Database initialized with migrations.');

      // Clear cached test user since database was synced/dropped
      this.testUser = null;

      // Add a small delay to ensure everything is properly initialized
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Unable to connect to the database:', error instanceof Error ? error.message : String(error));
      // Don't throw the error, just log it
    }
  }

  async cleanup() {
    try {
      // Don't close the connection in parallel mode, as the sequelize instance
      // is shared across workers and managed by Mocha's global hooks
      // Connection will be closed in the global afterAll hook
      if (!process.env.TEST_QUIET) {
        console.log('TestHelper cleanup complete (connection remains open for worker)');
      }
    } catch (error) {
      console.error('Error during cleanup:', error instanceof Error ? error.message : String(error));
    }
  }

  clearTestUser() {
    this.testUser = null;
  }

  async createTestUser(overrides: Partial<User> = {}) {
    // If no email override is provided, add a unique suffix to prevent duplicates
    // This ensures each test file gets its own user and avoids foreign key constraint violations
    const baseEmail = overrides.email || this.config.auth.defaultEmail;
    const uniqueEmail = overrides.email
      ? overrides.email
      : baseEmail.replace('@', `+${Date.now()}-${Math.random().toString(36).substr(2, 9)}@`);

    const defaultUser = {
      email: uniqueEmail,
      password_hash: this.config.auth.defaultPassword,
      tz: 'UTC',
    };

    const newUser = await this.User!.create({
      ...defaultUser,
      ...overrides,
    });

    // Cache the most recently created user for backward compatibility
    // (some tests may expect this.testUser to be set)
    this.testUser = newUser;

    return newUser;
  }

  async createTestPlant(overrides: Partial<Plant> = {}) {
    if (!this.testUser) {
      throw new Error('Must create test user before creating test plant');
    }

    const defaultPlant = {
      user_id: this.testUser.id,
      name: 'Test Plant',
      type: 'indoor' as const,
      water_interval_days: 7,
      species: 'Test Species',
    };

    return await this.Plant!.create({
      ...defaultPlant,
      ...overrides,
    });
  }

  async createTestJournalEntry(
    plant: Plant,
    overrides: Partial<JournalEntry> = {}
  ) {
    const defaultEntry = {
      plant_id: plant.id,
      entry_ts: new Date(),
      note: 'Test journal entry',
    };

    return await this.JournalEntry!.create({
      ...defaultEntry,
      ...overrides,
    });
  }

  async executeRequest(event: {
    httpMethod: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
    files?: Array<{ fieldname: string; originalname: string; mimetype: string; buffer: Buffer }>;
  }) {
    const { httpMethod, path, headers = {}, body, query, files } = event;

    // Only add auth token if we have a test user AND no Authorization header is provided
    if (this.testUser && !headers['Authorization']) {
      const token = await this.generateAuthToken(this.testUser);
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Convert API Gateway style path to Express path
    const expressPath = path.startsWith('/api') ? path : `/api${path}`;

    // Create request based on HTTP method
    const agent = request(this.app);
    let req: Test;

    switch (httpMethod.toLowerCase()) {
      case 'get':
        req = agent.get(expressPath);
        break;
      case 'post':
        req = agent.post(expressPath);
        break;
      case 'put':
        req = agent.put(expressPath);
        break;
      case 'patch':
        req = agent.patch(expressPath);
        break;
      case 'delete':
        req = agent.delete(expressPath);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${httpMethod}`);
    }

    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      req = req.set(key, value);
    });

    // Add query parameters
    if (query) {
      req = req.query(query);
    }

    // Handle file uploads
    if (files && files.length > 0) {
      files.forEach((file) => {
        req = req.attach(file.fieldname, file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      });
      // Add body fields if present (for multipart forms)
      if (body) {
        Object.entries(body).forEach(([key, value]) => {
          req = req.field(key, value as string);
        });
      }
    } else if (['POST', 'PUT', 'PATCH'].includes(httpMethod) && body) {
      // Add body for POST, PUT, PATCH (non-file uploads)
      req = req.send(body);
    }

    // Execute request and return response
    const response = await req;
    return {
      statusCode: response.status,
      body: response.body,
      headers: response.headers,
    };
  }

  private async generateAuthToken(user: User): Promise<string> {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '24h',
    });
  }
}

// Modify the singleton getter to ensure proper cleanup
export const getTestHelper = async (): Promise<TestHelper> => {
  // In parallel mode, reuse existing instance to avoid closing shared Sequelize connection
  if (testHelperInstance) {
    return testHelperInstance;
  }

  testHelperInstance = new TestHelper({
    database: { sequelize: testSequelize },
    auth: {
      defaultPassword: 'test-password',
      defaultEmail: 'test-user@example.com',
    },
  });
  await testHelperInstance.initialize();
  return testHelperInstance;
};

// Global setup and teardown
export const setupTestDb = async () => {
  return await getTestHelper();
};

export const teardownTestDb = async () => {
  if (testHelperInstance) {
    await testHelperInstance.cleanup();
    testHelperInstance = null;
  }

  // Ensure we close all connections in the pool
  if (testSequelize) {
    try {
      // Close all connections in the pool
      await testSequelize.close();
      // Force close any remaining connections
      await testSequelize.connectionManager.close();
      // Add a small delay to ensure connections are fully closed
    } catch (error) {
      console.error('Error during teardown:', error);
    }
  }
};

// Function to clear all test data without dropping tables
export const clearTestData = async () => {
  try {
    const { User, Plant, JournalEntry } = await initializeModels(testSequelize);
    await JournalEntry.destroy({ where: {}, force: true });
    await Plant.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
  } catch (error) {
    console.error('Error clearing test data:', error);
    throw error;
  }
};
