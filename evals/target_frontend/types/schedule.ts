/**
 * Schedule-related TypeScript type definitions
 */

// Entity types for polymorphic associations
export type EntityType = 'grow' | 'garden' | 'plant';

// Event types
export type EventType = 'feeding' | 'watering' | 'phase_change' | 'harvest' | 'custom';

// Event status
export type EventStatus = 'pending' | 'completed' | 'skipped' | 'cancelled';

// Quick create templates
export type QuickCreateTemplate =
  | 'daily_watering'
  | 'every_other_day'
  | 'weekly_feeding'
  | 'bi_weekly_feeding';

/**
 * ScheduledEvent - Main event entity
 */
export interface ScheduledEvent {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  description: string | null;
  eventType: EventType;
  startDate: string; // ISO8601 date string
  endDate: string | null; // ISO8601 date string
  allDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string | null; // RFC 5545 RRULE string
  recurrenceEndDate: string | null; // ISO8601 date string
  color: string | null; // Hex color code
  environmentId: string | null;
  status: EventStatus;
  completedAt: string | null; // ISO8601 date string
  createdAt: string;
  updatedAt: string;

  // Associated data (loaded with include)
  environment?: {
    id: string;
    name: string;
    displayColor: string | null;
  };
}

/**
 * CreateEventInput - Fields required for creating an event
 */
export interface CreateEventInput {
  entityType: EntityType;
  entityId: string;
  title: string;
  description?: string | null;
  eventType: EventType;
  startDate: string; // ISO8601 date string
  endDate?: string | null; // ISO8601 date string
  allDay?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: string | null; // RFC 5545 RRULE string (e.g., "FREQ=DAILY;INTERVAL=2")
  recurrenceEndDate?: string | null; // ISO8601 date string
  color?: string | null; // Hex color code (e.g., "#10B981")
  environmentId?: string | null;
}

/**
 * UpdateEventInput - Fields that can be updated
 */
export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  eventType?: EventType;
  startDate?: string; // ISO8601 date string
  endDate?: string | null; // ISO8601 date string
  allDay?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  recurrenceEndDate?: string | null;
  color?: string | null;
  environmentId?: string | null;
  status?: EventStatus;
}

/**
 * EventFilters - Query parameters for filtering events
 */
export interface EventFilters {
  entityType?: EntityType;
  entityId?: string;
  environmentId?: string;
  status?: EventStatus;
  startDate?: string; // ISO8601 date string
  endDate?: string; // ISO8601 date string
  limit?: number;
  offset?: number;
}

/**
 * ScheduleAgenda - Grouped events for mobile agenda view
 */
export interface ScheduleAgenda {
  overdue: ScheduledEvent[];
  today: ScheduledEvent[];
  upcoming: ScheduledEvent[];
}

/**
 * QuickCreateInput - Template-based quick creation
 */
export interface QuickCreateInput {
  template: QuickCreateTemplate;
  entityType: EntityType;
  entityId: string;
  startDate: string; // ISO8601 date string
  environmentId?: string | null;
}

/**
 * API response for list events
 */
export interface ScheduleEventsResponse {
  events: ScheduledEvent[];
  total: number;
}
