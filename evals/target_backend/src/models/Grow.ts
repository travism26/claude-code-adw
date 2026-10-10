import { Model, DataTypes, Sequelize } from 'sequelize';
import { User } from './User';

export class Grow extends Model {
  declare id: string;
  declare user_id: string;
  declare strain_name: string;
  declare strain_type: 'indica' | 'sativa' | 'hybrid' | 'ruderalis' | null;
  declare grow_method: 'soil' | 'coco' | 'hydro' | 'dwc' | 'aero' | 'other' | null;
  declare grow_medium: string | null;
  declare light_type: 'led' | 'hps' | 'mh' | 'cfl' | 'sun' | 'other' | null;
  declare light_wattage: number | null;
  declare grow_space_sqft: number | null;
  declare pot_size_gallons: number | null;
  declare plant_count: number;
  declare phase: 'germination' | 'vegetative' | 'flowering' | 'harvest' | 'archived';
  declare phase_started_at: Date | null;
  declare started_at: Date;
  declare harvested_at: Date | null;
  declare notes: string | null;
  declare environment_id: string | null;
  declare is_public: boolean;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare owner?: User;
  declare environment?: any; // Will be typed properly with GrowEnvironment

  static initSchema(sequelize: Sequelize) {
    Grow.init(
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
        strain_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        strain_type: {
          type: DataTypes.STRING(20),
          allowNull: true,
          validate: {
            isIn: {
              args: [['indica', 'sativa', 'hybrid', 'ruderalis']],
              msg: 'Strain type must be one of: indica, sativa, hybrid, ruderalis',
            },
          },
        },
        grow_method: {
          type: DataTypes.STRING(20),
          allowNull: true,
          validate: {
            isIn: {
              args: [['soil', 'coco', 'hydro', 'dwc', 'aero', 'other']],
              msg: 'Grow method must be one of: soil, coco, hydro, dwc, aero, other',
            },
          },
        },
        grow_medium: {
          type: DataTypes.STRING(100),
          allowNull: true,
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
        grow_space_sqft: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          validate: {
            min: {
              args: [0.1],
              msg: 'Grow space must be greater than 0',
            },
          },
        },
        pot_size_gallons: {
          type: DataTypes.DECIMAL(4, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0.1],
              msg: 'Pot size must be greater than 0',
            },
          },
        },
        plant_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          validate: {
            min: {
              args: [1],
              msg: 'Plant count must be at least 1',
            },
          },
        },
        phase: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'germination',
          validate: {
            isIn: {
              args: [['germination', 'vegetative', 'flowering', 'harvest', 'archived']],
              msg: 'Phase must be one of: germination, vegetative, flowering, harvest, archived',
            },
          },
        },
        phase_started_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        started_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        harvested_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        environment_id: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        is_public: {
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
        tableName: 'grows',
        modelName: 'Grow',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['user_id'],
          },
          {
            fields: ['phase'],
          },
          {
            fields: ['started_at'],
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
      grow_space_sqft:
        typeof values.grow_space_sqft === 'string'
          ? parseFloat(values.grow_space_sqft)
          : values.grow_space_sqft,
      pot_size_gallons:
        typeof values.pot_size_gallons === 'string'
          ? parseFloat(values.pot_size_gallons)
          : values.pot_size_gallons,
    };
  }
}

export default Grow;
