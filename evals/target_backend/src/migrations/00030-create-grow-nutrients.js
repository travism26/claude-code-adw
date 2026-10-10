'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grow_nutrients junction table
    await queryInterface.createTable('grow_nutrients', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      grow_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'grows',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Grow this nutrient is used in',
      },
      nutrient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nutrients',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Nutrient being used',
      },
      dosage_ml_per_gallon: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Dosage in milliliters per gallon',
      },
      frequency: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Frequency: every_watering, weekly, biweekly, as_needed',
      },
      phase_used: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Phase used: all, vegetative, flowering, late_flowering',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes about nutrient usage',
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
      ALTER TABLE grow_nutrients
      ADD CONSTRAINT check_grow_nutrient_frequency
      CHECK (frequency IN ('every_watering', 'weekly', 'biweekly', 'as_needed'))
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE grow_nutrients
      ADD CONSTRAINT check_grow_nutrient_phase_used
      CHECK (phase_used IN ('all', 'vegetative', 'flowering', 'late_flowering'))
    `);

    // Add indexes for foreign keys
    await queryInterface.addIndex('grow_nutrients', ['grow_id']);
    await queryInterface.addIndex('grow_nutrients', ['nutrient_id']);

    // Add composite unique index to prevent duplicate grow-nutrient pairs
    await queryInterface.addIndex('grow_nutrients', ['grow_id', 'nutrient_id'], {
      unique: true,
      name: 'idx_grow_nutrients_unique_pair',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grow_nutrients');
  },
};
