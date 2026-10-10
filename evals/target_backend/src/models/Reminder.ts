import {
  Model,
  DataTypes,
  Sequelize,
  Optional,
  BelongsToGetAssociationMixin,
} from 'sequelize';
import { Plant } from './Plant';
import { User } from './User';

interface ReminderAttributes {
  id: string;
  user_id: string;
  plant_id: string;
  type: 'water' | 'fertilize';
  scheduled_date: Date;
  sent_at: Date | null;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

type ReminderCreationAttributes = Optional<
    ReminderAttributes,
    | 'id'
    | 'sent_at'
    | 'status'
    | 'retry_count'
    | 'error_message'
    | 'created_at'
    | 'updated_at'
  >

export class Reminder
  extends Model<ReminderAttributes, ReminderCreationAttributes>
  implements ReminderAttributes
{
  public id!: string;
  public user_id!: string;
  public plant_id!: string;
  public type!: 'water' | 'fertilize';
  public scheduled_date!: Date;
  public sent_at!: Date | null;
  public status!: 'pending' | 'sent' | 'failed';
  public retry_count!: number;
  public error_message!: string | null;

  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations
  public getPlant!: BelongsToGetAssociationMixin<Plant>;
  public getUser!: BelongsToGetAssociationMixin<User>;

  public static initSchema(sequelize: Sequelize): void {
    Reminder.init(
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
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        plant_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'plants',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        type: {
          type: DataTypes.ENUM('water', 'fertilize'),
          allowNull: false,
        },
        scheduled_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        sent_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('pending', 'sent', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        retry_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        error_message: {
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
        tableName: 'reminders',
        timestamps: true,
        underscored: true,
        indexes: [
          // Index for querying reminders by user
          {
            fields: ['user_id'],
          },
          // Index for querying reminders by plant
          {
            fields: ['plant_id'],
          },
          // Index for querying reminders by status
          {
            fields: ['status'],
          },
          // Index for querying reminders by scheduled date
          {
            fields: ['scheduled_date'],
          },
          // Composite index for finding existing reminders
          {
            fields: ['plant_id', 'type', 'scheduled_date'],
          },
        ],
      }
    );
  }
}

export default Reminder;
