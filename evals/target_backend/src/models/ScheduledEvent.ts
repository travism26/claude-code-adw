import { Model, DataTypes, Sequelize } from 'sequelize';
import { User } from './User';
import { GrowEnvironment } from './GrowEnvironment';

/**
 * ScheduledEvent model for calendar events
 *
 * Supports polymorphic associations via entity_type + entity_id pattern:
 * - entity_type: 'grow' | 'garden' | 'plant'
 * - entity_id: UUID of the associated entity
 *
 * RRULE recurrence patterns (RFC 5545):
 * - recurrence_rule: RRULE string (e.g., "FREQ=DAILY;INTERVAL=2")
 * - is_recurring: boolean flag for quick filtering
 * - recurrence_end_date: optional end date for recurring events
 */
export class ScheduledEvent extends Model {
  declare id: string;
  declare user_id: string;
  declare entity_type: 'grow' | 'garden' | 'plant';
  declare entity_id: string;
  declare title: string;
  declare description: string | null;
  declare event_type: 'feeding' | 'watering' | 'phase_change' | 'harvest' | 'custom';
  declare start_date: Date;
  declare end_date: Date | null;
  declare all_day: boolean;
  declare is_recurring: boolean;
  declare recurrence_rule: string | null;
  declare recurrence_end_date: Date | null;
  declare color: string | null;
  declare environment_id: string | null;
  declare status: 'pending' | 'completed' | 'skipped' | 'cancelled';
  declare completed_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare user?: User;
  declare environment?: GrowEnvironment;

  static initSchema(sequelize: Sequelize) {
    ScheduledEvent.init(
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
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        entity_type: {
          type: DataTypes.STRING(20),
          allowNull: false,
          validate: {
            isIn: {
              args: [['grow', 'garden', 'plant']],
              msg: 'Entity type must be one of: grow, garden, plant',
            },
          },
        },
        entity_id: {
          type: DataTypes.UUID,
          allowNull: false,
          validate: {
            isUUID: {
              args: 4,
              msg: 'Entity ID must be a valid UUID',
            },
          },
        },
        title: {
          type: DataTypes.STRING(200),
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Title is required',
            },
            len: {
              args: [1, 200],
              msg: 'Title must be between 1 and 200 characters',
            },
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        event_type: {
          type: DataTypes.STRING(30),
          allowNull: false,
          validate: {
            isIn: {
              args: [['feeding', 'watering', 'phase_change', 'harvest', 'custom']],
              msg: 'Event type must be one of: feeding, watering, phase_change, harvest, custom',
            },
          },
        },
        start_date: {
          type: DataTypes.DATE,
          allowNull: false,
          validate: {
            isDate: true,
          },
        },
        end_date: {
          type: DataTypes.DATE,
          allowNull: true,
          validate: {
            isDate: true,
            isAfterStart(value: Date | null) {
              if (value && this.start_date && value < this.start_date) {
                throw new Error('End date must be after start date');
              }
            },
          },
        },
        all_day: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        is_recurring: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        recurrence_rule: {
          type: DataTypes.TEXT,
          allowNull: true,
          validate: {
            isValidRRule(value: string | null) {
              if (value && !value.startsWith('FREQ=')) {
                throw new Error('Recurrence rule must be a valid RRULE string (RFC 5545)');
              }
            },
          },
        },
        recurrence_end_date: {
          type: DataTypes.DATE,
          allowNull: true,
          validate: {
            isDate: true,
          },
        },
        color: {
          type: DataTypes.STRING(20),
          allowNull: true,
          validate: {
            is: {
              args: /^#[0-9A-Fa-f]{6}$/,
              msg: 'Color must be a valid hex color code (e.g., #10B981)',
            },
          },
        },
        environment_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: GrowEnvironment,
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'pending',
          validate: {
            isIn: {
              args: [['pending', 'completed', 'skipped', 'cancelled']],
              msg: 'Status must be one of: pending, completed, skipped, cancelled',
            },
          },
        },
        completed_at: {
          type: DataTypes.DATE,
          allowNull: true,
          validate: {
            isDate: true,
          },
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
        tableName: 'scheduled_events',
        modelName: 'ScheduledEvent',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            fields: ['user_id'],
          },
          {
            fields: ['entity_type', 'entity_id'],
          },
          {
            fields: ['start_date'],
          },
          {
            fields: ['status'],
          },
          {
            fields: ['is_recurring'],
          },
        ],
      }
    );
  }
}

export default ScheduledEvent;
