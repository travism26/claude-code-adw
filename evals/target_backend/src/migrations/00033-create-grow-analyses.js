'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grow_analyses table
    await queryInterface.createTable('grow_analyses', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      grow_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'grows',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Grow this analysis belongs to',
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
        comment: 'User who owns this grow',
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
        comment: 'AI task that generated this analysis (for audit trail)',
      },
      suggestions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of suggestion objects with category, priority, title, description',
      },
      overall_score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Overall grow health score (0-100)',
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Brief summary of the analysis',
      },
      is_current: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this is the current analysis for the grow',
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

    // Add indexes
    await queryInterface.addIndex('grow_analyses', ['grow_id'], {
      name: 'idx_grow_analyses_grow_id',
    });

    await queryInterface.addIndex('grow_analyses', ['user_id'], {
      name: 'idx_grow_analyses_user_id',
    });

    await queryInterface.addIndex('grow_analyses', ['is_current'], {
      name: 'idx_grow_analyses_is_current',
    });

    await queryInterface.addIndex('grow_analyses', ['analyzed_at'], {
      name: 'idx_grow_analyses_analyzed_at',
    });

    // Add unique partial index to ensure only one current analysis per grow
    await queryInterface.addIndex('grow_analyses', ['grow_id'], {
      name: 'idx_grow_analyses_current_per_grow',
      unique: true,
      where: {
        is_current: true,
      },
    });

    // Add constraint to ensure score is between 0 and 100
    await queryInterface.addConstraint('grow_analyses', {
      type: 'check',
      fields: ['overall_score'],
      name: 'chk_grow_analyses_score_range',
      where: {
        overall_score: {
          [Sequelize.Op.gte]: 0,
          [Sequelize.Op.lte]: 100,
        },
      },
    });
  },

  async down(queryInterface) {
    // Drop indexes first
    await queryInterface.removeIndex(
      'grow_analyses',
      'idx_grow_analyses_current_per_grow'
    );
    await queryInterface.removeIndex(
      'grow_analyses',
      'idx_grow_analyses_analyzed_at'
    );
    await queryInterface.removeIndex(
      'grow_analyses',
      'idx_grow_analyses_is_current'
    );
    await queryInterface.removeIndex('grow_analyses', 'idx_grow_analyses_user_id');
    await queryInterface.removeIndex('grow_analyses', 'idx_grow_analyses_grow_id');

    // Drop constraint
    await queryInterface.removeConstraint(
      'grow_analyses',
      'chk_grow_analyses_score_range'
    );

    // Drop table
    await queryInterface.dropTable('grow_analyses');
  },
};
