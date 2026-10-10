'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create scheduled_events table
    await queryInterface.createTable('scheduled_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      entity_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Polymorphic entity type: grow, garden, plant',
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Polymorphic entity ID (no FK constraint)',
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      event_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        comment: 'feeding, watering, phase_change, harvest, custom',
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      all_day: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      is_recurring: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      recurrence_rule: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'RFC 5545 RRULE string for recurring events',
      },
      recurrence_end_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Hex color code, e.g., #10B981',
      },
      environment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'grow_environments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'pending',
        comment: 'pending, completed, skipped, cancelled',
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('scheduled_events', ['user_id'], {
      name: 'idx_scheduled_events_user',
    });

    await queryInterface.addIndex('scheduled_events', ['entity_type', 'entity_id'], {
      name: 'idx_scheduled_events_entity',
    });

    await queryInterface.addIndex('scheduled_events', ['start_date'], {
      name: 'idx_scheduled_events_date',
    });

    await queryInterface.addIndex('scheduled_events', ['status'], {
      name: 'idx_scheduled_events_status',
    });

    await queryInterface.addIndex('scheduled_events', ['is_recurring'], {
      name: 'idx_scheduled_events_recurring',
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop indexes first
    await queryInterface.removeIndex('scheduled_events', 'idx_scheduled_events_user');
    await queryInterface.removeIndex('scheduled_events', 'idx_scheduled_events_entity');
    await queryInterface.removeIndex('scheduled_events', 'idx_scheduled_events_date');
    await queryInterface.removeIndex('scheduled_events', 'idx_scheduled_events_status');
    await queryInterface.removeIndex('scheduled_events', 'idx_scheduled_events_recurring');

    // Drop table
    await queryInterface.dropTable('scheduled_events');
  },
};
