import { Model, DataTypes, Sequelize } from 'sequelize';
import { Grow } from './Grow';

export class GrowHarvest extends Model {
  declare id: string;
  declare grow_id: string;
  declare harvested_at: Date;
  declare wet_weight_grams: number | null;
  declare dry_weight_grams: number | null;
  declare trim_weight_grams: number | null;
  declare thc_percent: number | null;
  declare cbd_percent: number | null;
  declare terpene_profile: Record<string, number> | null;
  declare cure_days: number | null;
  declare quality_rating: number | null;
  declare smoke_report: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare grow?: Grow;

  static initSchema(sequelize: Sequelize) {
    GrowHarvest.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        grow_id: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          references: {
            model: 'grows',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        harvested_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        wet_weight_grams: {
          type: DataTypes.DECIMAL(7, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Wet weight must be greater than or equal to 0',
            },
          },
        },
        dry_weight_grams: {
          type: DataTypes.DECIMAL(7, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Dry weight must be greater than or equal to 0',
            },
          },
        },
        trim_weight_grams: {
          type: DataTypes.DECIMAL(6, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Trim weight must be greater than or equal to 0',
            },
          },
        },
        thc_percent: {
          type: DataTypes.DECIMAL(4, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'THC percentage must be between 0 and 100',
            },
            max: {
              args: [100],
              msg: 'THC percentage must be between 0 and 100',
            },
          },
        },
        cbd_percent: {
          type: DataTypes.DECIMAL(4, 1),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'CBD percentage must be between 0 and 100',
            },
            max: {
              args: [100],
              msg: 'CBD percentage must be between 0 and 100',
            },
          },
        },
        terpene_profile: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        cure_days: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Cure days must be greater than or equal to 0',
            },
          },
        },
        quality_rating: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: {
              args: [1],
              msg: 'Quality rating must be between 1 and 10',
            },
            max: {
              args: [10],
              msg: 'Quality rating must be between 1 and 10',
            },
          },
        },
        smoke_report: {
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
      },
      {
        sequelize,
        tableName: 'grow_harvests',
        modelName: 'GrowHarvest',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            unique: true,
            fields: ['grow_id'],
          },
          {
            fields: ['harvested_at'],
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
      wet_weight_grams:
        typeof values.wet_weight_grams === 'string'
          ? parseFloat(values.wet_weight_grams)
          : values.wet_weight_grams,
      dry_weight_grams:
        typeof values.dry_weight_grams === 'string'
          ? parseFloat(values.dry_weight_grams)
          : values.dry_weight_grams,
      trim_weight_grams:
        typeof values.trim_weight_grams === 'string'
          ? parseFloat(values.trim_weight_grams)
          : values.trim_weight_grams,
      thc_percent:
        typeof values.thc_percent === 'string'
          ? parseFloat(values.thc_percent)
          : values.thc_percent,
      cbd_percent:
        typeof values.cbd_percent === 'string'
          ? parseFloat(values.cbd_percent)
          : values.cbd_percent,
    };
  }
}

export default GrowHarvest;
