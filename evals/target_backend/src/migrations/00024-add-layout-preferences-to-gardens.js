'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add layout_preferences JSONB column to gardens table
    await queryInterface.addColumn('gardens', 'layout_preferences', {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Layout generation preferences (sunZones, optimizationGoal, spacingMethod, lastGeneratedAt)',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('gardens', 'layout_preferences');
  },
};
