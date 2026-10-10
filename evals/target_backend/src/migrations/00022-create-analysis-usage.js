'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create analysis_usage table
    await queryInterface.createTable('analysis_usage', {
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
        comment: 'User this usage record belongs to',
      },
      usage_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Date for this usage record (no time component)',
      },
      analyses_used: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Count of analyses used on this date',
      },
      bonus_analyses: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Additional analyses granted by admin',
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

    // Add unique constraint on (user_id, usage_date) to prevent duplicate records
    await queryInterface.addConstraint('analysis_usage', {
      fields: ['user_id', 'usage_date'],
      type: 'unique',
      name: 'unique_user_usage_date',
    });

    // Add index on user_id for performance
    await queryInterface.addIndex('analysis_usage', ['user_id'], {
      name: 'idx_analysis_usage_user_id',
    });

    // Add index on usage_date for cleanup queries
    await queryInterface.addIndex('analysis_usage', ['usage_date'], {
      name: 'idx_analysis_usage_usage_date',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('analysis_usage');
  },
};
