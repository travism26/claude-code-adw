'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create ai_tasks table
    await queryInterface.createTable('ai_tasks', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User who triggered this AI task (nullable for system-generated tasks)',
      },
      plant_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'plants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Plant this AI task is related to (nullable for general tasks)',
      },
      task_type: {
        type: DataTypes.ENUM(
          'plant_update_suggestion',
          'weather_based_action',
          'care_recommendation',
          'pest_diagnosis',
          'general'
        ),
        allowNull: false,
        comment: 'Type of AI task being performed',
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Current status of the AI task',
      },
      request_payload: {
        type: DataTypes.JSONB,
        allowNull: false,
        comment: 'Input data for the AI request',
      },
      response_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'AI-generated response data',
      },
      model_used: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'AI model that processed this task (e.g., "claude-3-5-sonnet-20241022")',
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error message if task failed',
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
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when task completed or failed',
      },
    });

    // Add indexes for common queries
    await queryInterface.addIndex('ai_tasks', ['user_id']);
    await queryInterface.addIndex('ai_tasks', ['plant_id']);
    await queryInterface.addIndex('ai_tasks', ['status']);
    await queryInterface.addIndex('ai_tasks', ['task_type']);
    await queryInterface.addIndex('ai_tasks', ['created_at']);
    await queryInterface.addIndex('ai_tasks', ['user_id', 'created_at']);
    await queryInterface.addIndex('ai_tasks', ['plant_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_tasks');
  },
};
