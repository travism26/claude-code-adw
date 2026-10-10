'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create gardens table
    await queryInterface.createTable('gardens', {
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
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Garden name (e.g., "Backyard Garden", "Balcony")',
      },
      zone: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: 'Growing zone (e.g., "5a", "10b")',
      },
      width: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Garden width in feet',
      },
      height: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Garden height/length in feet',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional notes about the garden',
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
    await queryInterface.addIndex('gardens', ['user_id']);
    await queryInterface.addIndex('gardens', ['zone']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gardens');
  },
};
