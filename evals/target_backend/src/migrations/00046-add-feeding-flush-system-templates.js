'use strict';

/**
 * Feeding v2 — Group 5: flush/water-only week flags + system (seeded) templates.
 * - is_flush / is_water_only flags on template + grow weeks.
 * - is_system on templates (read-only, seeded brand charts users clone), and
 *   user_id made nullable so system templates can be unowned.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    const flagCols = {
      is_flush: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_water_only: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    };
    for (const table of ['feeding_schedule_template_weeks', 'grow_feeding_weeks']) {
      for (const [col, def] of Object.entries(flagCols)) {
        await queryInterface.addColumn(table, col, def);
      }
    }

    await queryInterface.addColumn('feeding_schedule_templates', 'is_system', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // System templates are unowned. Raw ALTER is reliable for dropping NOT NULL
    // (changeColumn can leave the constraint in place on Postgres).
    await queryInterface.sequelize.query(
      'ALTER TABLE feeding_schedule_templates ALTER COLUMN user_id DROP NOT NULL;'
    );
    await queryInterface.addIndex('feeding_schedule_templates', ['is_system']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('feeding_schedule_templates', ['is_system']);
    // Remove unowned (system) rows so the NOT NULL can be restored.
    await queryInterface.sequelize.query(
      'DELETE FROM feeding_schedule_templates WHERE user_id IS NULL;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE feeding_schedule_templates ALTER COLUMN user_id SET NOT NULL;'
    );
    await queryInterface.removeColumn('feeding_schedule_templates', 'is_system');
    for (const table of ['feeding_schedule_template_weeks', 'grow_feeding_weeks']) {
      await queryInterface.removeColumn(table, 'is_water_only');
      await queryInterface.removeColumn(table, 'is_flush');
    }
  },
};
