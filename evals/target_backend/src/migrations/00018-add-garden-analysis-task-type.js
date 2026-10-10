'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Add 'garden_analysis' to the task_type enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_ai_tasks_task_type" ADD VALUE IF NOT EXISTS 'garden_analysis';
    `);
  },

  async down(queryInterface) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type to remove a value
    // For safety, we'll leave the value in place on rollback
    console.log('Note: Cannot remove enum value in PostgreSQL. Manual intervention required if needed.');
  },
};
