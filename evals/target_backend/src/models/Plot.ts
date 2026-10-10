import { Model, DataTypes, Sequelize } from 'sequelize';

export class Plot extends Model {
  declare id: string;
  declare garden_id: string;
  declare plant_profile_id: string | null;
  declare x: number;
  declare y: number;
  declare width: number;
  declare height: number;
  declare notes: string | null;
  declare compass_direction: string | null;
  /**
   * Current lifecycle status of the plot:
   * - 'planned': Plot is defined but plants haven't been physically planted yet (default)
   * - 'planted': Plants are in the ground and actively growing
   * - 'harvested': Plants have been harvested
   * - 'archived': Plot is no longer active
   */
  declare status: 'planned' | 'planted' | 'harvested' | 'archived';
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    Plot.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        garden_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        plant_profile_id: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        x: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'X coordinate must be greater than or equal to 0',
            },
          },
        },
        y: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Y coordinate must be greater than or equal to 0',
            },
          },
        },
        width: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0.1],
              msg: 'Plot width must be greater than 0',
            },
            max: {
              args: [1000],
              msg: 'Plot width cannot exceed 1000 feet',
            },
          },
        },
        height: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0.1],
              msg: 'Plot height must be greater than 0',
            },
            max: {
              args: [1000],
              msg: 'Plot height cannot exceed 1000 feet',
            },
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        compass_direction: {
          type: DataTypes.STRING(2),
          allowNull: true,
          validate: {
            isIn: {
              args: [['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']],
              msg: 'Compass direction must be one of: N, NE, E, SE, S, SW, W, NW',
            },
          },
        },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'planned',
          validate: {
            isIn: {
              args: [['planned', 'planted', 'harvested', 'archived']],
              msg: 'Status must be one of: planned, planted, harvested, archived',
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
        tableName: 'plots',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );
  }

  /**
   * Convert DECIMAL fields to numbers during JSON serialization.
   * PostgreSQL DECIMAL values are returned as strings by Sequelize to preserve precision,
   * but the frontend expects numbers for coordinate fields (x, y, width, height).
   * This method is automatically called during JSON.stringify() and res.json() in Express.
   */
  toJSON(): any {
    const values = super.toJSON() as any;
    return {
      ...values,
      x: typeof values.x === 'string' ? parseFloat(values.x) : values.x,
      y: typeof values.y === 'string' ? parseFloat(values.y) : values.y,
      width: typeof values.width === 'string' ? parseFloat(values.width) : values.width,
      height: typeof values.height === 'string' ? parseFloat(values.height) : values.height,
    };
  }
}
