import { Model, DataTypes, Sequelize } from 'sequelize';

/**
 * AnalysisUsage Model
 *
 * Tracks daily AI analysis usage per user for rate limiting.
 * Each record represents a user's usage for a specific date (in their timezone).
 * Supports admin-granted bonus analyses via bonus_analyses field.
 */
export class AnalysisUsage extends Model {
  declare id: string;
  declare user_id: string;
  declare usage_date: string; // DATEONLY format (YYYY-MM-DD)
  declare analyses_used: number;
  declare bonus_analyses: number;
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    AnalysisUsage.init(
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
        usage_date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          comment: 'Date for this usage record (no time component)',
        },
        analyses_used: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Analyses used cannot be negative',
            },
          },
        },
        bonus_analyses: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Bonus analyses cannot be negative',
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
        tableName: 'analysis_usage',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            unique: true,
            fields: ['user_id', 'usage_date'],
            name: 'unique_user_usage_date',
          },
          {
            fields: ['user_id'],
            name: 'idx_analysis_usage_user_id',
          },
          {
            fields: ['usage_date'],
            name: 'idx_analysis_usage_usage_date',
          },
        ],
      }
    );
  }
}
