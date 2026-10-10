'use strict';

/**
 * Feeding v2 — Group 3: plan ↔ log feed events.
 *
 * One materialized event per schedule week, carrying a planned|done|skipped
 * status, an optional back-datable performed_at, and measured/runoff EC/PPM/pH.
 *
 * Identity is (grow_feeding_schedule_id, week_number) — NOT the volatile
 * grow_feeding_week row id — so that editing a schedule (which destroys and
 * recreates its week rows) preserves event status by week number. The nullable
 * grow_feeding_week_id is a convenience link to the current recipe row,
 * refreshed on materialize and SET NULL if that row is dropped. grow_log_id
 * links a done event to its timeline entry so a feeding is logged once.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    await queryInterface.createTable('feed_events', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      grow_feeding_schedule_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'grow_feeding_schedules', key: 'id' },
        onDelete: 'CASCADE',
      },
      grow_feeding_week_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'grow_feeding_weeks', key: 'id' },
        onDelete: 'SET NULL',
      },
      grow_log_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'grow_logs', key: 'id' },
        onDelete: 'SET NULL',
      },
      week_number: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'planned',
      },
      performed_at: { type: DataTypes.DATE, allowNull: true },
      measured_ec: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      measured_ppm: { type: DataTypes.INTEGER, allowNull: true },
      measured_ph: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
      runoff_ec: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      runoff_ph: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('feed_events', ['grow_feeding_schedule_id']);
    await queryInterface.addIndex('feed_events', ['grow_feeding_week_id']);
    await queryInterface.addIndex('feed_events', {
      unique: true,
      fields: ['grow_feeding_schedule_id', 'week_number'],
      name: 'feed_events_schedule_week_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('feed_events');
  },
};
