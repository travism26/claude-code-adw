import { Model, DataTypes, Sequelize } from 'sequelize';
import { GrowFeedingWeek } from './GrowFeedingWeek';
import { GrowLog } from './GrowLog';

export type FeedEventStatus = 'planned' | 'done' | 'skipped';

/**
 * A materialized feeding event for one schedule week. Identity is
 * (grow_feeding_schedule_id, week_number) so it survives schedule edits that
 * rebuild week rows. Carries the planned/done/skipped state, an optional
 * back-datable performed_at, and measured/runoff EC/PPM/pH readings.
 */
export class FeedEvent extends Model {
  declare id: string;
  declare grow_feeding_schedule_id: string;
  declare grow_feeding_week_id: string | null;
  declare grow_log_id: string | null;
  declare week_number: number;
  declare status: FeedEventStatus;
  declare performed_at: Date | null;
  declare measured_ec: number | null;
  declare measured_ppm: number | null;
  declare measured_ph: number | null;
  declare runoff_ec: number | null;
  declare runoff_ph: number | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare week?: GrowFeedingWeek;
  declare growLog?: GrowLog;

  static initSchema(sequelize: Sequelize) {
    FeedEvent.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        grow_feeding_schedule_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'grow_feeding_schedules', key: 'id' },
          onDelete: 'CASCADE',
        },
        grow_feeding_week_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'grow_feeding_weeks', key: 'id' },
          onDelete: 'SET NULL',
        },
        grow_log_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'grow_logs', key: 'id' },
          onDelete: 'SET NULL',
        },
        week_number: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: { min: 1 },
        },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'planned',
          validate: {
            isIn: {
              args: [['planned', 'done', 'skipped']],
              msg: 'status must be planned, done, or skipped',
            },
          },
        },
        performed_at: { type: DataTypes.DATE, allowNull: true },
        measured_ec: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        measured_ppm: { type: DataTypes.INTEGER, allowNull: true },
        measured_ph: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
        runoff_ec: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        runoff_ph: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
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
        tableName: 'feed_events',
        modelName: 'FeedEvent',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { fields: ['grow_feeding_schedule_id'] },
          { fields: ['grow_feeding_week_id'] },
          {
            unique: true,
            fields: ['grow_feeding_schedule_id', 'week_number'],
            name: 'feed_events_schedule_week_unique',
          },
        ],
      }
    );
  }

  toJSON(): any {
    const v = super.toJSON() as any;
    const num = (x: any) => (typeof x === 'string' ? parseFloat(x) : x);
    return {
      ...v,
      measured_ec: num(v.measured_ec),
      measured_ph: num(v.measured_ph),
      runoff_ec: num(v.runoff_ec),
      runoff_ph: num(v.runoff_ph),
    };
  }
}

export default FeedEvent;
