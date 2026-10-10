import { Model, DataTypes, Sequelize } from "sequelize";

export class PlantProfile extends Model {
  declare id: string;
  declare name: string;
  declare species: string | null;
  declare common_name: string | null;
  declare type:
    | "vegetable"
    | "herb"
    | "flower"
    | "houseplant"
    | "fruit"
    | "tree"
    | "succulent"
    | "vine";
  declare default_water_interval_days: number;
  declare default_fert_interval_days: number | null;
  declare zone_min: number | null;
  declare zone_max: number | null;
  declare sunlight_requirements:
    | "full_sun"
    | "partial_sun"
    | "partial_shade"
    | "full_shade"
    | null;
  declare soil_type: string | null;
  declare spacing_inches: number | null;
  declare plant_family: string | null;
  declare description: string | null;
  declare difficulty: "easy" | "moderate" | "challenging";
  declare indoor_outdoor: "indoor" | "outdoor" | "both";
  declare icon_url: string | null;

  // Timestamps
  declare readonly created_at: Date;
  declare readonly updated_at: Date;

  /**
   * Validates icon_url paths for security
   * Blocks path traversal, system paths, and enforces whitelist pattern
   * @param value - The icon_url to validate
   * @returns true if valid or null, throws ValidationError otherwise
   */
  static isValidIconPath(value: string | null): boolean {
    // null is allowed (fallback to default icon)
    if (value === null || value === undefined) {
      return true;
    }

    // Must be a string
    if (typeof value !== "string") {
      throw new Error("icon_url must be a string or null");
    }

    // Block path traversal patterns
    if (value.includes("..") || value.includes("\\") || value.includes("//")) {
      throw new Error("icon_url contains invalid path traversal characters");
    }

    // Block system directory paths
    const systemPaths = [
      "/etc/",
      "/var/",
      "/usr/",
      "/bin/",
      "/sbin/",
      "/root/",
      "/home/",
    ];
    if (systemPaths.some((path) => value.toLowerCase().includes(path))) {
      throw new Error("icon_url cannot reference system directories");
    }

    // Enforce whitelist pattern: /plant-icons/{type}/{filename}.(svg|png)
    // Type must be one of the valid plant types: vegetable, herb, flower, houseplant, fruit, tree, succulent, vine, default
    const iconPathRegex =
      /^\/plant-icons\/(vegetable|herb|flower|houseplant|fruit|tree|succulent|vine|default)\/[a-z0-9-]+\.(svg|png)$/;

    if (!iconPathRegex.test(value)) {
      throw new Error(
        "icon_url must match pattern: /plant-icons/{type}/{name}.(svg|png) where type is a valid plant type and name contains only lowercase letters, numbers, and hyphens"
      );
    }

    return true;
  }

  static initSchema(sequelize: Sequelize) {
    PlantProfile.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        species: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        common_name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        type: {
          type: DataTypes.ENUM(
            "vegetable",
            "herb",
            "flower",
            "houseplant",
            "fruit",
            "tree",
            "succulent",
            "vine"
          ),
          allowNull: false,
          validate: {
            isIn: {
              args: [
                [
                  "vegetable",
                  "herb",
                  "flower",
                  "houseplant",
                  "fruit",
                  "tree",
                  "succulent",
                  "vine",
                ],
              ],
              msg: "Invalid plant type",
            },
          },
        },
        default_water_interval_days: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 1,
            max: 365,
          },
        },
        default_fert_interval_days: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 1,
            max: 365,
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
        sunlight_requirements: {
          type: DataTypes.ENUM(
            "full_sun",
            "partial_sun",
            "partial_shade",
            "full_shade"
          ),
          allowNull: true,
          validate: {
            isIn: {
              args: [
                ["full_sun", "partial_sun", "partial_shade", "full_shade"],
              ],
              msg: "Invalid sunlight requirement",
            },
          },
        },
        soil_type: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        spacing_inches: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 0,
          },
        },
        plant_family: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        difficulty: {
          type: DataTypes.ENUM("easy", "moderate", "challenging"),
          allowNull: false,
          defaultValue: "moderate",
          validate: {
            isIn: {
              args: [["easy", "moderate", "challenging"]],
              msg: "Invalid difficulty level",
            },
          },
        },
        indoor_outdoor: {
          type: DataTypes.ENUM("indoor", "outdoor", "both"),
          allowNull: false,
          defaultValue: "outdoor",
        },
        icon_url: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {
            isValidIcon(value: string | null) {
              PlantProfile.isValidIconPath(value);
            },
          },
        },
      },
      {
        sequelize,
        modelName: "PlantProfile",
        tableName: "plant_profiles",
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ["name"] },
          { fields: ["type"] },
          { fields: ["zone_min", "zone_max"] },
          { fields: ["difficulty"] },
          { fields: ["indoor_outdoor"] },
        ],
      }
    );
  }
}

export default PlantProfile;
