'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add queue_job_id column to ai_tasks table
    await queryInterface.addColumn('ai_tasks', 'queue_job_id', {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'BullMQ job ID for tracking queue processing',
    });

    // Add index for queue_job_id for faster lookups
    await queryInterface.addIndex('ai_tasks', ['queue_job_id'], {
      name: 'ai_tasks_queue_job_id_idx',
    });
  },

  async down(queryInterface) {
    // Remove index first
    await queryInterface.removeIndex('ai_tasks', 'ai_tasks_queue_job_id_idx');

    // Remove column
    await queryInterface.removeColumn('ai_tasks', 'queue_job_id');
  },
};
