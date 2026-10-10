'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create votes table
    await queryInterface.createTable('votes', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      answer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'answers',
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
      value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Vote value: 1 for upvote, -1 for downvote',
        validate: {
          isIn: [[1, -1]],
        },
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

    // Add unique constraint to prevent duplicate votes
    await queryInterface.addConstraint('votes', {
      fields: ['answer_id', 'user_id'],
      type: 'unique',
      name: 'unique_user_answer_vote',
    });

    // Add indexes for common queries
    await queryInterface.addIndex('votes', ['answer_id']);
    await queryInterface.addIndex('votes', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('votes');
  },
};
