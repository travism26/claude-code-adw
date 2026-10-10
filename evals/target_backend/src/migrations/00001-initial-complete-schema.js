'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Users table
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tz: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'UTC',
      },
      refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true,
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

    // Plants table
    await queryInterface.createTable('plants', {
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
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      species: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('indoor', 'outdoor'),
        allowNull: false,
      },
      water_interval_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fert_interval_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      last_watered: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_fertilized: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      photo_url: {
        type: DataTypes.STRING,
        allowNull: true,
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

    // Journal entries table
    await queryInterface.createTable('journal_entries', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      plant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'plants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      note: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      photo_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      entry_ts: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
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

    // Reminders table
    await queryInterface.createTable('reminders', {
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
      plant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'plants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: DataTypes.ENUM('water', 'fertilize'),
        allowNull: false,
      },
      scheduled_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      retry_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
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

    // Add indexes for users table
    await queryInterface.addIndex('users', ['email']);

    // Add indexes for plants table
    await queryInterface.addIndex('plants', ['user_id']);
    await queryInterface.addIndex('plants', ['last_watered']);
    await queryInterface.addIndex('plants', ['last_fertilized']);

    // Add indexes for journal_entries table
    await queryInterface.addIndex('journal_entries', ['plant_id']);

    // Add indexes for reminders table
    await queryInterface.addIndex('reminders', ['user_id']);
    await queryInterface.addIndex('reminders', ['plant_id']);
    await queryInterface.addIndex('reminders', ['status']);
    await queryInterface.addIndex('reminders', ['scheduled_date']);
    await queryInterface.addIndex('reminders', ['plant_id', 'type', 'scheduled_date']);
  },

  async down(queryInterface, { DataTypes }) {
    // Drop tables in reverse order to handle foreign key constraints
    await queryInterface.dropTable('reminders');
    await queryInterface.dropTable('journal_entries');
    await queryInterface.dropTable('plants');
    await queryInterface.dropTable('users');
  }
};
