import { Model, DataTypes, Sequelize } from 'sequelize';
import { PlantProfile } from './PlantProfile';

export class SeasonalTip extends Model {
  declare id: string;
  declare plant_profile_id: string;
  declare zone_min: number | null;
  declare zone_max: number | null;
  declare season: 'spring' | 'summer' | 'fall' | 'winter' | 'year_round';
  declare tip_text: string;
  declare timing_weeks: number | null;
  declare priority: number;

  // Timestamps
  declare readonly created_at: Date;
  declare readonly updated_at: Date;

  // Associations
  declare plantProfile?: PlantProfile;

  static initSchema(sequelize: Sequelize) {
    SeasonalTip.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        plant_profile_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: PlantProfile,
            key: 'id',
          },
        },
        zone_min: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 1,
            max: 13,
          },
        },
        zone_max: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 1,
            max: 13,
          },
        },
        season: {
          type: DataTypes.ENUM('spring', 'summer', 'fall', 'winter', 'year_round'),
          allowNull: false,
        },
        tip_text: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        timing_weeks: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        priority: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
      },
      {
        sequelize,
        modelName: 'SeasonalTip',
        tableName: 'seasonal_tips',
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ['plant_profile_id'] },
          { fields: ['season'] },
          { fields: ['zone_min', 'zone_max'] },
          { fields: ['plant_profile_id', 'season'] },
        ],
      }
    );

    // Define association
    SeasonalTip.belongsTo(PlantProfile, {
      foreignKey: 'plant_profile_id',
      as: 'plantProfile',
    });
  }
}

export default SeasonalTip;
