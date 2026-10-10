import { Model, DataTypes, Sequelize } from 'sequelize';
import { Grow } from './Grow';
import { User } from './User';
import { AITask } from './AITask';

/**
 * GrowAnalysis Model
 *
 * Stores AI-generated grow analysis results with historical tracking.
 * Each analysis includes suggestions, overall score, and summary.
 * Supports multiple analyses per grow with is_current flag.
 */
export class GrowAnalysis extends Model {
  declare id: string;
  declare grow_id: string;
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

  // Associations
  declare grow?: Grow;
  declare user?: User;
  declare aiTask?: AITask;

  static initSchema(sequelize: Sequelize) {
    GrowAnalysis.init(
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
          onDelete: 'CASCADE',
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
        tableName: 'grow_analyses',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );
  }

  /**
   * Set up model associations
   */
  static associate() {
    GrowAnalysis.belongsTo(Grow, {
      foreignKey: 'grow_id',
      as: 'grow',
      onDelete: 'CASCADE',
    });

    GrowAnalysis.belongsTo(User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });

    GrowAnalysis.belongsTo(AITask, {
      foreignKey: 'ai_task_id',
      as: 'aiTask',
      onDelete: 'SET NULL',
    });
  }
}
