'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create plots table
    await queryInterface.createTable('plots', {
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
      },
      plant_profile_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'plant_profiles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      x: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'X coordinate in feet',
      },
      y: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Y coordinate in feet',
      },
      width: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Plot width in feet',
      },
      height: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Plot height in feet',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional notes about the plot',
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
    await queryInterface.addIndex('plots', ['garden_id']);
    await queryInterface.addIndex('plots', ['plant_profile_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plots');
  },
};
