#!/usr/bin/env ts-node

import { Client } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const PARALLEL_WORKERS = parseInt(process.env.PARALLEL_WORKERS || '4', 10);
const DB_PREFIX = 'growbuddy_test_';
const DB_USER = 'postgres';
const DB_PASSWORD = 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);

interface DatabaseConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

async function setupParallelDatabases(): Promise<void> {
  console.log(`\n🚀 Setting up ${PARALLEL_WORKERS} parallel test databases...\n`);

  // Connect to PostgreSQL admin database
  const adminConfig: DatabaseConfig = {
    user: DB_USER,
    password: DB_PASSWORD,
    host: DB_HOST,
    port: DB_PORT,
    database: 'postgres',
  };

  const client = new Client(adminConfig);

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Create and migrate each test database sequentially
    for (let workerId = 0; workerId < PARALLEL_WORKERS; workerId++) {
      const dbName = `${DB_PREFIX}${workerId}`;

      console.log(`📦 Processing database: ${dbName}`);

      // Drop database if exists
      try {
        await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
        console.log(`  ✓ Dropped existing database (if present)`);
      } catch (error) {
        console.log(`  ⚠ Warning: Could not drop database: ${error}`);
      }

      // Create database
      try {
        await client.query(`CREATE DATABASE ${dbName}`);
        console.log(`  ✓ Created database`);
      } catch (error) {
        throw new Error(`Failed to create database ${dbName}: ${error}`);
      }

      // Run migrations on the new database
      try {
        console.log(`  ⚙ Running migrations...`);

        const { stdout, stderr } = await execAsync(
          `DB_NAME=${dbName} npm run migrate:test`,
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              DB_NAME: dbName,
              DB_USER: DB_USER,
              DB_PASSWORD: DB_PASSWORD,
              DB_HOST: DB_HOST,
              DB_PORT: DB_PORT.toString(),
            }
          }
        );

        if (stderr && !stderr.includes('Deprecation')) {
          console.log(`  ⚠ Migration warnings: ${stderr}`);
        }

        console.log(`  ✓ Migrations completed`);
      } catch (error: any) {
        throw new Error(`Failed to run migrations on ${dbName}: ${error.message}`);
      }

      console.log(`✅ Database ${dbName} ready\n`);
    }

    console.log(`\n🎉 All ${PARALLEL_WORKERS} parallel test databases are ready!\n`);
    console.log(`Databases created: ${Array.from({ length: PARALLEL_WORKERS }, (_, i) => `${DB_PREFIX}${i}`).join(', ')}\n`);

  } catch (error) {
    console.error('\n❌ Error setting up parallel databases:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the setup
setupParallelDatabases()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
