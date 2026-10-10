'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grow_environments table
    await queryInterface.createTable('grow_environments', {
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
        comment: 'User who owns this grow environment',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Name of the grow environment (e.g., "Flower Tent 1", "Veg Room")',
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'tent',
        comment: 'Type of environment: tent, room, closet, outdoor, greenhouse',
      },
      width_inches: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Width of the grow space in inches',
      },
      depth_inches: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Depth of the grow space in inches',
      },
      height_inches: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Height of the grow space in inches',
      },
      light_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Primary light type: led, hps, mh, cfl, sun, other',
      },
      light_wattage: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Total light wattage in watts',
      },
      ventilation_cfm: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Ventilation capacity in cubic feet per minute',
      },
      has_carbon_filter: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the environment has a carbon filter',
      },
      has_humidifier: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the environment has a humidifier',
      },
      has_dehumidifier: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the environment has a dehumidifier',
      },
      has_ac: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the environment has air conditioning',
      },
      has_heater: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the environment has a heater',
      },
      max_plants: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Maximum recommended plants for this environment',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes about the environment',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this environment is currently active',
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

    // Add CHECK constraint for type field
    await queryInterface.sequelize.query(`
      ALTER TABLE grow_environments
      ADD CONSTRAINT check_environment_type
      CHECK (type IN ('tent', 'room', 'closet', 'outdoor', 'greenhouse'))
    `);

    // Add CHECK constraint for light_type field
    await queryInterface.sequelize.query(`
      ALTER TABLE grow_environments
      ADD CONSTRAINT check_environment_light_type
      CHECK (light_type IN ('led', 'hps', 'mh', 'cfl', 'sun', 'other'))
    `);

    // Add indexes for common queries
    await queryInterface.addIndex('grow_environments', ['user_id']);
    await queryInterface.addIndex('grow_environments', ['is_active']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grow_environments');
  },
};
