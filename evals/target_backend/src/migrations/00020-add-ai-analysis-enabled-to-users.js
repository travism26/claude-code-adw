'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add ai_analysis_enabled column to users table
    await queryInterface.addColumn('users', 'ai_analysis_enabled', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Feature flag to enable/disable AI garden analysis for this user',
    });

    // Update existing users to have AI analysis enabled (maintain current behavior)
    await queryInterface.sequelize.query(`
      UPDATE users
      SET ai_analysis_enabled = true
      WHERE ai_analysis_enabled IS NULL
    `);
  },

  async down(queryInterface) {
    // Remove column
    await queryInterface.removeColumn('users', 'ai_analysis_enabled');
  },
};
