'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create questions table
    await queryInterface.createTable('questions', {
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
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Question title',
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Question details',
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Tags for categorization (e.g., watering, pests, fertilizing)',
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
    await queryInterface.addIndex('questions', ['user_id']);
    await queryInterface.addIndex('questions', ['created_at']);
    await queryInterface.addIndex('questions', ['tags'], {
      using: 'GIN',
      name: 'questions_tags_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('questions');
  },
};
