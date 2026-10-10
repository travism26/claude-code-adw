'use strict';

/**
 * v1.1 safety pass for the feeding calendar:
 * - strength_pct: feed-chart strength multiplier (charts are intentionally "hot";
 *   growers run 50-75%). Applied to displayed doses without mutating the baseline.
 * - reservoir_gallons: batch/reservoir volume so the app can compute the actual
 *   amount to mix per feeding instead of leaving ml/gal x gallons math to the user.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    await queryInterface.addColumn('grow_feeding_schedules', 'strength_pct', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 75,
    });
    await queryInterface.addColumn('grow_feeding_schedules', 'reservoir_gallons', {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('grow_feeding_schedules', 'reservoir_gallons');
    await queryInterface.removeColumn('grow_feeding_schedules', 'strength_pct');
  },
};
