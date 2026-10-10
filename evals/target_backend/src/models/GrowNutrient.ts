import { Model, DataTypes, Sequelize } from 'sequelize';
import { Grow } from './Grow';
import { Nutrient } from './Nutrient';

export class GrowNutrient extends Model {
  declare id: string;
  declare grow_id: string;
  declare nutrient_id: string;
  declare dosage_ml_per_gallon: number | null;
  declare frequency: 'every_watering' | 'weekly' | 'biweekly' | 'as_needed' | null;
  declare phase_used: 'all' | 'vegetative' | 'flowering' | 'late_flowering' | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare grow?: Grow;
  declare nutrient?: Nutrient;

  static initSchema(sequelize: Sequelize) {
    GrowNutrient.init(
      {
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
          onDelete: 'CASCADE',
        },
        nutrient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'nutrients',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        dosage_ml_per_gallon: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Dosage must be greater than or equal to 0',
            },
          },
        },
        frequency: {
          type: DataTypes.STRING(20),
          allowNull: true,
          validate: {
            isIn: {
              args: [['every_watering', 'weekly', 'biweekly', 'as_needed']],
              msg: 'Frequency must be one of: every_watering, weekly, biweekly, as_needed',
            },
          },
        },
        phase_used: {
          type: DataTypes.STRING(20),
          allowNull: true,
          validate: {
            isIn: {
              args: [['all', 'vegetative', 'flowering', 'late_flowering']],
              msg: 'Phase used must be one of: all, vegetative, flowering, late_flowering',
            },
          },
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
        tableName: 'grow_nutrients',
        modelName: 'GrowNutrient',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['grow_id'],
          },
          {
            fields: ['nutrient_id'],
          },
          {
            unique: true,
            fields: ['grow_id', 'nutrient_id'],
          },
        ],
      }
    );
  }

  /**
   * Convert DECIMAL fields to numbers during JSON serialization.
   */
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

export default GrowNutrient;
