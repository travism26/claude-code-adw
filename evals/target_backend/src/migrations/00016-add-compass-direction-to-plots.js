'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add compass_direction column to plots table
    await queryInterface.addColumn('plots', 'compass_direction', {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: 'Compass direction the plot faces: N, NE, E, SE, S, SW, W, NW',
    });

    // Add check constraint to validate compass direction values
    await queryInterface.sequelize.query(`
      ALTER TABLE plots
      ADD CONSTRAINT check_compass_direction
      CHECK (compass_direction IN ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW') OR compass_direction IS NULL)
    `);

    // Add index for potential filtering queries
    await queryInterface.addIndex('plots', ['compass_direction']);
  },

  async down(queryInterface) {
    // Remove index first
    await queryInterface.removeIndex('plots', ['compass_direction']);

    // Remove check constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE plots
      DROP CONSTRAINT IF EXISTS check_compass_direction
    `);

    // Remove column
    await queryInterface.removeColumn('plots', 'compass_direction');
  },
};
