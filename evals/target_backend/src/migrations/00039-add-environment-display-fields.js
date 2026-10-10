'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add capacity_warning_threshold column
    await queryInterface.addColumn('grow_environments', 'capacity_warning_threshold', {
      type: Sequelize.INTEGER,
      defaultValue: 80,
      allowNull: true,
      comment: 'Percentage threshold (0-100) for capacity warnings',
    });

    // Add display_color column
    await queryInterface.addColumn('grow_environments', 'display_color', {
      type: Sequelize.STRING(20),
      defaultValue: '#10B981',
      allowNull: true,
      comment: 'Hex color code for calendar and UI display',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove columns
    await queryInterface.removeColumn('grow_environments', 'capacity_warning_threshold');
    await queryInterface.removeColumn('grow_environments', 'display_color');
  },
};
