import { Model, DataTypes, Sequelize } from 'sequelize';
import { User } from './User';

export class GrowEnvironment extends Model {
  declare id: string;
  declare user_id: string;
  declare name: string;
  declare type: 'tent' | 'room' | 'closet' | 'outdoor' | 'greenhouse';
  declare width_inches: number | null;
  declare depth_inches: number | null;
  declare height_inches: number | null;
  declare light_type: 'led' | 'hps' | 'mh' | 'cfl' | 'sun' | 'other' | null;
  declare light_wattage: number | null;
  declare ventilation_cfm: number | null;
  declare has_carbon_filter: boolean;
  declare has_humidifier: boolean;
  declare has_dehumidifier: boolean;
  declare has_ac: boolean;
  declare has_heater: boolean;
  declare max_plants: number | null;
  declare notes: string | null;
  declare is_active: boolean;
  declare capacity_warning_threshold: number | null;
  declare display_color: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare owner?: User;
  declare grows?: any[]; // Will be typed properly when Grow model is updated

  static initSchema(sequelize: Sequelize) {
    GrowEnvironment.init(
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
            model: User,
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Name is required',
            },
            len: {
              args: [1, 100],
              msg: 'Name must be between 1 and 100 characters',
            },
          },
        },
        type: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'tent',
          validate: {
            isIn: {
              args: [['tent', 'room', 'closet', 'outdoor', 'greenhouse']],
              msg: 'Type must be one of: tent, room, closet, outdoor, greenhouse',
            },
          },
        },
        width_inches: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [1],
              msg: 'Width must be at least 1 inch',
            },
          },
        },
        depth_inches: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [1],
              msg: 'Depth must be at least 1 inch',
            },
          },
        },
        height_inches: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [1],
              msg: 'Height must be at least 1 inch',
            },
          },
        },
        light_type: {
          type: DataTypes.STRING(20),
          allowNull: true,
          validate: {
            isIn: {
              args: [['led', 'hps', 'mh', 'cfl', 'sun', 'other']],
              msg: 'Light type must be one of: led, hps, mh, cfl, sun, other',
            },
          },
        },
        light_wattage: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [1],
              msg: 'Light wattage must be greater than 0',
            },
          },
        },
        ventilation_cfm: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [1],
              msg: 'Ventilation CFM must be greater than 0',
            },
          },
        },
        has_carbon_filter: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        has_humidifier: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        has_dehumidifier: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        has_ac: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        has_heater: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        max_plants: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [1],
              msg: 'Max plants must be at least 1',
            },
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        capacity_warning_threshold: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 80,
          validate: {
            min: {
              args: [0],
              msg: 'Capacity warning threshold must be at least 0',
            },
            max: {
              args: [100],
              msg: 'Capacity warning threshold must be at most 100',
            },
          },
        },
        display_color: {
          type: DataTypes.STRING(20),
          allowNull: true,
          defaultValue: '#10B981',
          validate: {
            is: {
              args: /^#[0-9A-Fa-f]{6}$/,
              msg: 'Display color must be a valid hex color code (e.g., #10B981)',
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
        tableName: 'grow_environments',
        modelName: 'GrowEnvironment',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['user_id'],
          },
          {
            fields: ['is_active'],
          },
        ],
      }
    );
  }
}

export default GrowEnvironment;
