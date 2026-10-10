import { Model, DataTypes, Sequelize } from 'sequelize';
import { FeedingScheduleTemplateWeekNutrient } from './FeedingScheduleTemplateWeekNutrient';

/** One week within a feeding-schedule template (ordered by week_number). */
export class FeedingScheduleTemplateWeek extends Model {
  declare id: string;
  declare template_id: string;
  declare week_number: number;
  declare notes: string | null;
  declare ec_min: number | null;
  declare ec_max: number | null;
  declare ppm_min: number | null;
  declare ppm_max: number | null;
  declare ph_min: number | null;
  declare ph_max: number | null;
  declare is_flush: boolean;
  declare is_water_only: boolean;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare weekNutrients?: FeedingScheduleTemplateWeekNutrient[];

  static initSchema(sequelize: Sequelize) {
    FeedingScheduleTemplateWeek.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        template_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'feeding_schedule_templates', key: 'id' },
          onDelete: 'CASCADE',
        },
        week_number: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: { min: 1 },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        ec_min: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        ec_max: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        ppm_min: { type: DataTypes.INTEGER, allowNull: true },
        ppm_max: { type: DataTypes.INTEGER, allowNull: true },
        ph_min: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
        ph_max: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
        is_flush: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_water_only: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
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
        tableName: 'feeding_schedule_template_weeks',
        modelName: 'FeedingScheduleTemplateWeek',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { fields: ['template_id'] },
          { unique: true, fields: ['template_id', 'week_number'] },
        ],
      }
    );
  }

  toJSON(): any {
    const v = super.toJSON() as any;
    const num = (x: any) => (typeof x === 'string' ? parseFloat(x) : x);
    return { ...v, ec_min: num(v.ec_min), ec_max: num(v.ec_max), ph_min: num(v.ph_min), ph_max: num(v.ph_max) };
  }
}

export default FeedingScheduleTemplateWeek;
