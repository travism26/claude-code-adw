import { Model, DataTypes } from 'sequelize';
import { Sequelize } from 'sequelize';
import { Plant } from './Plant';

export class JournalEntry extends Model {
  declare id: string;
  declare plant_id: string;
  declare entry_ts: Date;
  declare note: string | null;
  declare photo_url: string | null;

  // Associations
  declare plant?: Plant;

  static initSchema(sequelize: Sequelize) {
    JournalEntry.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        plant_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: Plant,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        entry_ts: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true,
          validate: {
            len: [0, 1000], // Max 1000 characters as per requirements
          },
        },
        photo_url: {
          type: DataTypes.TEXT,
          allowNull: true,
          validate: {
            isUrl: true,
          },
        },
      },
      {
        sequelize,
        modelName: 'JournalEntry',
        timestamps: true,
        underscored: true,
        indexes: [
          // Index for querying entries by plant
          {
            fields: ['plant_id'],
          },
          // Index for querying entries by timestamp
          {
            fields: ['entry_ts'],
          },
        ],
      }
    );

    // Define association
    JournalEntry.belongsTo(Plant, {
      foreignKey: 'plant_id',
      as: 'plant',
    });
  }
}

export default JournalEntry;
