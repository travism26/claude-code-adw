import { Model, DataTypes, Sequelize } from 'sequelize';
import { GrowLog } from './GrowLog';

export class GrowLogPhoto extends Model {
  declare id: string;
  declare grow_log_id: string;
  declare file_path: string;
  declare thumbnail_path: string | null;
  declare original_filename: string;
  declare mime_type: string;
  declare file_size_bytes: number;
  declare width: number | null;
  declare height: number | null;
  declare caption: string | null;
  declare is_cover: boolean;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare growLog?: GrowLog;

  static initSchema(sequelize: Sequelize) {
    GrowLogPhoto.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        grow_log_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'grow_logs',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        file_path: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        thumbnail_path: {
          type: DataTypes.STRING(500),
          allowNull: true,
        },
        original_filename: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        mime_type: {
          type: DataTypes.STRING(50),
          allowNull: false,
          validate: {
            isIn: {
              args: [['image/jpeg', 'image/png', 'image/webp']],
              msg: 'MIME type must be one of: image/jpeg, image/png, image/webp',
            },
          },
        },
        file_size_bytes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'File size must be greater than or equal to 0',
            },
          },
        },
        width: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Width must be greater than or equal to 0',
            },
          },
        },
        height: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Height must be greater than or equal to 0',
            },
          },
        },
        caption: {
          type: DataTypes.STRING(500),
          allowNull: true,
        },
        is_cover: {
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
        tableName: 'grow_log_photos',
        modelName: 'GrowLogPhoto',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['grow_log_id'],
          },
          {
            fields: ['is_cover'],
          },
          {
            fields: ['grow_log_id', 'created_at'],
          },
        ],
      }
    );
  }
}

export default GrowLogPhoto;
