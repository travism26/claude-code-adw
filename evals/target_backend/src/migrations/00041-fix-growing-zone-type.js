'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Change growing_zone from INTEGER to VARCHAR(5) to support formats like "7a", "10b", etc.
    await queryInterface.changeColumn('users', 'growing_zone', {
      type: DataTypes.STRING(5),
      allowNull: true,
      comment: 'USDA Hardiness Zone (e.g., "6a", "7b", "10")',
    });
  },

  async down(queryInterface, { DataTypes }) {
    // Revert back to INTEGER (data loss will occur for zones with letters)
    await queryInterface.changeColumn('users', 'growing_zone', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'USDA Hardiness Zone (1-13)',
    });
  },
};
