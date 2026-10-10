'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add icon_url column to plant_profiles table
    await queryInterface.addColumn('plant_profiles', 'icon_url', {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Relative URL path to plant icon asset (e.g., /plant-icons/vegetable/tomato.svg). Security: Only paths matching /plant-icons/{type}/{name}.(svg|png) pattern are allowed.',
    });

    // Add index on icon_url for potential queries
    await queryInterface.addIndex('plant_profiles', ['icon_url'], {
      name: 'plant_profiles_icon_url_idx',
    });
  },

  async down(queryInterface) {
    // Remove index first
    await queryInterface.removeIndex('plant_profiles', 'plant_profiles_icon_url_idx');

    // Remove column
    await queryInterface.removeColumn('plant_profiles', 'icon_url');
  },
};
