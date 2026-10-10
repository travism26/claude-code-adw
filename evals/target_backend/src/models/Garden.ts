import { Model, DataTypes, Sequelize } from 'sequelize';

export class Garden extends Model {
  declare id: string;
  declare user_id: string;
  declare name: string;
  declare zone: string | null;
  declare width: number;
  declare height: number;
  declare notes: string | null;
  declare layout_preferences: any | null;
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    Garden.init(
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
        name: {
          type: DataTypes.STRING(100),
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Garden name is required',
            },
            len: {
              args: [1, 100],
              msg: 'Garden name must be between 1 and 100 characters',
            },
          },
        },
        zone: {
          type: DataTypes.STRING(10),
          allowNull: true,
          validate: {
            is: {
              args: /^([0-9]|1[0-3])[ab]?$/i,
              msg: 'Zone must be a valid USDA hardiness zone (e.g., 5a, 10b)',
            },
          },
        },
        width: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0.1],
              msg: 'Garden width must be greater than 0',
            },
            max: {
              args: [10000],
              msg: 'Garden width cannot exceed 10000 feet',
            },
          },
        },
        height: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0.1],
              msg: 'Garden height must be greater than 0',
            },
            max: {
              args: [10000],
              msg: 'Garden height cannot exceed 10000 feet',
            },
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        layout_preferences: {
          type: DataTypes.JSONB,
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
        tableName: 'gardens',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );
  }
}
