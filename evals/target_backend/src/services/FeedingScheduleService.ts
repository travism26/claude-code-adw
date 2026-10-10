import {
  FeedingScheduleTemplate,
  FeedingScheduleTemplateWeek,
  FeedingScheduleTemplateWeekNutrient,
  GrowFeedingSchedule,
  GrowFeedingWeek,
  GrowFeedingWeekNutrient,
  Nutrient,
} from '../models';
import { Op } from 'sequelize';

/** Thrown when applying a template to a grow that already has a schedule (no overwrite flag). */
export class FeedingScheduleConflictError extends Error {
  code = 'SCHEDULE_EXISTS';
  constructor(message = 'Grow already has a feeding schedule') {
    super(message);
    this.name = 'FeedingScheduleConflictError';
  }
}

export interface WeekNutrientInput {
  nutrient_id: string;
  dosage_ml_per_gallon?: number | null;
  notes?: string | null;
}
export interface WeekInput {
  week_number: number;
  notes?: string | null;
  ec_min?: number | null;
  ec_max?: number | null;
  ppm_min?: number | null;
  ppm_max?: number | null;
  ph_min?: number | null;
  ph_max?: number | null;
  is_flush?: boolean;
  is_water_only?: boolean;
  nutrients?: WeekNutrientInput[];
}

/** Per-week target/flag columns extracted from a WeekInput (null/false when omitted). */
function weekTargets(w: WeekInput) {
  return {
    ec_min: w.ec_min ?? null,
    ec_max: w.ec_max ?? null,
    ppm_min: w.ppm_min ?? null,
    ppm_max: w.ppm_max ?? null,
    ph_min: w.ph_min ?? null,
    ph_max: w.ph_max ?? null,
    is_flush: w.is_flush ?? false,
    is_water_only: w.is_water_only ?? false,
  };
}
export interface TemplateInput {
  name: string;
  description?: string | null;
  week_counting_mode?: 'continuous' | 'flip-reset' | 'stage-based';
  flower_start_week?: number | null;
  ppm_scale?: number;
  display_unit?: string;
  weeks?: WeekInput[];
}

const templateInclude = [
  {
    model: FeedingScheduleTemplateWeek,
    as: 'weeks',
    include: [
      {
        model: FeedingScheduleTemplateWeekNutrient,
        as: 'weekNutrients',
        include: [{ model: Nutrient, as: 'nutrient' }],
      },
    ],
  },
];

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

const weekOrder: any = [
  [{ model: FeedingScheduleTemplateWeek, as: 'weeks' }, 'week_number', 'ASC'],
];
const scheduleWeekOrder: any = [
  [{ model: GrowFeedingWeek, as: 'weeks' }, 'week_number', 'ASC'],
];

export const FeedingScheduleService = {
  // ---- Templates ------------------------------------------------------------

  async listTemplates(userId: string): Promise<FeedingScheduleTemplate[]> {
    return FeedingScheduleTemplate.findAll({
      where: { [Op.or]: [{ user_id: userId }, { is_system: true }] },
      include: templateInclude,
      order: [['is_system', 'DESC'], ['created_at', 'DESC'], ...weekOrder],
    });
  },

  async getTemplate(userId: string, id: string): Promise<FeedingScheduleTemplate | null> {
    return FeedingScheduleTemplate.findOne({
      where: { id, [Op.or]: [{ user_id: userId }, { is_system: true }] },
      include: templateInclude,
      order: weekOrder,
    });
  },

  async createTemplate(userId: string, data: TemplateInput): Promise<FeedingScheduleTemplate> {
    const sequelize = FeedingScheduleTemplate.sequelize!;
    const created = await sequelize.transaction(async (t) => {
      const template = await FeedingScheduleTemplate.create(
        {
          user_id: userId,
          name: data.name,
          description: data.description ?? null,
          ...(data.week_counting_mode ? { week_counting_mode: data.week_counting_mode } : {}),
          ...(data.flower_start_week !== undefined ? { flower_start_week: data.flower_start_week } : {}),
          ...(data.ppm_scale != null ? { ppm_scale: data.ppm_scale } : {}),
          ...(data.display_unit ? { display_unit: data.display_unit } : {}),
        },
        { transaction: t }
      );
      await this._createTemplateWeeks(template.id, data.weeks ?? [], t);
      return template;
    });
    return (await this.getTemplate(userId, created.id))!;
  },

  async updateTemplate(
    userId: string,
    id: string,
    data: TemplateInput
  ): Promise<FeedingScheduleTemplate | null> {
    const template = await FeedingScheduleTemplate.findOne({
      where: { id, user_id: userId, is_system: false },
    });
    if (!template) return null;
    const sequelize = FeedingScheduleTemplate.sequelize!;
    await sequelize.transaction(async (t) => {
      await template.update(
        {
          name: data.name,
          description: data.description ?? null,
          ...(data.week_counting_mode ? { week_counting_mode: data.week_counting_mode } : {}),
          ...(data.flower_start_week !== undefined ? { flower_start_week: data.flower_start_week } : {}),
          ...(data.ppm_scale != null ? { ppm_scale: data.ppm_scale } : {}),
          ...(data.display_unit ? { display_unit: data.display_unit } : {}),
        },
        { transaction: t }
      );
      if (data.weeks) {
        // Replace all weeks (cascade removes their nutrients)
        await FeedingScheduleTemplateWeek.destroy({ where: { template_id: id }, transaction: t });
        await this._createTemplateWeeks(id, data.weeks, t);
      }
    });
    return this.getTemplate(userId, id);
  },

  async deleteTemplate(userId: string, id: string): Promise<boolean> {
    const count = await FeedingScheduleTemplate.destroy({
      where: { id, user_id: userId, is_system: false },
    });
    return count > 0;
  },

  /** Clone any visible template (system or owned) into a new user-owned copy. */
  async cloneTemplate(userId: string, sourceId: string): Promise<FeedingScheduleTemplate | null> {
    const source = await this.getTemplate(userId, sourceId);
    if (!source) return null;
    return this.createTemplate(userId, {
      name: `${source.name} (copy)`,
      description: source.description,
      week_counting_mode: (source as any).week_counting_mode,
      flower_start_week: (source as any).flower_start_week,
      ppm_scale: (source as any).ppm_scale,
      display_unit: (source as any).display_unit,
      weeks: (source.weeks ?? []).map((w) => ({
        week_number: w.week_number,
        notes: w.notes,
        ec_min: w.ec_min,
        ec_max: w.ec_max,
        ppm_min: w.ppm_min,
        ppm_max: w.ppm_max,
        ph_min: w.ph_min,
        ph_max: w.ph_max,
        is_flush: (w as any).is_flush,
        is_water_only: (w as any).is_water_only,
        nutrients: (w.weekNutrients ?? []).map((wn) => ({
          nutrient_id: wn.nutrient_id,
          dosage_ml_per_gallon: wn.dosage_ml_per_gallon,
          notes: wn.notes,
        })),
      })),
    });
  },

  async _createTemplateWeeks(templateId: string, weeks: WeekInput[], t: any): Promise<void> {
    for (const week of weeks) {
      const createdWeek = await FeedingScheduleTemplateWeek.create(
        {
          template_id: templateId,
          week_number: week.week_number,
          notes: week.notes ?? null,
          ...weekTargets(week),
        },
        { transaction: t }
      );
      for (const n of week.nutrients ?? []) {
        await FeedingScheduleTemplateWeekNutrient.create(
          {
            template_week_id: createdWeek.id,
            nutrient_id: n.nutrient_id,
            dosage_ml_per_gallon: n.dosage_ml_per_gallon ?? null,
            notes: n.notes ?? null,
          },
          { transaction: t }
        );
      }
    }
  },

  // ---- Per-grow schedule ----------------------------------------------------

  async getGrowFeedingSchedule(growId: string): Promise<GrowFeedingSchedule | null> {
    return GrowFeedingSchedule.findOne({
      where: { grow_id: growId },
      include: scheduleInclude,
      order: scheduleWeekOrder,
    });
  },

  /** Snapshot-copy a template's weeks/nutrients onto a grow as an editable schedule. */
  async applyTemplateToGrow(
    growId: string,
    userId: string,
    templateId: string,
    overwrite = false
  ): Promise<GrowFeedingSchedule | null> {
    const template = await this.getTemplate(userId, templateId);
    if (!template) return null;

    const existing = await GrowFeedingSchedule.findOne({ where: { grow_id: growId } });
    if (existing && !overwrite) throw new FeedingScheduleConflictError();

    const weeks: WeekInput[] = (template.weeks ?? []).map((w) => ({
      week_number: w.week_number,
      notes: w.notes,
      ec_min: w.ec_min,
      ec_max: w.ec_max,
      ppm_min: w.ppm_min,
      ppm_max: w.ppm_max,
      ph_min: w.ph_min,
      ph_max: w.ph_max,
      is_flush: (w as any).is_flush,
      is_water_only: (w as any).is_water_only,
      nutrients: (w.weekNutrients ?? []).map((wn) => ({
        nutrient_id: wn.nutrient_id,
        dosage_ml_per_gallon: wn.dosage_ml_per_gallon,
        notes: wn.notes,
      })),
    }));

    await this._writeGrowSchedule(growId, weeks, templateId, {
      week_counting_mode: (template as any).week_counting_mode,
      flower_start_week: (template as any).flower_start_week,
      ppm_scale: (template as any).ppm_scale,
      display_unit: (template as any).display_unit,
    });
    return this.getGrowFeedingSchedule(growId);
  },

  /** Replace a grow's schedule weeks directly (template-less editing). */
  async replaceGrowFeedingSchedule(
    growId: string,
    weeks: WeekInput[]
  ): Promise<GrowFeedingSchedule | null> {
    await this._writeGrowSchedule(growId, weeks, undefined);
    return this.getGrowFeedingSchedule(growId);
  },

  async _writeGrowSchedule(
    growId: string,
    weeks: WeekInput[],
    sourceTemplateId: string | undefined,
    applySettings?: {
      week_counting_mode?: string;
      flower_start_week?: number | null;
      ppm_scale?: number;
      display_unit?: string;
    }
  ): Promise<void> {
    const sequelize = GrowFeedingSchedule.sequelize!;
    await sequelize.transaction(async (t) => {
      // Preserve the schedule row (and its strength_pct / reservoir settings)
      // across edits — only its weeks are replaced.
      let schedule = await GrowFeedingSchedule.findOne({
        where: { grow_id: growId },
        transaction: t,
      });
      if (schedule) {
        await schedule.update(
          {
            source_template_id: sourceTemplateId ?? schedule.source_template_id,
            ...(applySettings ?? {}),
          },
          { transaction: t }
        );
        await GrowFeedingWeek.destroy({
          where: { grow_feeding_schedule_id: schedule.id },
          transaction: t,
        });
      } else {
        schedule = await GrowFeedingSchedule.create(
          {
            grow_id: growId,
            source_template_id: sourceTemplateId ?? null,
            ...(applySettings ?? {}),
          },
          { transaction: t }
        );
      }
      for (const week of weeks) {
        const createdWeek = await GrowFeedingWeek.create(
          {
            grow_feeding_schedule_id: schedule.id,
            week_number: week.week_number,
            notes: week.notes ?? null,
            ...weekTargets(week),
          },
          { transaction: t }
        );
        for (const n of week.nutrients ?? []) {
          await GrowFeedingWeekNutrient.create(
            {
              grow_feeding_week_id: createdWeek.id,
              nutrient_id: n.nutrient_id,
              dosage_ml_per_gallon: n.dosage_ml_per_gallon ?? null,
              notes: n.notes ?? null,
            },
            { transaction: t }
          );
        }
      }
    });
  },

  /** Update a grow schedule's strength multiplier and/or reservoir volume. */
  async updateGrowScheduleSettings(
    growId: string,
    settings: {
      strength_pct?: number;
      reservoir_gallons?: number | null;
      week_counting_mode?: 'continuous' | 'flip-reset' | 'stage-based';
      flower_start_week?: number | null;
      ppm_scale?: number;
      display_unit?: string;
    }
  ): Promise<GrowFeedingSchedule | null> {
    const schedule = await GrowFeedingSchedule.findOne({ where: { grow_id: growId } });
    if (!schedule) return null;
    const patch: any = {};
    if (settings.strength_pct != null) patch.strength_pct = settings.strength_pct;
    if (settings.reservoir_gallons !== undefined) patch.reservoir_gallons = settings.reservoir_gallons;
    if (settings.week_counting_mode != null) patch.week_counting_mode = settings.week_counting_mode;
    if (settings.flower_start_week !== undefined) patch.flower_start_week = settings.flower_start_week;
    if (settings.ppm_scale != null) patch.ppm_scale = settings.ppm_scale;
    if (settings.display_unit != null) patch.display_unit = settings.display_unit;
    await schedule.update(patch);
    return this.getGrowFeedingSchedule(growId);
  },

  // ---- Pure helper: map weeks to calendar dates -----------------------------

  /**
   * Given a grow start date and the schedule's weeks, return a plain-object copy
   * of each week annotated with date_start, date_end (ISO yyyy-mm-dd), and
   * is_current. Pure: no DB access, no mutation of inputs.
   */
  deriveWeekDates(
    startedAt: Date | string | null,
    weeks: Array<{ week_number: number; [k: string]: any }>,
    opts: {
      now?: Date;
      countingMode?: 'continuous' | 'flip-reset' | 'stage-based';
      flowerStartWeek?: number | null;
      flipDate?: Date | string | null;
    } = {}
  ): Array<any> {
    const now = opts.now ?? new Date();
    const mode = opts.countingMode ?? 'continuous';
    const flowerStart = opts.flowerStartWeek ?? null;
    const flip = opts.flipDate ? new Date(opts.flipDate) : null;
    const start = startedAt ? new Date(startedAt) : null;
    const dayMs = 24 * 60 * 60 * 1000;
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    // Compute a week's date range from an anchor + 0-based offset.
    const range = (anchor: Date, weekIndex0: number) => {
      const ws = new Date(anchor.getTime() + weekIndex0 * 7 * dayMs);
      const we = new Date(ws.getTime() + 6 * dayMs);
      const is_current =
        now.getTime() >= ws.getTime() && now.getTime() <= we.getTime() + dayMs - 1;
      return { date_start: iso(ws), date_end: iso(we), is_current };
    };

    const useFlip = mode === 'flip-reset' && flowerStart != null;

    // Nested association serialization (schedule.toJSON().weeks) skips the
    // GrowFeedingWeek custom toJSON, so DECIMAL targets arrive as strings.
    // Coerce them here — this is the single funnel every API response + the
    // digest pass week rows through.
    const toNum = (x: any) =>
      x == null ? null : typeof x === 'string' ? parseFloat(x) : x;
    weeks = weeks.map((w) => ({
      ...w,
      ec_min: toNum(w.ec_min),
      ec_max: toNum(w.ec_max),
      ph_min: toNum(w.ph_min),
      ph_max: toNum(w.ph_max),
    }));

    return weeks.map((w) => {
      const segment = useFlip
        ? w.week_number >= (flowerStart as number)
          ? 'flower'
          : 'veg'
        : null;

      // Flower weeks in flip-reset anchor to the confirmed flip date.
      if (useFlip && w.week_number >= (flowerStart as number)) {
        if (!flip) {
          // Not flipped yet — flower dates are pending the flip.
          return { ...w, date_start: null, date_end: null, is_current: false, segment, pending_flip: true };
        }
        const idx0 = w.week_number - (flowerStart as number); // flower week 1 -> 0
        return { ...w, ...range(flip, idx0), segment };
      }

      // Veg / continuous weeks anchor to the grow start.
      if (!start) {
        return { ...w, date_start: null, date_end: null, is_current: false, segment };
      }
      return { ...w, ...range(start, w.week_number - 1), segment };
    });
  },
};

export default FeedingScheduleService;
