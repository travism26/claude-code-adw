import { Model, DataTypes, Sequelize } from "sequelize";

/**
 * Notification Model
 *
 * Stores user notifications with support for different types and embedded links.
 * Supports real-time delivery via WebSocket and historical retrieval via API.
 * Designed to be modular and extensible for future email/SMS channels.
 */
export class Notification extends Model {
  declare id: string;
  declare user_id: string;
  declare message: string;
  declare link: string | null;
  declare type: "info" | "success" | "warning" | "error" | null;
  declare read: boolean;
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    Notification.init(
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
            model: "users",
            key: "id",
          },
          // onUpdate: 'CASCADE',
          onDelete: "CASCADE",
          validate: {
            notEmpty: {
              msg: "User ID is required",
            },
          },
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: "Message is required",
            },
            len: {
              args: [1, 5000],
              msg: "Message must be between 1 and 5000 characters",
            },
          },
        },
        link: {
          type: DataTypes.STRING(500),
          allowNull: true,
        },
        type: {
          type: DataTypes.ENUM("info", "success", "warning", "error"),
          allowNull: true,
          defaultValue: "info",
          validate: {
            isIn: {
              args: [["info", "success", "warning", "error"]],
              msg: "Type must be one of: info, success, warning, error",
            },
          },
        },
        read: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
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
        tableName: "notifications",
        underscored: true,
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
  }
}
