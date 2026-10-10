'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create seasonal_tips table
    await queryInterface.createTable('seasonal_tips', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      plant_profile_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'plant_profiles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      zone_min: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Minimum zone this tip applies to (null = all zones)',
      },
      zone_max: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Maximum zone this tip applies to (null = all zones)',
      },
      season: {
        type: DataTypes.ENUM('spring', 'summer', 'fall', 'winter', 'year_round'),
        allowNull: false,
      },
      tip_text: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'The seasonal tip content',
      },
      timing_weeks: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Weeks before/after last frost (negative = before, positive = after)',
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Display priority (higher = more important)',
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

    // Add indexes for querying tips by plant, zone, and season
    await queryInterface.addIndex('seasonal_tips', ['plant_profile_id']);
    await queryInterface.addIndex('seasonal_tips', ['season']);
    await queryInterface.addIndex('seasonal_tips', ['zone_min', 'zone_max']);
    await queryInterface.addIndex('seasonal_tips', ['plant_profile_id', 'season']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('seasonal_tips');
  },
};
