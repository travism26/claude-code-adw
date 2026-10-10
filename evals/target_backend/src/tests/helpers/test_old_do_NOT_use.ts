import { Sequelize } from 'sequelize';
import { User } from '../../models/User';
import { Plant } from '../../models/Plant';
import { JournalEntry } from '../../models/JournalEntry';
import * as bcrypt from 'bcryptjs';
import express, { Express } from 'express';
import request, { Test } from 'supertest';
import routes from '../../routes';
import { initializeModels } from '../../models';

interface TestConfig {
  database: {
    sequelize: Sequelize;
  };
  auth: {
    defaultPassword: string;
  };
}

export class TestHelper {
  private config: TestConfig;
  private testUser: User | null = null;
  private app: Express;

  constructor(config: TestConfig) {
    this.config = config;
    this.app = express();
    this.app.use(express.json());
    this.app.use('/api', routes);
  }

  async initialize() {
    // Initialize models first
    await initializeModels(this.config.database.sequelize);
    // Then clear any existing test data
    await this.cleanup();
  }

  async cleanup() {
    // Delete in reverse order of dependencies
    await JournalEntry.destroy({ where: {}, force: true });
    await Plant.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
  }

  async createTestUser(overrides: Partial<User> = {}) {
    const defaultUser = {
      email: `test-${Date.now()}@example.com`,
      password_hash: await bcrypt.hash(this.config.auth.defaultPassword, 10),
      tz: 'UTC',
    };

    this.testUser = await User.create({
      ...defaultUser,
      ...overrides,
    });

    return this.testUser;
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

    return await Plant.create({
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

    return await JournalEntry.create({
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
  }) {
    const { httpMethod, path, headers = {}, body, query } = event;

    // Add auth token if we have a test user
    if (this.testUser) {
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

    // Add body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(httpMethod) && body) {
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
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

    return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '24h',
    });
  }
}

// Create a helper instance for the HTTP method wrappers
const helper = new TestHelper({
  database: { sequelize: {} as Sequelize },
  auth: { defaultPassword: 'test-password' },
});

// HTTP method wrappers
export const get = (event: any) =>
  helper.executeRequest({ httpMethod: 'GET', ...event });
export const post = (event: any) =>
  helper.executeRequest({ httpMethod: 'POST', ...event });
export const put = (event: any) =>
  helper.executeRequest({ httpMethod: 'PUT', ...event });
export const patch = (event: any) =>
  helper.executeRequest({ httpMethod: 'PATCH', ...event });
export const del = (event: any) =>
  helper.executeRequest({ httpMethod: 'DELETE', ...event });
