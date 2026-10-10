'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add status column to plots table
    await queryInterface.addColumn('plots', 'status', {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'planned',
      comment: 'Current lifecycle status of the plot: planned, planted, harvested, archived',
    });

    // Add check constraint to validate status values
    await queryInterface.sequelize.query(`
      ALTER TABLE plots
      ADD CONSTRAINT check_plot_status
      CHECK (status IN ('planned', 'planted', 'harvested', 'archived'))
    `);

    // Add index on status column for query optimization
    await queryInterface.addIndex('plots', ['status']);
  },

  async down(queryInterface) {
    // Remove index first
    await queryInterface.removeIndex('plots', ['status']);

    // Remove check constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE plots
      DROP CONSTRAINT IF EXISTS check_plot_status
    `);

    // Remove column
    await queryInterface.removeColumn('plots', 'status');
  },
};
