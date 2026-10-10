import { Model, DataTypes, Sequelize } from 'sequelize';
import { User } from './User';

export class Nutrient extends Model {
  declare id: string;
  declare user_id: string | null;
  declare brand: string;
  declare product_name: string;
  declare type: 'base' | 'supplement' | 'additive' | 'ph_adjuster' | 'other';
  declare npk_ratio: string | null;
  declare description: string | null;
  declare is_organic: boolean;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare owner?: User;

  static initSchema(sequelize: Sequelize) {
    Nutrient.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: User,
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        brand: {
          type: DataTypes.STRING(100),
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        product_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        type: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'base',
          validate: {
            isIn: {
              args: [['base', 'supplement', 'additive', 'ph_adjuster', 'other']],
              msg: 'Type must be one of: base, supplement, additive, ph_adjuster, other',
            },
          },
        },
        npk_ratio: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        is_organic: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      },
      {
        sequelize,
        tableName: 'nutrients',
        modelName: 'Nutrient',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['user_id'],
          },
          {
            fields: ['brand'],
          },
          {
            fields: ['type'],
          },
        ],
      }
    );
  }
}

export default Nutrient;
