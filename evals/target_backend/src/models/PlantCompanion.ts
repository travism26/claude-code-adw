import { Model, DataTypes, Sequelize } from 'sequelize';

export class PlantCompanion extends Model {
  declare id: string;
  declare plant_a_id: string;
  declare plant_b_id: string;
  declare relationship: 'beneficial' | 'harmful';
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    PlantCompanion.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        plant_a_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        plant_b_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        relationship: {
          type: DataTypes.ENUM('beneficial', 'harmful'),
          allowNull: false,
          validate: {
            isIn: {
              args: [['beneficial', 'harmful']],
              msg: 'Relationship must be either beneficial or harmful',
            },
          },
        },
        notes: {
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
        tableName: 'plant_companions',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );
  }
}
