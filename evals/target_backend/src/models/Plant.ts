import { Model, DataTypes } from "sequelize";
import { Sequelize } from "sequelize";
import { User } from "./User";

export class Plant extends Model {
  declare id: string;
  declare user_id: string;
  declare name: string;
  declare species: string | null;
  declare type: "indoor" | "outdoor";
  declare water_interval_days: number;
  declare fert_interval_days: number | null;
  declare last_watered: Date | null;
  declare last_fertilized: Date | null;
  declare photo_url: string | null;
  declare plant_profile_id: string | null;

  // Associations
  declare owner?: User;

  static initSchema(sequelize: Sequelize) {
    Plant.init(
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
            key: "id",
          },
          onDelete: 'CASCADE',
        },
        name: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        species: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        type: {
          type: DataTypes.STRING(10),
          allowNull: false,
          validate: {
            isIn: [["indoor", "outdoor"]],
          },
        },
        water_interval_days: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 1,
            max: 365, // Maximum 1 year interval
          },
        },
        fert_interval_days: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 1,
            max: 365,
          },
        },
        last_watered: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        last_fertilized: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        photo_url: {
          type: DataTypes.TEXT,
          allowNull: true,
          validate: {
            isUrl: true,
          },
        },
        plant_profile_id: {
          type: DataTypes.UUID,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "Plant",
        timestamps: true,
        underscored: true,
        indexes: [
          // Index for querying plants by user
          {
            fields: ["user_id"],
          },
          // Index for querying plants by last watered date
          {
            fields: ["last_watered"],
          },
          // Index for querying plants by profile
          {
            fields: ["plant_profile_id"],
          },
        ],
      }
    );

    // Define association
    Plant.belongsTo(User, {
      foreignKey: "user_id",
      as: "owner",
    });
  }
}

export default Plant;
