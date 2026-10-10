# Database Management Guide

This guide explains how to manage the database for the GrowBuddy backend application, including running migrations, resetting, and rebuilding the database.

## Overview

The database uses PostgreSQL with Sequelize as the ORM and sequelize-cli for managing migrations. We've consolidated all schema migrations into a single, comprehensive migration file for simplicity.

## Database Structure

### Tables
- **users** - User accounts with authentication
- **plants** - Plant records owned by users
- **journal_entries** - Journal entries for plants
- **reminders** - Scheduled reminders for plant care

### Relationships
- plants.user_id → users.id (CASCADE on delete)
- journal_entries.plant_id → plants.id (CASCADE on delete)
- reminders.user_id → users.id (CASCADE on delete)
- reminders.plant_id → plants.id (CASCADE on delete)

## NPM Scripts

### Migration Scripts

```bash
# Run migrations (default environment)
npm run migrate

# Run migrations for specific environment
npm run migrate:dev      # Development
npm run migrate:test     # Test
npm run migrate:prod     # Production

# Create a new migration file
npm run migrate:create -- my-migration-name

# Undo last migration
npm run migrate:undo

# Undo all migrations
npm run migrate:undo:all
```

### Database Management Scripts

```bash
# Drop the database (removes the entire database)
npm run db:drop

# Create the database
npm run db:create

# Reset database (drops all tables, clears SequelizeMeta, then runs migrations)
npm run db:reset

# Rebuild database (drops and recreates database, then runs migrations)
npm run db:rebuild
```

## Common Workflows

### Starting Fresh Development Database

When you want to completely rebuild your database from scratch:

```bash
cd backend
npm run db:rebuild
```

This will:
1. Drop the database
2. Create a fresh database
3. Run all migrations

### Resetting Tables Without Dropping Database

If you want to reset just the tables but keep the database:

```bash
cd backend
npm run db:reset
```

This will:
1. Drop all tables (users, plants, journal_entries, reminders)
2. Clear the SequelizeMeta table
3. Run all migrations

### Running Migrations After Reset

Both `db:reset` and `db:rebuild` automatically run migrations. If you need to manually run migrations:

```bash
npm run migrate:dev
```

### Creating a New Migration

When you need to add a new migration (e.g., adding a new column or table):

```bash
npm run migrate:create -- add-new-feature
```

This creates a timestamped migration file in `src/migrations/`.

## Migration File Structure

The consolidated migration file `00001-initial-complete-schema.js` includes:

- **Users table** with fields: id, email, password_hash, tz, refresh_token, created_at, updated_at
- **Plants table** with fields: id, user_id, name, species, type, water_interval_days, fert_interval_days, last_watered, last_fertilized, photo_url, created_at, updated_at
- **Journal entries table** with fields: id, plant_id, note, photo_url, entry_ts, created_at, updated_at
- **Reminders table** with fields: id, user_id, plant_id, type, scheduled_date, sent_at, status, retry_count, error_message, created_at, updated_at
- All necessary indexes for performance
- Proper ENUM types for plant.type and reminder.type/status
- Foreign key constraints with CASCADE on delete

## Database Configuration

Configuration is managed through environment variables in the `.env` file:

```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=growbuddy_dev
DB_HOST=localhost
DB_PORT=5432
```

The sequelize-cli configuration is located at:
- `backend/.sequelizerc` - CLI configuration
- `backend/src/config/sequelize-cli.js` - Database connection settings

## Verifying Database Schema

After running migrations, you can verify the schema using PostgreSQL commands:

```bash
# List all tables
psql -U $DB_USER -d $DB_NAME -c "\dt"

# Describe users table
psql -U $DB_USER -d $DB_NAME -c "\d users"

# Describe plants table
psql -U $DB_USER -d $DB_NAME -c "\d plants"

# Describe journal_entries table
psql -U $DB_USER -d $DB_NAME -c "\d journal_entries"

# Describe reminders table
psql -U $DB_USER -d $DB_NAME -c "\d reminders"
```

## Troubleshooting

### Migration Already Executed Error

If you see an error that a migration has already been executed:

```bash
npm run db:reset
```

This clears the SequelizeMeta table and reruns all migrations.

### Database Does Not Exist

If you get a "database does not exist" error:

```bash
npm run db:create
npm run migrate:dev
```

### Cannot Drop Database (Active Connections)

If you can't drop the database due to active connections:

1. Close all connections to the database
2. Stop your application server
3. Try the command again

Alternatively, connect to PostgreSQL and force disconnect:

```sql
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'growbuddy_dev'
  AND pid <> pg_backend_pid();

DROP DATABASE growbuddy_dev;
```

### Permission Denied

Ensure your database user has the necessary permissions:

```sql
GRANT ALL PRIVILEGES ON DATABASE growbuddy_dev TO your_db_user;
```

## Best Practices

1. **Never edit migration files after they've been run** - Create a new migration instead
2. **Test migrations in development** before running in production
3. **Backup production database** before running migrations
4. **Use db:reset during development** for quick iteration
5. **Use db:rebuild sparingly** as it completely removes the database
6. **Keep models in sync with migrations** - Ensure TypeScript models match database schema

## Testing Migrations

Before committing migration changes:

1. Start with a clean slate:
   ```bash
   npm run db:reset
   ```

2. Verify all tables created correctly:
   ```bash
   psql -U $DB_USER -d $DB_NAME -c "\dt"
   ```

3. Run tests to ensure models work:
   ```bash
   npm test
   ```

4. Test rollback:
   ```bash
   npm run migrate:undo
   npm run migrate:dev
   ```

## Environment-Specific Migrations

For different environments, use the appropriate script:

- **Development**: `npm run migrate:dev`
- **Test**: `npm run migrate:test`
- **Production**: `npm run migrate:prod`

Each environment should have its own `.env` configuration with appropriate database credentials.

## Migration History

The `SequelizeMeta` table tracks which migrations have been executed. To view migration status:

```sql
SELECT * FROM "SequelizeMeta";
```

This table is automatically managed by sequelize-cli and should not be manually modified.
