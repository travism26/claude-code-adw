'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grow_log_environments table
    await queryInterface.createTable('grow_log_environments', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      grow_log_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'grow_logs',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Grow log entry this environment data belongs to',
      },
      temperature_f: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        comment: 'Temperature in Fahrenheit',
      },
      humidity_percent: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        comment: 'Relative humidity percentage',
      },
      ph: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true,
        comment: 'pH level',
      },
      ec: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: true,
        comment: 'Electrical conductivity',
      },
      ppm: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Parts per million',
      },
      co2_ppm: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'CO2 level in parts per million',
      },
      light_hours: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Hours of light per day',
      },
      light_distance_inches: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        comment: 'Distance from light to canopy in inches',
      },
      vpd: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Vapor pressure deficit',
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

    // Add index on grow_log_id for quick lookups
    await queryInterface.addIndex('grow_log_environments', ['grow_log_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grow_log_environments');
  },
};
