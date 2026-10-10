import { Model, DataTypes, Sequelize } from 'sequelize';
import { GrowLog } from './GrowLog';

export class GrowLogEnvironment extends Model {
  declare id: string;
  declare grow_log_id: string;
  declare temperature_f: number | null;
  declare humidity_percent: number | null;
  declare ph: number | null;
  declare ec: number | null;
  declare ppm: number | null;
  declare co2_ppm: number | null;
  declare light_hours: number | null;
  declare light_distance_inches: number | null;
  declare vpd: number | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare growLog?: GrowLog;

  static initSchema(sequelize: Sequelize) {
    GrowLogEnvironment.init(
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
        temperature_f: {
          type: DataTypes.DECIMAL(4, 1),
          allowNull: true,
          validate: {
            min: {
              args: [-50],
              msg: 'Temperature must be greater than -50°F',
            },
            max: {
              args: [150],
              msg: 'Temperature must be less than 150°F',
            },
          },
        },
        humidity_percent: {
          type: DataTypes.DECIMAL(4, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Humidity must be between 0 and 100',
            },
            max: {
              args: [100],
              msg: 'Humidity must be between 0 and 100',
            },
          },
        },
        ph: {
          type: DataTypes.DECIMAL(3, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'pH must be between 0 and 14',
            },
            max: {
              args: [14],
              msg: 'pH must be between 0 and 14',
            },
          },
        },
        ec: {
          type: DataTypes.DECIMAL(6, 2),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'EC must be greater than or equal to 0',
            },
          },
        },
        ppm: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'PPM must be greater than or equal to 0',
            },
          },
        },
        co2_ppm: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'CO2 PPM must be greater than or equal to 0',
            },
          },
        },
        light_hours: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Light hours must be between 0 and 24',
            },
            max: {
              args: [24],
              msg: 'Light hours must be between 0 and 24',
            },
          },
        },
        light_distance_inches: {
          type: DataTypes.DECIMAL(4, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Light distance must be greater than or equal to 0',
            },
          },
        },
        vpd: {
          type: DataTypes.DECIMAL(3, 2),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'VPD must be greater than or equal to 0',
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
        tableName: 'grow_log_environments',
        modelName: 'GrowLogEnvironment',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['grow_log_id'],
          },
        ],
      }
    );
  }

  /**
   * Convert DECIMAL fields to numbers during JSON serialization.
   */
  toJSON(): any {
    const values = super.toJSON() as any;
    return {
      ...values,
      temperature_f:
        typeof values.temperature_f === 'string'
          ? parseFloat(values.temperature_f)
          : values.temperature_f,
      humidity_percent:
        typeof values.humidity_percent === 'string'
          ? parseFloat(values.humidity_percent)
          : values.humidity_percent,
      ph: typeof values.ph === 'string' ? parseFloat(values.ph) : values.ph,
      ec: typeof values.ec === 'string' ? parseFloat(values.ec) : values.ec,
      light_distance_inches:
        typeof values.light_distance_inches === 'string'
          ? parseFloat(values.light_distance_inches)
          : values.light_distance_inches,
      vpd: typeof values.vpd === 'string' ? parseFloat(values.vpd) : values.vpd,
    };
  }
}

export default GrowLogEnvironment;
