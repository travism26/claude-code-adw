import { Model, DataTypes, Sequelize } from 'sequelize';
import { Nutrient } from './Nutrient';

/** A nutrient + per-week dosage assigned to a template week. */
export class FeedingScheduleTemplateWeekNutrient extends Model {
  declare id: string;
  declare template_week_id: string;
  declare nutrient_id: string;
  declare dosage_ml_per_gallon: number | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare nutrient?: Nutrient;

  static initSchema(sequelize: Sequelize) {
    FeedingScheduleTemplateWeekNutrient.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        template_week_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'feeding_schedule_template_weeks', key: 'id' },
          onDelete: 'CASCADE',
        },
        nutrient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'nutrients', key: 'id' },
          onDelete: 'CASCADE',
        },
        dosage_ml_per_gallon: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          validate: { min: { args: [0], msg: 'Dosage must be >= 0' } },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
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
        tableName: 'feeding_schedule_template_week_nutrients',
        modelName: 'FeedingScheduleTemplateWeekNutrient',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { fields: ['template_week_id'] },
          { fields: ['nutrient_id'] },
        ],
      }
    );
  }

  toJSON(): any {
    const values = super.toJSON() as any;
    return {
      ...values,
      dosage_ml_per_gallon:
        typeof values.dosage_ml_per_gallon === 'string'
          ? parseFloat(values.dosage_ml_per_gallon)
          : values.dosage_ml_per_gallon,
    };
  }
}

export default FeedingScheduleTemplateWeekNutrient;
