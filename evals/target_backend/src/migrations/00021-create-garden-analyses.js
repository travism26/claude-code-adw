'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create garden_analyses table
    await queryInterface.createTable('garden_analyses', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      garden_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'gardens',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Garden that was analyzed',
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who requested the analysis',
      },
      ai_task_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'ai_tasks',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Link to AITask record for audit trail (optional)',
      },
      suggestions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of AI-generated garden suggestions',
      },
      overall_score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Overall garden health score (0-100)',
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
        comment: 'Summary of the garden analysis',
      },
      is_current: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this is the current active analysis for this garden',
      },
      analyzed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the analysis was performed',
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

    // Add indexes for common queries
    await queryInterface.addIndex('garden_analyses', ['garden_id']);
    await queryInterface.addIndex('garden_analyses', ['user_id']);
    await queryInterface.addIndex('garden_analyses', ['ai_task_id']);

    // Composite index for finding current analysis for a garden (most common query)
    await queryInterface.addIndex('garden_analyses', ['garden_id', 'is_current'], {
      name: 'idx_garden_analyses_garden_current',
    });

    // Index for historical queries (ordered by analysis time)
    await queryInterface.addIndex('garden_analyses', ['garden_id', 'analyzed_at'], {
      name: 'idx_garden_analyses_garden_time',
    });

    // Index for querying analyses by creation time
    await queryInterface.addIndex('garden_analyses', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('garden_analyses');
  },
};
