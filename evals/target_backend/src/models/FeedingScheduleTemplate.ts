import { Model, DataTypes, Sequelize } from 'sequelize';
import { FeedingScheduleTemplateWeek } from './FeedingScheduleTemplateWeek';

/**
 * A reusable, user-owned weekly feeding chart (e.g. "Synthetic Bloom — 9 week").
 * Owns an ordered list of weeks; each week lists nutrients with a per-week dosage.
 */
export class FeedingScheduleTemplate extends Model {
  declare id: string;
  declare user_id: string | null;
  declare is_system: boolean;
  declare name: string;
  declare description: string | null;
  declare week_counting_mode: 'continuous' | 'flip-reset' | 'stage-based';
  declare flower_start_week: number | null;
  declare ppm_scale: number;
  declare display_unit: string;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare weeks?: FeedingScheduleTemplateWeek[];

  static initSchema(sequelize: Sequelize) {
    FeedingScheduleTemplate.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        is_system: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: { notEmpty: true },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
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
        tableName: 'feeding_schedule_templates',
        modelName: 'FeedingScheduleTemplate',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [{ fields: ['user_id'] }],
      }
    );
  }
}

export default FeedingScheduleTemplate;
