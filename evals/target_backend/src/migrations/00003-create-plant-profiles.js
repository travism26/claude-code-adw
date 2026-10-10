'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create plant_profiles table
    await queryInterface.createTable('plant_profiles', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Common name of the plant',
      },
      species: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Scientific name',
      },
      common_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Alternative common name',
      },
      type: {
        type: DataTypes.ENUM('vegetable', 'herb', 'flower', 'fruit', 'houseplant', 'tree', 'shrub'),
        allowNull: false,
      },
      default_water_interval_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Default watering interval in days',
      },
      default_fert_interval_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Default fertilizing interval in days',
      },
      zone_min: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Minimum USDA hardiness zone',
      },
      zone_max: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Maximum USDA hardiness zone',
      },
      sunlight_requirements: {
        type: DataTypes.ENUM('full_sun', 'partial_sun', 'partial_shade', 'full_shade'),
        allowNull: true,
      },
      soil_type: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Preferred soil type (e.g., well-drained, loamy)',
      },
      spacing_inches: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Recommended spacing between plants in inches',
      },
      plant_family: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Plant family (e.g., Solanaceae, Lamiaceae)',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Brief description and care notes',
      },
      difficulty: {
        type: DataTypes.ENUM('easy', 'moderate', 'challenging'),
        allowNull: false,
        defaultValue: 'moderate',
      },
      indoor_outdoor: {
        type: DataTypes.ENUM('indoor', 'outdoor', 'both'),
        allowNull: false,
        defaultValue: 'outdoor',
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
    await queryInterface.addIndex('plant_profiles', ['name']);
    await queryInterface.addIndex('plant_profiles', ['type']);
    await queryInterface.addIndex('plant_profiles', ['zone_min', 'zone_max']);
    await queryInterface.addIndex('plant_profiles', ['difficulty']);
    await queryInterface.addIndex('plant_profiles', ['indoor_outdoor']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plant_profiles');
  },
};
