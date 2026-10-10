// Feed-event types — the plan↔log layer over a grow's weekly feeding schedule.
import type { GrowFeedingWeek } from "./feedingSchedule";

export type FeedEventStatus = "planned" | "done" | "skipped";

export interface FeedEvent {
  id: string;
  grow_feeding_schedule_id: string;
  grow_feeding_week_id: string | null;
  grow_log_id: string | null;
  week_number: number;
  status: FeedEventStatus;
  performed_at: string | null;
  measured_ec: number | null;
  measured_ppm: number | null;
  measured_ph: number | null;
  runoff_ec: number | null;
  runoff_ph: number | null;
  notes: string | null;
  week?: GrowFeedingWeek;
}

export interface MarkFeedEventInput {
  status?: FeedEventStatus;
  performed_at?: string | null;
  measured_ec?: number | null;
  measured_ppm?: number | null;
  measured_ph?: number | null;
  runoff_ec?: number | null;
  runoff_ph?: number | null;
  notes?: string | null;
}

export interface FeedEventsResponse {
  feedEvents: FeedEvent[];
}
export interface FeedEventResponse {
  feedEvent: FeedEvent;
}
