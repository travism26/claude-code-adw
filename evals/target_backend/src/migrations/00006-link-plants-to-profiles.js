'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add plant_profile_id to plants table
    await queryInterface.addColumn('plants', 'plant_profile_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'plant_profiles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Reference to plant profile (null for manually entered plants)',
    });

    // Add index for querying plants by profile
    await queryInterface.addIndex('plants', ['plant_profile_id']);
  },

  async down(queryInterface) {
    // Remove index first
    await queryInterface.removeIndex('plants', ['plant_profile_id']);

    // Remove column
    await queryInterface.removeColumn('plants', 'plant_profile_id');
  },
};
