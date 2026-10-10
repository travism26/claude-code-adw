import {
  FeedEvent,
  GrowFeedingSchedule,
  GrowFeedingWeek,
  GrowFeedingWeekNutrient,
  Grow,
  GrowLog,
  GrowLogEnvironment,
  Nutrient,
} from '../models';
import type { FeedEventStatus } from '../models/FeedEvent';

export interface MarkFeedEventInput {
  status?: FeedEventStatus;
  performed_at?: Date | string | null;
  measured_ec?: number | null;
  measured_ppm?: number | null;
  measured_ph?: number | null;
  runoff_ec?: number | null;
  runoff_ph?: number | null;
  notes?: string | null;
}

const eventInclude = [
  {
    model: GrowFeedingWeek,
    as: 'week',
    include: [
      {
        model: GrowFeedingWeekNutrient,
        as: 'weekNutrients',
        include: [{ model: Nutrient, as: 'nutrient' }],
      },
    ],
  },
];

/** Grow phases that are also valid GrowLog phases. */
function logPhase(phase: string | null | undefined) {
  return phase && ['germination', 'vegetative', 'flowering', 'harvest'].includes(phase)
    ? (phase as 'germination' | 'vegetative' | 'flowering' | 'harvest')
    : null;
}

export const FeedEventService = {
  /**
   * Ensure exactly one event exists per current schedule week, keyed by
   * (schedule, week_number). Creates `planned` events for new weeks, deletes
   * events for week numbers that no longer exist, and refreshes the convenience
   * grow_feeding_week_id link. Status of unchanged weeks is preserved (we never
   * touch their rows) — that is the reconciliation rule from the design.
   */
  async materializeForSchedule(schedule: GrowFeedingSchedule): Promise<void> {
    const weeks = (schedule.weeks ?? []) as GrowFeedingWeek[];
    const weekNumbers = weeks.map((w) => w.week_number);

    const existing = await FeedEvent.findAll({
      where: { grow_feeding_schedule_id: schedule.id },
    });
    const byWeek = new Map<number, FeedEvent>(existing.map((e) => [e.week_number, e]));

    // Drop events whose week no longer exists.
    const orphans = existing.filter((e) => !weekNumbers.includes(e.week_number));
    if (orphans.length) {
      await FeedEvent.destroy({ where: { id: orphans.map((o) => o.id) } });
    }

    for (const week of weeks) {
      const ev = byWeek.get(week.week_number);
      if (!ev) {
        await FeedEvent.create({
          grow_feeding_schedule_id: schedule.id,
          grow_feeding_week_id: week.id,
          week_number: week.week_number,
          status: 'planned',
        });
      } else if (ev.grow_feeding_week_id !== week.id) {
        // Week row was rebuilt by a schedule edit — re-point the recipe link,
        // keep the status.
        await ev.update({ grow_feeding_week_id: week.id });
      }
    }
  },

  /** Materialize then return the grow's events (with recipe), ordered by week. */
  async listForGrow(growId: string): Promise<FeedEvent[]> {
    const schedule = await GrowFeedingSchedule.findOne({
      where: { grow_id: growId },
      include: [{ model: GrowFeedingWeek, as: 'weeks' }],
    });
    if (!schedule) return [];
    await this.materializeForSchedule(schedule);
    return FeedEvent.findAll({
      where: { grow_feeding_schedule_id: schedule.id },
      include: eventInclude,
      order: [['week_number', 'ASC']],
    });
  },

  /**
   * Mark a week's event done / skipped / planned, with optional back-dated
   * performed_at and measured readings. A `done` event is reconciled with the
   * grow timeline (one GrowLog entry, created once and updated thereafter);
   * leaving `done` removes that timeline entry so a feeding is never
   * double-logged. Returns null if the grow has no schedule or no such week.
   */
  async markEvent(
    growId: string,
    weekNumber: number,
    input: MarkFeedEventInput
  ): Promise<FeedEvent | null> {
    const schedule = await GrowFeedingSchedule.findOne({
      where: { grow_id: growId },
      include: [{ model: GrowFeedingWeek, as: 'weeks' }],
    });
    if (!schedule) return null;

    const week = (schedule.weeks ?? []).find((w) => w.week_number === weekNumber);
    if (!week) return null;

    const grow = await Grow.findByPk(growId);

    const [event] = await FeedEvent.findOrCreate({
      where: { grow_feeding_schedule_id: schedule.id, week_number: weekNumber },
      defaults: {
        grow_feeding_schedule_id: schedule.id,
        grow_feeding_week_id: week.id,
        week_number: weekNumber,
        status: 'planned',
      },
    });

    const status: FeedEventStatus = input.status ?? event.status;
    const performedAt =
      status === 'done'
        ? input.performed_at ?? event.performed_at ?? new Date()
        : input.performed_at !== undefined
          ? input.performed_at
          : event.performed_at;

    const patch: any = {
      status,
      performed_at: performedAt,
      grow_feeding_week_id: week.id,
    };
    for (const k of ['measured_ec', 'measured_ppm', 'measured_ph', 'runoff_ec', 'runoff_ph', 'notes'] as const) {
      if (input[k] !== undefined) patch[k] = input[k];
    }

    // ---- Timeline reconciliation (3.3) -------------------------------------
    if (status === 'done') {
      const ec = patch.measured_ec ?? event.measured_ec ?? null;
      const ppm = patch.measured_ppm ?? event.measured_ppm ?? null;
      const ph = patch.measured_ph ?? event.measured_ph ?? null;
      const label = week.is_flush
        ? `Fed (flush) — week ${weekNumber}`
        : week.is_water_only
          ? `Plain water — week ${weekNumber}`
          : `Fed — feeding week ${weekNumber}`;
      const note = input.notes ?? event.notes ?? null;
      const logNotes = note ? `${label}. ${note}` : label;

      if (event.grow_log_id) {
        // Update the existing timeline entry in place — no double-logging.
        const log = await GrowLog.findByPk(event.grow_log_id);
        if (log) {
          await log.update({ logged_at: performedAt as Date, notes: logNotes, phase: logPhase(grow?.phase) });
          if (ec != null || ph != null || ppm != null) {
            const env = await GrowLogEnvironment.findOne({ where: { grow_log_id: log.id } });
            if (env) await env.update({ ec, ph, ppm });
            else await GrowLogEnvironment.create({ grow_log_id: log.id, ec, ph, ppm });
          }
        } else {
          patch.grow_log_id = null;
        }
      }
      if (!event.grow_log_id || patch.grow_log_id === null) {
        const log = await GrowLog.create({
          grow_id: growId,
          logged_at: performedAt as Date,
          phase: logPhase(grow?.phase),
          notes: logNotes,
        });
        if (ec != null || ph != null || ppm != null) {
          await GrowLogEnvironment.create({ grow_log_id: log.id, ec, ph, ppm });
        }
        patch.grow_log_id = log.id;
      }
    } else if (event.grow_log_id) {
      // No longer done — remove its timeline entry (env cascades).
      await GrowLog.destroy({ where: { id: event.grow_log_id } });
      patch.grow_log_id = null;
    }

    await event.update(patch);

    return FeedEvent.findByPk(event.id, { include: eventInclude });
  },
};

export default FeedEventService;
