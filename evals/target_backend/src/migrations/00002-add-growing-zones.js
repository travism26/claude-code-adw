'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add zone fields to users table
    await queryInterface.addColumn('users', 'growing_zone', {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 13,
      },
      comment: 'USDA Hardiness Zone (1-13)',
    });

    await queryInterface.addColumn('users', 'postal_code', {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Postal/ZIP code for zone detection',
    });

    await queryInterface.addColumn('users', 'zone_override', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True if user manually set zone instead of auto-detection',
    });

    // Add index for zone lookups
    await queryInterface.addIndex('users', ['growing_zone']);
  },

  async down(queryInterface) {
    // Remove index first
    await queryInterface.removeIndex('users', ['growing_zone']);

    // Remove columns
    await queryInterface.removeColumn('users', 'zone_override');
    await queryInterface.removeColumn('users', 'postal_code');
    await queryInterface.removeColumn('users', 'growing_zone');
  },
};
