'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    // Add environment_id column to grows table
    await queryInterface.addColumn('grows', 'environment_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'grow_environments',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Optional reference to the grow environment (tent/room) where this grow takes place',
    });

    // Add index on environment_id for query optimization
    await queryInterface.addIndex('grows', ['environment_id']);
  },

  async down(queryInterface) {
    // Remove index
    await queryInterface.removeIndex('grows', ['environment_id']);

    // Remove column
    await queryInterface.removeColumn('grows', 'environment_id');
  },
};
