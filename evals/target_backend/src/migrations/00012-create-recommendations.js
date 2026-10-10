'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create recommendations table
    await queryInterface.createTable('recommendations', {
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
        allowNull: true,
        references: {
          model: 'plants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Specific plant this recommendation is for (null for general recommendations)',
      },
      type: {
        type: DataTypes.ENUM('water', 'fertilize', 'prune', 'pest_check', 'harvest', 'general'),
        allowNull: false,
        comment: 'Type of recommendation',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Actionable recommendation message',
      },
      severity: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'Urgency level of the recommendation',
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
    await queryInterface.addIndex('recommendations', ['user_id']);
    await queryInterface.addIndex('recommendations', ['plant_id']);
    await queryInterface.addIndex('recommendations', ['type']);
    await queryInterface.addIndex('recommendations', ['severity']);
    await queryInterface.addIndex('recommendations', ['created_at']);
    await queryInterface.addIndex('recommendations', ['user_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recommendations');
  },
};
