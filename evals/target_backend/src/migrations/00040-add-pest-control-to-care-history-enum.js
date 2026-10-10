'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'pest_control' to the enum_care_history_action_type enum
    await queryInterface.sequelize.query(
      "ALTER TYPE enum_care_history_action_type ADD VALUE IF NOT EXISTS 'pest_control'"
    );
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // To rollback, we would need to recreate the enum without 'pest_control'
    // which is complex and potentially destructive. For now, this is a no-op.
    console.log(
      'Warning: Rolling back enum_care_history_action_type is not supported. ' +
      'The pest_control value will remain in the enum.'
    );
  },
};
