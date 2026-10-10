import { Model, DataTypes, Sequelize } from 'sequelize';

/**
 * GardenAnalysis Model
 *
 * Stores AI-generated garden analysis results with historical tracking.
 * Each analysis includes suggestions, overall score, and summary.
 * Supports multiple analyses per garden with is_current flag.
 */
export class GardenAnalysis extends Model {
  declare id: string;
  declare garden_id: string;
  declare user_id: string;
  declare ai_task_id: string | null;
  declare suggestions: Array<{
    type: string;
    category: string;
    title: string;
    description: string;
    affectedIds: string[];
    priority: 'low' | 'medium' | 'high';
    actionable: boolean;
  }>;
  declare overall_score: number;
  declare summary: string;
  declare is_current: boolean;
  declare analyzed_at: Date;
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    GardenAnalysis.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        garden_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'gardens',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        ai_task_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'ai_tasks',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        suggestions: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        overall_score: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Overall score must be at least 0',
            },
            max: {
              args: [100],
              msg: 'Overall score must be at most 100',
            },
          },
        },
        summary: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: '',
          validate: {
            notEmpty: {
              msg: 'Summary is required',
            },
          },
        },
        is_current: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        analyzed_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
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
        tableName: 'garden_analyses',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );
  }
}
