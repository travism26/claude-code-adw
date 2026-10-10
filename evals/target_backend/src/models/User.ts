import { Model, DataTypes } from 'sequelize';
import { Sequelize } from 'sequelize';
import * as bcrypt from 'bcryptjs';

export class User extends Model {
  declare id: string;
  declare email: string;
  declare password_hash: string;
  declare tz: string;
  declare refresh_token: string;
  declare growing_zone: string | null;
  declare postal_code: string | null;
  declare zone_override: boolean;
  declare ai_analysis_enabled: boolean;

  // Helper method to validate password
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  static initSchema(sequelize: Sequelize) {
    User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        email: {
          type: DataTypes.TEXT,
          allowNull: false,
          unique: true,
          validate: {
            isEmail: true,
          },
        },
        password_hash: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        tz: {
          type: DataTypes.STRING(64),
          allowNull: false,
          defaultValue: 'UTC',
          validate: {
            isValidTimezone(value: string) {
              try {
                Intl.DateTimeFormat(undefined, { timeZone: value });
              } catch (e) {
                throw new Error('Invalid timezone');
              }
            },
          },
        },
        refresh_token: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        growing_zone: {
          type: DataTypes.STRING(5),
          allowNull: true,
          validate: {
            isValidZone(value: string) {
              if (value && !/^([1-9]|1[0-3])[ab]?$/.test(value)) {
                throw new Error('Growing zone must be in format like "6a", "7b", or "10"');
              }
            },
          },
        },
        postal_code: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        zone_override: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        ai_analysis_enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        underscored: true,
        hooks: {
          beforeCreate: async (user: User) => {
            if (user.changed('password_hash')) {
              const salt = await bcrypt.genSalt(10);
              user.password_hash = await bcrypt.hash(user.password_hash, salt);
            }
          },
          beforeUpdate: async (user: User) => {
            if (user.changed('password_hash')) {
              const salt = await bcrypt.genSalt(10);
              user.password_hash = await bcrypt.hash(user.password_hash, salt);
            }
          },
        },
      }
    );
  }
}

export default User;
