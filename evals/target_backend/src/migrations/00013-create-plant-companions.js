'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create plant_companions table
    await queryInterface.createTable('plant_companions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      plant_a_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'plant_profiles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'First plant in the relationship',
      },
      plant_b_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'plant_profiles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Second plant in the relationship',
      },
      relationship: {
        type: DataTypes.ENUM('beneficial', 'harmful'),
        allowNull: false,
        comment: 'Type of companion relationship',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Details about why this relationship exists',
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

    // Add unique constraint to prevent duplicate relationships
    await queryInterface.addConstraint('plant_companions', {
      fields: ['plant_a_id', 'plant_b_id', 'relationship'],
      type: 'unique',
      name: 'unique_plant_companion_relationship',
    });

    // Add indexes for common queries
    await queryInterface.addIndex('plant_companions', ['plant_a_id']);
    await queryInterface.addIndex('plant_companions', ['plant_b_id']);
    await queryInterface.addIndex('plant_companions', ['relationship']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plant_companions');
  },
};
