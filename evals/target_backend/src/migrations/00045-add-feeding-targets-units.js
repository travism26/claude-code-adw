'use strict';

/**
 * Feeding v2 — Group 2: per-week EC/PPM/pH targets + unit system.
 * - Per-week target ranges on both template weeks and grow weeks (pH lockout is
 *   the real failure mode a dose-only tracker hides).
 * - ppm_scale (500/700) + display_unit on the schedule/template so PPM numbers
 *   are unambiguous and doses can be shown in the grower's unit.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    const targetCols = {
      ec_min: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      ec_max: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      ppm_min: { type: DataTypes.INTEGER, allowNull: true },
      ppm_max: { type: DataTypes.INTEGER, allowNull: true },
      ph_min: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
      ph_max: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
    };
    for (const table of ['feeding_schedule_template_weeks', 'grow_feeding_weeks']) {
      for (const [col, def] of Object.entries(targetCols)) {
        await queryInterface.addColumn(table, col, def);
      }
    }

    for (const table of ['feeding_schedule_templates', 'grow_feeding_schedules']) {
      await queryInterface.addColumn(table, 'ppm_scale', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 500,
      });
      await queryInterface.addColumn(table, 'display_unit', {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'ml/gal',
      });
    }
  },

  async down(queryInterface) {
    for (const table of ['feeding_schedule_template_weeks', 'grow_feeding_weeks']) {
      for (const col of ['ec_min', 'ec_max', 'ppm_min', 'ppm_max', 'ph_min', 'ph_max']) {
        await queryInterface.removeColumn(table, col);
      }
    }
    for (const table of ['feeding_schedule_templates', 'grow_feeding_schedules']) {
      await queryInterface.removeColumn(table, 'ppm_scale');
      await queryInterface.removeColumn(table, 'display_unit');
    }
  },
};
