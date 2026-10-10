import { Model, DataTypes, Sequelize } from 'sequelize';

export class Recommendation extends Model {
  declare id: string;
  declare user_id: string;
  declare plant_id: string | null;
  declare type: 'water' | 'fertilize' | 'prune' | 'pest_check' | 'harvest' | 'general';
  declare message: string;
  declare severity: 'low' | 'medium' | 'high';
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    Recommendation.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        plant_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'plants',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        type: {
          type: DataTypes.ENUM('water', 'fertilize', 'prune', 'pest_check', 'harvest', 'general'),
          allowNull: false,
          validate: {
            isIn: {
              args: [['water', 'fertilize', 'prune', 'pest_check', 'harvest', 'general']],
              msg: 'Type must be one of: water, fertilize, prune, pest_check, harvest, general',
            },
          },
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Recommendation message is required',
            },
          },
        },
        severity: {
          type: DataTypes.ENUM('low', 'medium', 'high'),
          allowNull: false,
          defaultValue: 'medium',
          validate: {
            isIn: {
              args: [['low', 'medium', 'high']],
              msg: 'Severity must be one of: low, medium, high',
            },
          },
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
        tableName: 'recommendations',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );
  }
}
