'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grow_logs table
    await queryInterface.createTable('grow_logs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      grow_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'grows',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Grow this log entry belongs to',
      },
      logged_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'When this log entry was created',
      },
      day_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Day number in the grow cycle',
      },
      phase: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Current phase: germination, vegetative, flowering, harvest',
      },
      height_inches: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
        comment: 'Plant height in inches',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Log entry notes',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add CHECK constraint for phase field
    await queryInterface.sequelize.query(`
      ALTER TABLE grow_logs
      ADD CONSTRAINT check_grow_log_phase
      CHECK (phase IN ('germination', 'vegetative', 'flowering', 'harvest'))
    `);

    // Add indexes for common queries
    await queryInterface.addIndex('grow_logs', ['grow_id']);
    await queryInterface.addIndex('grow_logs', ['logged_at']);
    await queryInterface.addIndex('grow_logs', ['phase']);

    // Add composite index for grow_id + logged_at (for chronological queries)
    await queryInterface.addIndex('grow_logs', ['grow_id', 'logged_at'], {
      name: 'idx_grow_logs_grow_time',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grow_logs');
  },
};
