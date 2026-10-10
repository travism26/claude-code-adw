'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grow_harvests table
    await queryInterface.createTable('grow_harvests', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      grow_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'grows',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Grow this harvest belongs to (one harvest per grow)',
      },
      harvested_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'When the harvest occurred',
      },
      wet_weight_grams: {
        type: DataTypes.DECIMAL(7, 1),
        allowNull: true,
        comment: 'Wet weight in grams',
      },
      dry_weight_grams: {
        type: DataTypes.DECIMAL(7, 1),
        allowNull: true,
        comment: 'Dry weight in grams',
      },
      trim_weight_grams: {
        type: DataTypes.DECIMAL(6, 1),
        allowNull: true,
        comment: 'Trim weight in grams',
      },
      thc_percent: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        comment: 'THC percentage',
      },
      cbd_percent: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        comment: 'CBD percentage',
      },
      terpene_profile: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Terpene profile as JSON object',
      },
      cure_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Number of days cured',
      },
      quality_rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Quality rating (1-10)',
      },
      smoke_report: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Smoke report notes',
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

    // Add index on harvested_at for chronological queries
    await queryInterface.addIndex('grow_harvests', ['harvested_at']);

    // Unique constraint on grow_id is already handled by the unique: true in the column definition
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grow_harvests');
  },
};
