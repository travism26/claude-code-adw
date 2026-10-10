'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create notifications table
    await queryInterface.createTable('notifications', {
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
        comment: 'User who will receive this notification',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Notification message content',
      },
      link: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Optional link/route to navigate to when notification is clicked',
      },
      type: {
        type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
        allowNull: true,
        defaultValue: 'info',
        comment: 'Notification type for styling and categorization',
      },
      read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the notification has been read by the user',
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
    await queryInterface.addIndex('notifications', ['user_id']);
    await queryInterface.addIndex('notifications', ['read']);
    await queryInterface.addIndex('notifications', ['created_at']);
    await queryInterface.addIndex('notifications', ['user_id', 'read']);
    await queryInterface.addIndex('notifications', ['user_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
