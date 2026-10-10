import { Model, DataTypes, Sequelize } from 'sequelize';
import { Plant } from './Plant';
import { User } from './User';

export class CareHistory extends Model {
  declare id: string;
  declare plant_id: string;
  declare user_id: string;
  declare action_type: 'water' | 'fertilize' | 'prune' | 'harvest' | 'transplant' | 'pest_control' | 'other';
  declare action_date: Date;
  declare notes: string | null;

  // Timestamps
  declare readonly created_at: Date;
  declare readonly updated_at: Date;

  // Associations
  declare plant?: Plant;
  declare user?: User;

  static initSchema(sequelize: Sequelize) {
    CareHistory.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        plant_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: Plant,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: User,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        action_type: {
          type: DataTypes.ENUM('water', 'fertilize', 'prune', 'harvest', 'transplant', 'pest_control', 'other'),
          allowNull: false,
          validate: {
            isIn: {
              args: [['water', 'fertilize', 'prune', 'harvest', 'transplant', 'pest_control', 'other']],
              msg: 'Invalid action type',
            },
          },
        },
        action_date: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'CareHistory',
        tableName: 'care_history',
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ['plant_id'] },
          { fields: ['user_id'] },
          { fields: ['action_type'] },
          { fields: ['action_date'] },
          { fields: ['plant_id', 'action_type', 'action_date'] },
        ],
      }
    );
  }
}

export default CareHistory;
