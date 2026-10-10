import { ScheduledEvent, GrowEnvironment, Grow, Garden, Plant } from '../models';
import { Op } from 'sequelize';
import { RRule } from 'rrule';

export interface CreateEventInput {
  entity_type: 'grow' | 'garden' | 'plant';
  entity_id: string;
  title: string;
  description?: string | null;
  event_type: 'feeding' | 'watering' | 'phase_change' | 'harvest' | 'custom';
  start_date: Date;
  end_date?: Date | null;
  all_day?: boolean;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  recurrence_end_date?: Date | null;
  color?: string | null;
  environment_id?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  event_type?: 'feeding' | 'watering' | 'phase_change' | 'harvest' | 'custom';
  start_date?: Date;
  end_date?: Date | null;
  all_day?: boolean;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  recurrence_end_date?: Date | null;
  color?: string | null;
  environment_id?: string | null;
  status?: 'pending' | 'completed' | 'skipped' | 'cancelled';
}

export interface EventFilters {
  entity_type?: 'grow' | 'garden' | 'plant';
  entity_id?: string;
  environment_id?: string;
  status?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

export interface ScheduleAgenda {
  overdue: ScheduledEvent[];
  today: ScheduledEvent[];
  upcoming: ScheduledEvent[];
}

export interface QuickCreateInput {
  template: 'daily_watering' | 'every_other_day' | 'weekly_feeding' | 'bi_weekly_feeding';
  entity_type: 'grow' | 'garden' | 'plant';
  entity_id: string;
  start_date: Date;
  environment_id?: string | null;
}

interface ExpandedEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: Date;
  end_date: Date | null;
  all_day: boolean;
  color: string | null;
  environment_id: string | null;
  status: string;
  entity_type: string;
  entity_id: string;
  is_recurring: boolean;
  original_event_id: string;
}

const QUICK_CREATE_TEMPLATES = {
  daily_watering: {
    title: 'Watering',
    event_type: 'watering' as const,
    recurrence_rule: 'FREQ=DAILY',
    is_recurring: true,
  },
  every_other_day: {
    title: 'Watering',
    event_type: 'watering' as const,
    recurrence_rule: 'FREQ=DAILY;INTERVAL=2',
    is_recurring: true,
  },
  weekly_feeding: {
    title: 'Feeding',
    event_type: 'feeding' as const,
    recurrence_rule: 'FREQ=WEEKLY',
    is_recurring: true,
  },
  bi_weekly_feeding: {
    title: 'Feeding',
    event_type: 'feeding' as const,
    recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2',
    is_recurring: true,
  },
};

/**
 * ScheduleService - Encapsulates all scheduled event operations
 */
export const ScheduleService = {
  /**
   * Validate that a polymorphic entity exists and belongs to the user
   */
  async validateEntityExists(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<boolean> {
    let entity = null;

    switch (entityType) {
      case 'grow':
        entity = await Grow.findOne({
          where: { id: entityId, user_id: userId },
        });
        break;
      case 'garden':
        entity = await Garden.findOne({
          where: { id: entityId, user_id: userId },
        });
        break;
      case 'plant':
        entity = await Plant.findOne({
          where: { id: entityId, user_id: userId },
        });
        break;
      default:
        return false;
    }

    return entity !== null;
  },

  /**
   * Create a new scheduled event
   */
  async create(userId: string, data: CreateEventInput): Promise<ScheduledEvent> {
    // Validate entity exists and belongs to user
    const entityExists = await this.validateEntityExists(
      data.entity_type,
      data.entity_id,
      userId
    );

    if (!entityExists) {
      throw new Error(`${data.entity_type} not found or does not belong to user`);
    }

    // Validate environment if provided
    if (data.environment_id) {
      const environment = await GrowEnvironment.findOne({
        where: { id: data.environment_id, user_id: userId },
      });
      if (!environment) {
        throw new Error('Environment not found or does not belong to user');
      }
    }

    return ScheduledEvent.create({
      ...data,
      user_id: userId,
      status: 'pending',
    });
  },

  /**
   * Get events with filters and date range expansion for recurring events
   */
  async getEvents(
    userId: string,
    filters?: EventFilters
  ): Promise<{ events: any[]; total: number }> {
    const whereClause: any = { user_id: userId };

    if (filters?.entity_type) {
      whereClause.entity_type = filters.entity_type;
    }

    if (filters?.entity_id) {
      whereClause.entity_id = filters.entity_id;
    }

    if (filters?.environment_id) {
      whereClause.environment_id = filters.environment_id;
    }

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    // Date range filtering for start_date
    if (filters?.start_date || filters?.end_date) {
      whereClause.start_date = {};
      if (filters.start_date) {
        whereClause.start_date[Op.gte] = filters.start_date;
      }
      if (filters.end_date) {
        whereClause.start_date[Op.lte] = filters.end_date;
      }
    }

    const { count, rows } = await ScheduledEvent.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: GrowEnvironment,
          as: 'environment',
          attributes: ['id', 'name', 'display_color'],
        },
      ],
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      order: [['start_date', 'ASC']],
    });

    // Expand recurring events if date range is specified
    let expandedEvents: any[] = [];
    if (filters?.start_date && filters?.end_date) {
      for (const event of rows) {
        if (event.is_recurring && event.recurrence_rule) {
          const expanded = this.expandRecurrences(
            event,
            filters.start_date,
            filters.end_date
          );
          expandedEvents.push(...expanded);
        } else {
          expandedEvents.push(event.toJSON());
        }
      }
    } else {
      expandedEvents = rows.map((e) => e.toJSON());
    }

    return { events: expandedEvents, total: count };
  },

  /**
   * Get a single event by ID
   */
  async getEventById(id: string, userId: string): Promise<ScheduledEvent | null> {
    return ScheduledEvent.findOne({
      where: { id, user_id: userId },
      include: [
        {
          model: GrowEnvironment,
          as: 'environment',
          attributes: ['id', 'name', 'display_color'],
        },
      ],
    });
  },

  /**
   * Update an event
   */
  async update(
    id: string,
    userId: string,
    data: UpdateEventInput
  ): Promise<ScheduledEvent | null> {
    const event = await ScheduledEvent.findOne({
      where: { id, user_id: userId },
    });

    if (!event) {
      return null;
    }

    // Validate environment if being updated
    if (data.environment_id) {
      const environment = await GrowEnvironment.findOne({
        where: { id: data.environment_id, user_id: userId },
      });
      if (!environment) {
        throw new Error('Environment not found or does not belong to user');
      }
    }

    await event.update(data);
    return event.reload({
      include: [
        {
          model: GrowEnvironment,
          as: 'environment',
          attributes: ['id', 'name', 'display_color'],
        },
      ],
    });
  },

  /**
   * Delete an event
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await ScheduledEvent.destroy({
      where: { id, user_id: userId },
    });
    return result > 0;
  },

  /**
   * Mark event as completed
   */
  async completeEvent(id: string, userId: string): Promise<ScheduledEvent | null> {
    const event = await ScheduledEvent.findOne({
      where: { id, user_id: userId },
    });

    if (!event) {
      return null;
    }

    await event.update({
      status: 'completed',
      completed_at: new Date(),
    });

    return event.reload({
      include: [
        {
          model: GrowEnvironment,
          as: 'environment',
          attributes: ['id', 'name', 'display_color'],
        },
      ],
    });
  },

  /**
   * Mark event as skipped
   */
  async skipEvent(id: string, userId: string): Promise<ScheduledEvent | null> {
    const event = await ScheduledEvent.findOne({
      where: { id, user_id: userId },
    });

    if (!event) {
      return null;
    }

    await event.update({
      status: 'skipped',
    });

    return event.reload({
      include: [
        {
          model: GrowEnvironment,
          as: 'environment',
          attributes: ['id', 'name', 'display_color'],
        },
      ],
    });
  },

  /**
   * Expand recurring events within a date range
   * Returns array of event instances with computed start_date values
   */
  expandRecurrences(
    event: ScheduledEvent,
    startDate: Date,
    endDate: Date
  ): ExpandedEvent[] {
    if (!event.recurrence_rule) {
      return [event.toJSON()];
    }

    try {
      // Parse RRULE string
      const rrule = RRule.fromString(event.recurrence_rule);

      // Set dtstart to the event's start date
      const dtstart = new Date(event.start_date);

      // Create RRule with dtstart
      const rule = new RRule({
        ...rrule.origOptions,
        dtstart,
      });

      // Limit by recurrence_end_date if set
      const until = event.recurrence_end_date
        ? new Date(Math.min(endDate.getTime(), event.recurrence_end_date.getTime()))
        : endDate;

      // Generate occurrences within date range (max 1 year to prevent performance issues)
      const maxDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      const finalEndDate = new Date(Math.min(until.getTime(), maxDate.getTime()));

      const occurrences = rule.between(startDate, finalEndDate, true);

      // Map occurrences to event instances
      return occurrences.map((date) => {
        const duration = event.end_date
          ? event.end_date.getTime() - event.start_date.getTime()
          : 0;

        return {
          id: `${event.id}_${date.getTime()}`, // Unique ID for each occurrence
          title: event.title,
          description: event.description,
          event_type: event.event_type,
          start_date: date,
          end_date: duration > 0 ? new Date(date.getTime() + duration) : null,
          all_day: event.all_day,
          color: event.color,
          environment_id: event.environment_id,
          status: event.status,
          entity_type: event.entity_type,
          entity_id: event.entity_id,
          is_recurring: true,
          original_event_id: event.id,
        };
      });
    } catch (error) {
      console.error('Error expanding recurrence:', error);
      return [event.toJSON()];
    }
  },

  /**
   * Get agenda view (overdue, today, upcoming)
   */
  async getAgenda(userId: string, days = 7): Promise<ScheduleAgenda> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const pastDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all events in the range
    const { events } = await this.getEvents(userId, {
      start_date: pastDate,
      end_date: futureDate,
    });

    // Group events
    const overdue = events.filter(
      (e) => new Date(e.start_date) < today && e.status === 'pending'
    );

    const todayEvents = events.filter(
      (e) =>
        new Date(e.start_date) >= today && new Date(e.start_date) < tomorrow
    );

    const upcoming = events.filter(
      (e) =>
        new Date(e.start_date) >= tomorrow &&
        new Date(e.start_date) <= futureDate
    );

    return {
      overdue: overdue.sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ),
      today: todayEvents.sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ),
      upcoming: upcoming.sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ),
    };
  },

  /**
   * Quick create event from template
   */
  async quickCreate(
    userId: string,
    data: QuickCreateInput
  ): Promise<ScheduledEvent> {
    const template = QUICK_CREATE_TEMPLATES[data.template];

    if (!template) {
      throw new Error(`Unknown template: ${data.template}`);
    }

    return this.create(userId, {
      ...template,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      start_date: data.start_date,
      environment_id: data.environment_id,
    });
  },
};

export default ScheduleService;
