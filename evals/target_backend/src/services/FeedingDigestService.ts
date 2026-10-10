import { Op } from 'sequelize';
import {
  Grow,
  GrowFeedingSchedule,
  GrowFeedingWeek,
  GrowFeedingWeekNutrient,
  Nutrient,
  FeedEvent,
} from '../models';
import type { FeedEventStatus } from '../models/FeedEvent';
import { FeedingScheduleService } from './FeedingScheduleService';
import { FeedEventService } from './FeedEventService';
import { notificationService } from './notificationService';

/** Phases that are no longer actively feeding. */
const INACTIVE_PHASES = ['harvest', 'archived'];

export interface DueFeedingItem {
  nutrient_id: string;
  name: string;
  base_ml_per_gallon: number | null;
  /** Dose after the schedule's strength multiplier (canonical ml/gal). */
  adjusted_ml_per_gallon: number | null;
  /** adjusted × reservoir, the actual volume to add to the tank. */
  mix_ml: number | null;
}

export interface DueFeeding {
  grow_id: string;
  strain_name: string;
  week_number: number;
  segment: 'veg' | 'flower' | null;
  is_flush: boolean;
  is_water_only: boolean;
  status: FeedEventStatus;
  strength_pct: number;
  reservoir_gallons: number | null;
  display_unit: string;
  ppm_scale: number;
  ec_min: number | null;
  ec_max: number | null;
  ppm_min: number | null;
  ppm_max: number | null;
  ph_min: number | null;
  ph_max: number | null;
  items: DueFeedingItem[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const scheduleInclude = [
  {
    model: GrowFeedingWeek,
    as: 'weeks',
    include: [
      {
        model: GrowFeedingWeekNutrient,
        as: 'weekNutrients',
        include: [{ model: Nutrient, as: 'nutrient' }],
      },
    ],
  },
];

async function buildDue(
  grow: Grow,
  schedule: GrowFeedingSchedule,
  now: Date
): Promise<DueFeeding | null> {
  const weeksJson = (schedule.weeks ?? []).map((w) => w.toJSON());
  const derived = FeedingScheduleService.deriveWeekDates(grow.started_at, weeksJson, {
    now,
    countingMode: schedule.week_counting_mode,
    flowerStartWeek: schedule.flower_start_week,
    flipDate: grow.phase === 'flowering' ? grow.phase_started_at : null,
  });
  const current = derived.find((w) => w.is_current);
  if (!current) return null; // no week maps to today → nothing due

  // Make sure an event row exists for the current week, then read its status.
  await FeedEventService.materializeForSchedule(schedule);
  const event = await FeedEvent.findOne({
    where: { grow_feeding_schedule_id: schedule.id, week_number: current.week_number },
  });

  const strength = schedule.strength_pct ?? 75;
  const reservoir =
    schedule.reservoir_gallons != null ? Number(schedule.reservoir_gallons) : null;

  const items: DueFeedingItem[] = (current.weekNutrients ?? []).map((wn: any) => {
    const base = wn.dosage_ml_per_gallon != null ? Number(wn.dosage_ml_per_gallon) : null;
    const adjusted = base != null ? round2((base * strength) / 100) : null;
    const mix = adjusted != null && reservoir != null ? round2(adjusted * reservoir) : null;
    return {
      nutrient_id: wn.nutrient_id,
      name: wn.nutrient ? `${wn.nutrient.brand} ${wn.nutrient.product_name}` : 'Nutrient',
      base_ml_per_gallon: base,
      adjusted_ml_per_gallon: adjusted,
      mix_ml: mix,
    };
  });

  return {
    grow_id: grow.id,
    strain_name: grow.strain_name,
    week_number: current.week_number,
    segment: current.segment ?? null,
    is_flush: !!current.is_flush,
    is_water_only: !!current.is_water_only,
    status: (event?.status ?? 'planned') as FeedEventStatus,
    strength_pct: strength,
    reservoir_gallons: reservoir,
    display_unit: schedule.display_unit,
    ppm_scale: schedule.ppm_scale,
    ec_min: current.ec_min ?? null,
    ec_max: current.ec_max ?? null,
    ppm_min: current.ppm_min ?? null,
    ppm_max: current.ppm_max ?? null,
    ph_min: current.ph_min ?? null,
    ph_max: current.ph_max ?? null,
    items,
  };
}

export const FeedingDigestService = {
  /**
   * "What do I feed today" across a user's active grows: for each active grow
   * whose schedule has a week mapped to today, the recipe + strength/reservoir
   * adjusted amounts + the current event status (so done/skipped stay visible).
   */
  async getFeedingDue(userId: string, now: Date = new Date()): Promise<DueFeeding[]> {
    const schedules = await GrowFeedingSchedule.findAll({
      include: [
        {
          model: Grow,
          as: 'grow',
          required: true,
          where: { user_id: userId, phase: { [Op.notIn]: INACTIVE_PHASES } },
        },
        ...scheduleInclude,
      ],
      order: [[{ model: GrowFeedingWeek, as: 'weeks' }, 'week_number', 'ASC'] as any],
    });

    const out: DueFeeding[] = [];
    for (const schedule of schedules) {
      const grow = (schedule as any).grow as Grow;
      const due = await buildDue(grow, schedule, now);
      if (due) out.push(due);
    }
    return out;
  },

  /**
   * Send ONE consolidated "feeding due" notification to a user if any of their
   * active grows still have a planned (not done/skipped) feeding this week.
   * Returns the notification, or null when nothing is due. Never marks an event
   * done — dismissing the reminder must never silently complete a feeding.
   */
  async runDailyDigestForUser(userId: string, now: Date = new Date()) {
    const due = await this.getFeedingDue(userId, now);
    const planned = due.filter((d) => d.status === 'planned');
    if (planned.length === 0) return null;

    const names = planned
      .map((d) => `${d.strain_name} (wk ${d.week_number}${d.is_flush ? ' · flush' : ''})`)
      .join(', ');
    const message = `🌱 ${planned.length} grow${planned.length > 1 ? 's' : ''} due to feed today: ${names}`;
    return notificationService.sendNotification(userId, message, '/grows/feeding-today', 'info');
  },

  /**
   * Daily job entry point: one digest per user who owns an active grow with a
   * schedule. Returns counts for logging.
   */
  async runDailyDigest(now: Date = new Date()): Promise<{ users: number; sent: number }> {
    const schedules = await GrowFeedingSchedule.findAll({
      attributes: ['id'],
      include: [
        {
          model: Grow,
          as: 'grow',
          required: true,
          attributes: ['user_id'],
          where: { phase: { [Op.notIn]: INACTIVE_PHASES } },
        },
      ],
    });
    const userIds = [...new Set(schedules.map((s) => (s as any).grow.user_id as string))];

    let sent = 0;
    for (const userId of userIds) {
      const n = await this.runDailyDigestForUser(userId, now);
      if (n) sent++;
    }
    return { users: userIds.length, sent };
  },
};

export default FeedingDigestService;
