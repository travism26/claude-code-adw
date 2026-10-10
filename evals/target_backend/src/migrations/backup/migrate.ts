import { Sequelize, DataTypes } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { getDbCredentials } from '../../utils/db';

async function getDbConfig() {
  const credentials = await getDbCredentials();
  console.log('Credentials:', credentials);

  return {
    username: credentials.username,
    password: credentials.password,
    database: process.env.DB_NAME || 'growbuddy',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres' as const,
  };
}

async function runMigrations(sequelize: Sequelize) {
  console.log('Running migrations...');
  const umzug = new Umzug({
    migrations: {
      glob: 'migrations/[0-9]*.js',
      resolve: ({ name, path }) => {
        if (!path) {
          throw new Error(`Migration path not found for ${name}`);
        }
        const migration = require(path);
        return {
          name,
          up: async ({ context }: { context: any }) =>
            migration.up(context, { DataTypes, Sequelize }),
          down: async ({ context }: { context: any }) =>
            migration.down(context, { DataTypes, Sequelize }),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  try {
    await umzug.up();
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

async function waitForDatabase(
  sequelize: Sequelize,
  maxRetries = 30,
  delayMs = 5000
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await sequelize.authenticate();
      console.log('Database connection established');
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(
        `Database connection attempt ${i + 1} failed, retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Main migration runner function
export async function runDatabaseMigrations(): Promise<void> {
  console.log('Starting database migrations...');

  try {
    const config = await getDbConfig();
    const sequelize = new Sequelize(config);

    try {
      await waitForDatabase(sequelize);
      await runMigrations(sequelize);
      await sequelize.close();
      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      await sequelize.close();
      throw error;
    }
  } catch (error) {
    console.error('Migration runner error:', error);
    throw error;
  }
}

// CLI support - run migrations if executed directly
if (require.main === module) {
  runDatabaseMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}
