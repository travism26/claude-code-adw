import { Model, DataTypes, Sequelize } from "sequelize";

/**
 * AITask Model
 *
 * Stores AI requests and responses for audit trail and retrieval
 * Supports multiple AI task types and tracks processing status
 */
export class AITask extends Model {
  declare id: string;
  declare queue_job_id: string | null;
  declare user_id: string | null;
  declare plant_id: string | null;
  declare task_type:
    | "plant_update_suggestion"
    | "weather_based_action"
    | "care_recommendation"
    | "pest_diagnosis"
    | "general"
    | "garden_analysis"
    | "layout_generation"
    | "grow_analysis"
    | "grow_photo_analysis"
    | "grow_nutrient_recommendation";
  declare status: "pending" | "processing" | "completed" | "failed";
  declare request_payload: Record<string, any>;
  declare response_data: Record<string, any> | null;
  declare model_used: string | null;
  declare error_message: string | null;
  declare created_at: Date;
  declare updated_at: Date;
  declare completed_at: Date | null;

  static initSchema(sequelize: Sequelize) {
    AITask.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        queue_job_id: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        plant_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: "plants",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        task_type: {
          type: DataTypes.ENUM(
            "plant_update_suggestion",
            "weather_based_action",
            "care_recommendation",
            "pest_diagnosis",
            "general",
            "garden_analysis",
            "layout_generation",
            "grow_analysis",
            "grow_photo_analysis",
            "grow_nutrient_recommendation"
          ),
          allowNull: false,
          validate: {
            isIn: {
              args: [
                [
                  "plant_update_suggestion",
                  "weather_based_action",
                  "care_recommendation",
                  "pest_diagnosis",
                  "general",
                  "garden_analysis",
                  "layout_generation",
                  "grow_analysis",
                  "grow_photo_analysis",
                  "grow_nutrient_recommendation",
                ],
              ],
              msg: "Task type must be one of: plant_update_suggestion, weather_based_action, care_recommendation, pest_diagnosis, general, garden_analysis, layout_generation, grow_analysis, grow_photo_analysis, grow_nutrient_recommendation",
            },
          },
        },
        status: {
          type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
          allowNull: false,
          defaultValue: "pending",
          validate: {
            isIn: {
              args: [["pending", "processing", "completed", "failed"]],
              msg: "Status must be one of: pending, processing, completed, failed",
            },
          },
        },
        request_payload: {
          type: DataTypes.JSONB,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: "Request payload is required",
            },
          },
        },
        response_data: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        model_used: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        error_message: {
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
        completed_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "ai_tasks",
        underscored: true,
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
  }
}
