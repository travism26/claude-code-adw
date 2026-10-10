#!/usr/bin/env ts-node

import { Client } from 'pg';

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

async function cleanupParallelDatabases(): Promise<void> {
  console.log(`\n🧹 Cleaning up ${PARALLEL_WORKERS} parallel test databases...\n`);

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

    // Drop each test database
    for (let workerId = 0; workerId < PARALLEL_WORKERS; workerId++) {
      const dbName = `${DB_PREFIX}${workerId}`;

      console.log(`🗑  Dropping database: ${dbName}`);

      try {
        await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
        console.log(`  ✓ Database dropped\n`);
      } catch (error) {
        console.log(`  ⚠ Warning: Could not drop database: ${error}\n`);
      }
    }

    console.log(`\n✅ Cleanup complete! All ${PARALLEL_WORKERS} parallel test databases removed.\n`);

  } catch (error) {
    console.error('\n❌ Error cleaning up parallel databases:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the cleanup
cleanupParallelDatabases()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
