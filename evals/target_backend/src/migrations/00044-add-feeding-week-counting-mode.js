'use strict';

/**
 * Feeding v2 — Group 1: flip-anchored week counting.
 * - week_counting_mode: 'continuous' (age-anchored from grow start, current
 *   behavior) | 'flip-reset' (flower weeks counted from the 12/12 flip) |
 *   'stage-based'.
 * - flower_start_week: the week_number at which flowering begins; weeks at/after
 *   it anchor to the grow's flowering phase_started_at in flip-reset mode.
 * Added to both grow schedules (active) and templates (default copied on apply).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    for (const table of ['grow_feeding_schedules', 'feeding_schedule_templates']) {
      await queryInterface.addColumn(table, 'week_counting_mode', {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'continuous',
      });
      await queryInterface.addColumn(table, 'flower_start_week', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    for (const table of ['grow_feeding_schedules', 'feeding_schedule_templates']) {
      await queryInterface.removeColumn(table, 'flower_start_week');
      await queryInterface.removeColumn(table, 'week_counting_mode');
    }
  },
};
