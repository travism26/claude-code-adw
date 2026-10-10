'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes }) {
    const ts = {
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    };

    // 1. feeding_schedule_templates
    await queryInterface.createTable('feeding_schedule_templates', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('feeding_schedule_templates', ['user_id']);

    // 2. feeding_schedule_template_weeks
    await queryInterface.createTable('feeding_schedule_template_weeks', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      template_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'feeding_schedule_templates', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      week_number: { type: DataTypes.INTEGER, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('feeding_schedule_template_weeks', ['template_id']);
    await queryInterface.addIndex('feeding_schedule_template_weeks', ['template_id', 'week_number'], { unique: true });

    // 3. feeding_schedule_template_week_nutrients
    await queryInterface.createTable('feeding_schedule_template_week_nutrients', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      template_week_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'feeding_schedule_template_weeks', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      nutrient_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'nutrients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      dosage_ml_per_gallon: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('feeding_schedule_template_week_nutrients', ['template_week_id']);
    await queryInterface.addIndex('feeding_schedule_template_week_nutrients', ['nutrient_id']);

    // 4. grow_feeding_schedules
    await queryInterface.createTable('grow_feeding_schedules', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      grow_id: {
        type: DataTypes.UUID, allowNull: false, unique: true,
        references: { model: 'grows', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      source_template_id: {
        type: DataTypes.UUID, allowNull: true,
        references: { model: 'feeding_schedule_templates', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      ...ts,
    });

    // 5. grow_feeding_weeks
    await queryInterface.createTable('grow_feeding_weeks', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      grow_feeding_schedule_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'grow_feeding_schedules', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      week_number: { type: DataTypes.INTEGER, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('grow_feeding_weeks', ['grow_feeding_schedule_id']);
    await queryInterface.addIndex('grow_feeding_weeks', ['grow_feeding_schedule_id', 'week_number'], { unique: true });

    // 6. grow_feeding_week_nutrients
    await queryInterface.createTable('grow_feeding_week_nutrients', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      grow_feeding_week_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'grow_feeding_weeks', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      nutrient_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'nutrients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      dosage_ml_per_gallon: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('grow_feeding_week_nutrients', ['grow_feeding_week_id']);
    await queryInterface.addIndex('grow_feeding_week_nutrients', ['nutrient_id']);
  },

  async down(queryInterface) {
    // Drop in reverse dependency order
    await queryInterface.dropTable('grow_feeding_week_nutrients');
    await queryInterface.dropTable('grow_feeding_weeks');
    await queryInterface.dropTable('grow_feeding_schedules');
    await queryInterface.dropTable('feeding_schedule_template_week_nutrients');
    await queryInterface.dropTable('feeding_schedule_template_weeks');
    await queryInterface.dropTable('feeding_schedule_templates');
  },
};
