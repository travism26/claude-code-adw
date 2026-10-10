'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create care_history table
    await queryInterface.createTable('care_history', {
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
      action_type: {
        type: DataTypes.ENUM('water', 'fertilize', 'prune', 'harvest', 'transplant', 'other'),
        allowNull: false,
      },
      action_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the care action was performed',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional notes about the care action',
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
    await queryInterface.addIndex('care_history', ['plant_id']);
    await queryInterface.addIndex('care_history', ['user_id']);
    await queryInterface.addIndex('care_history', ['action_type']);
    await queryInterface.addIndex('care_history', ['action_date']);
    await queryInterface.addIndex('care_history', ['plant_id', 'action_type', 'action_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('care_history');
  },
};
