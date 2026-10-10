'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Change ec from DECIMAL(4, 2) to DECIMAL(6, 2) to support µS/cm values (0-9999.99)
    await queryInterface.changeColumn('grow_log_environments', 'ec', {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: 'Electrical conductivity (supports both mS/cm and µS/cm units)',
    });
  },

  async down(queryInterface, { DataTypes }) {
    // Revert to original precision
    await queryInterface.changeColumn('grow_log_environments', 'ec', {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      comment: 'Electrical conductivity',
    });
  },
};
