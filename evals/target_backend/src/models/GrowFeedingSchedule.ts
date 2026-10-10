import { Model, DataTypes, Sequelize } from 'sequelize';
import { GrowFeedingWeek } from './GrowFeedingWeek';

/**
 * A grow's active weekly feeding schedule — an editable snapshot, optionally
 * created from a template (source_template_id is informational only).
 * One per grow (grow_id unique).
 */
export class GrowFeedingSchedule extends Model {
  declare id: string;
  declare grow_id: string;
  declare source_template_id: string | null;
  declare strength_pct: number;
  declare reservoir_gallons: number | null;
  declare week_counting_mode: 'continuous' | 'flip-reset' | 'stage-based';
  declare flower_start_week: number | null;
  declare ppm_scale: number;
  declare display_unit: string;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare weeks?: GrowFeedingWeek[];

  static initSchema(sequelize: Sequelize) {
    GrowFeedingSchedule.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        grow_id: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          references: { model: 'grows', key: 'id' },
          onDelete: 'CASCADE',
        },
        source_template_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'feeding_schedule_templates', key: 'id' },
          onDelete: 'SET NULL',
        },
        strength_pct: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 75,
          validate: { min: 1, max: 100 },
        },
        reservoir_gallons: {
          type: DataTypes.DECIMAL(6, 2),
          allowNull: true,
          validate: { min: { args: [0], msg: 'Reservoir must be >= 0' } },
        },
        week_counting_mode: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'continuous',
          validate: {
            isIn: {
              args: [['continuous', 'flip-reset', 'stage-based']],
              msg: 'Invalid week_counting_mode',
            },
          },
        },
        flower_start_week: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: { min: 1 },
        },
        ppm_scale: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 500,
          validate: { isIn: { args: [[500, 700]], msg: 'ppm_scale must be 500 or 700' } },
        },
        display_unit: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: 'ml/gal',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'grow_feeding_schedules',
        modelName: 'GrowFeedingSchedule',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [{ unique: true, fields: ['grow_id'] }],
      }
    );
  }

  toJSON(): any {
    const values = super.toJSON() as any;
    return {
      ...values,
      reservoir_gallons:
        typeof values.reservoir_gallons === 'string'
          ? parseFloat(values.reservoir_gallons)
          : values.reservoir_gallons,
    };
  }
}

export default GrowFeedingSchedule;
