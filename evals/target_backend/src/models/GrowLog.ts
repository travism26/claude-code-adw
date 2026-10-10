import { Model, DataTypes, Sequelize } from 'sequelize';
import { Grow } from './Grow';

export class GrowLog extends Model {
  declare id: string;
  declare grow_id: string;
  declare logged_at: Date;
  declare day_number: number | null;
  declare phase: 'germination' | 'vegetative' | 'flowering' | 'harvest' | null;
  declare height_inches: number | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare grow?: Grow;

  static initSchema(sequelize: Sequelize) {
    GrowLog.init(
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
        logged_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        day_number: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Day number must be greater than or equal to 0',
            },
          },
        },
        phase: {
          type: DataTypes.STRING(20),
          allowNull: true,
          validate: {
            isIn: {
              args: [['germination', 'vegetative', 'flowering', 'harvest']],
              msg: 'Phase must be one of: germination, vegetative, flowering, harvest',
            },
          },
        },
        height_inches: {
          type: DataTypes.DECIMAL(5, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Height must be greater than or equal to 0',
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
        tableName: 'grow_logs',
        modelName: 'GrowLog',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['grow_id'],
          },
          {
            fields: ['logged_at'],
          },
          {
            fields: ['phase'],
          },
          {
            fields: ['grow_id', 'logged_at'],
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
      height_inches:
        typeof values.height_inches === 'string'
          ? parseFloat(values.height_inches)
          : values.height_inches,
    };
  }
}

export default GrowLog;
