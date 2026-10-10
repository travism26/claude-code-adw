# Creating a Migration File

This project uses Sequelize CLI for managing database migrations.

## Creating a New Migration

To create a new migration file, use the following command:

```bash
npm run migrate:create -- my-migration-name
```

Replace `my-migration-name` with a descriptive name for your migration (e.g., `add-user-avatar`, `create-notifications-table`).

This will generate a timestamped migration file in `backend/src/migrations/` with the following structure:

```javascript
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Write migration code here
    // Example: await queryInterface.createTable('tableName', { ... });
  },

  async down(queryInterface, { DataTypes }) {
    // Write rollback code here
    // Example: await queryInterface.dropTable('tableName');
  }
};
```

## Migration Best Practices

1. **Write both up() and down() methods** - Always implement the rollback logic
2. **Use snake_case for column names** - Matches the `underscored: true` option in models
3. **Handle foreign keys properly** - Include `onUpdate` and `onDelete` actions
4. **Add indexes for performance** - Index foreign keys and frequently queried columns
5. **Test migrations thoroughly** - Test both up and down migrations before committing

## Example: Adding a New Column

```javascript
'use strict';

module.exports = {
  async up(queryInterface, { DataTypes }) {
    await queryInterface.addColumn('users', 'avatar_url', {
      type: DataTypes.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'avatar_url');
  }
};
```

## Example: Creating a New Table

```javascript
'use strict';

module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    await queryInterface.createTable('notifications', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('notifications', ['user_id']);
    await queryInterface.addIndex('notifications', ['read']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  }
};
```

## Running Migrations

After creating a migration file, run it with:

```bash
npm run migrate:dev
```

For more information on running and managing migrations, see [Database Management Guide](./database_management.md).

## Consolidated Schema Approach

This project uses a consolidated migration approach where the initial schema (`00001-initial-complete-schema.js`) contains all the core tables. This simplifies the migration history and makes it easier to set up new environments.

When creating new migrations:
- Only create migrations for **changes** to the existing schema
- Don't recreate tables that already exist in the initial schema
- Focus on incremental changes (adding columns, creating new tables, etc.)
