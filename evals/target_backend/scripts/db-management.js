const path = require('path');
const { Sequelize } = require('sequelize');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;

// Create a Sequelize instance for the postgres database (for creating/dropping databases)
const createSystemSequelize = () => {
  return new Sequelize('postgres', dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: false,
  });
};

// Create a Sequelize instance for the application database
const createAppSequelize = () => {
  return new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: false,
  });
};

async function dropDatabase() {
  const sequelize = createSystemSequelize();
  try {
    console.log(`Dropping database "${dbName}"...`);
    await sequelize.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`Database "${dbName}" dropped successfully.`);
  } catch (error) {
    console.error('Error dropping database:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function createDatabase() {
  const sequelize = createSystemSequelize();
  try {
    console.log(`Creating database "${dbName}"...`);
    await sequelize.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created successfully.`);
  } catch (error) {
    if (error.original && error.original.code === '42P04') {
      console.log(`Database "${dbName}" already exists.`);
    } else {
      console.error('Error creating database:', error.message);
      throw error;
    }
  } finally {
    await sequelize.close();
  }
}

async function dropAllTables() {
  const sequelize = createAppSequelize();
  try {
    console.log('Dropping all tables...');

    // Drop tables in the correct order (reverse of creation to handle foreign keys)
    const tables = ['reminders', 'journal_entries', 'plants', 'users', 'SequelizeMeta'];

    for (const table of tables) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`  Dropped table: ${table}`);
      } catch (error) {
        console.log(`  Table ${table} does not exist or already dropped.`);
      }
    }

    // Drop indexes explicitly (in case they weren't cascade-deleted)
    console.log('Dropping indexes...');
    const indexes = [
      'users_email',
      'plants_user_id',
      'plants_last_watered',
      'plants_last_fertilized',
      'journal_entries_plant_id',
      'reminders_user_id',
      'reminders_plant_id',
      'reminders_status',
      'reminders_scheduled_date',
    ];

    for (const index of indexes) {
      try {
        await sequelize.query(`DROP INDEX IF EXISTS "${index}" CASCADE`);
        console.log(`  Dropped index: ${index}`);
      } catch (error) {
        // Silently ignore
      }
    }

    // Drop ENUM types that were created by migrations
    console.log('Dropping ENUM types...');
    const enumTypes = ['enum_plants_type', 'enum_reminders_type', 'enum_reminders_status'];

    for (const enumType of enumTypes) {
      try {
        await sequelize.query(`DROP TYPE IF EXISTS "${enumType}" CASCADE`);
        console.log(`  Dropped ENUM type: ${enumType}`);
      } catch (error) {
        console.log(`  ENUM type ${enumType} does not exist or already dropped.`);
      }
    }

    console.log('All tables, indexes, and ENUM types dropped successfully.');
  } catch (error) {
    console.error('Error dropping tables:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function clearSequelizeMeta() {
  const sequelize = createAppSequelize();
  try {
    console.log('Clearing SequelizeMeta table...');
    await sequelize.query(`DROP TABLE IF EXISTS "SequelizeMeta" CASCADE`);
    console.log('SequelizeMeta table cleared.');
  } catch (error) {
    console.error('Error clearing SequelizeMeta:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function resetDatabase() {
  console.log('\n=== Database Reset ===\n');
  await dropAllTables();
  console.log('\nReset complete! Run migrations with: npm run migrate:dev\n');
}

async function rebuildDatabase() {
  console.log('\n=== Database Rebuild ===\n');
  await dropDatabase();
  await createDatabase();
  console.log('\nRebuild complete! Run migrations with: npm run migrate:dev\n');
}

// Main command handler
const command = process.argv[2];

(async () => {
  try {
    switch (command) {
      case 'drop':
        await dropDatabase();
        break;
      case 'create':
        await createDatabase();
        break;
      case 'reset':
        await resetDatabase();
        break;
      case 'rebuild':
        await rebuildDatabase();
        break;
      case 'drop-tables':
        await dropAllTables();
        break;
      case 'clear-meta':
        await clearSequelizeMeta();
        break;
      default:
        console.log(`
Usage: node scripts/db-management.js <command>

Commands:
  drop         - Drop the database
  create       - Create the database
  reset        - Drop all tables and SequelizeMeta (keeps database)
  rebuild      - Drop and recreate the database (full rebuild)
  drop-tables  - Drop all application tables
  clear-meta   - Clear SequelizeMeta table only
        `);
        process.exit(0);
    }
  } catch (error) {
    console.error('\nDatabase operation failed:', error.message);
    process.exit(1);
  }
})();
