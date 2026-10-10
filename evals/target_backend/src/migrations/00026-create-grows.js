'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grows table
    await queryInterface.createTable('grows', {
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
        comment: 'User who owns this grow',
      },
      strain_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Name of the cannabis strain',
      },
      strain_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Type of strain: indica, sativa, hybrid, ruderalis',
      },
      grow_method: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Growing method: soil, coco, hydro, dwc, aero, other',
      },
      grow_medium: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Specific growing medium details',
      },
      light_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Light type: led, hps, mh, cfl, sun, other',
      },
      light_wattage: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Light wattage in watts',
      },
      grow_space_sqft: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Grow space size in square feet',
      },
      pot_size_gallons: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        comment: 'Pot size in gallons',
      },
      plant_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Number of plants in this grow',
      },
      phase: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'germination',
        comment: 'Current phase: germination, vegetative, flowering, harvest, archived',
      },
      phase_started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the current phase started',
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'When the grow started',
      },
      harvested_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the grow was harvested',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'General notes about the grow',
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this grow is publicly visible',
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

    // Add CHECK constraints for ENUM-like fields
    await queryInterface.sequelize.query(`
      ALTER TABLE grows
      ADD CONSTRAINT check_grow_strain_type
      CHECK (strain_type IN ('indica', 'sativa', 'hybrid', 'ruderalis'))
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE grows
      ADD CONSTRAINT check_grow_method
      CHECK (grow_method IN ('soil', 'coco', 'hydro', 'dwc', 'aero', 'other'))
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE grows
      ADD CONSTRAINT check_light_type
      CHECK (light_type IN ('led', 'hps', 'mh', 'cfl', 'sun', 'other'))
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE grows
      ADD CONSTRAINT check_grow_phase
      CHECK (phase IN ('germination', 'vegetative', 'flowering', 'harvest', 'archived'))
    `);

    // Add indexes for common queries
    await queryInterface.addIndex('grows', ['user_id']);
    await queryInterface.addIndex('grows', ['phase']);
    await queryInterface.addIndex('grows', ['started_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grows');
  },
};
