/**
 * Seed read-only SYSTEM feeding-schedule templates (sample brand-style feed
 * charts) that any user can clone-and-tweak. Idempotent: a system template with
 * the same name is left untouched.
 *
 * Run: cd backend && npx ts-node src/scripts/seedFeedingTemplates.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { getSequelize } from '../config/sequelize';
import {
  initializeModels,
  Nutrient,
  FeedingScheduleTemplate,
  FeedingScheduleTemplateWeek,
  FeedingScheduleTemplateWeekNutrient,
} from '../models';
import { Op } from 'sequelize';

interface SeedWeekNutrient {
  nutrientId: string;
  dosage: number;
}
interface SeedWeek {
  week_number: number;
  notes?: string;
  ec_min?: number;
  ec_max?: number;
  ppm_min?: number;
  ppm_max?: number;
  ph_min?: number;
  ph_max?: number;
  is_flush?: boolean;
  is_water_only?: boolean;
  nutrients: SeedWeekNutrient[];
}
interface SeedTemplate {
  name: string;
  description: string;
  ppm_scale: number;
  display_unit: string;
  week_counting_mode: 'continuous' | 'flip-reset';
  flower_start_week: number | null;
  weeks: SeedWeek[];
}

/** Pick a system nutrient id by type (falls back to any system nutrient). */
async function pickNutrient(type: string): Promise<string | null> {
  const byType = await Nutrient.findOne({ where: { user_id: { [Op.is]: null } as any, type } });
  if (byType) return byType.id;
  const any = await Nutrient.findOne({ where: { user_id: { [Op.is]: null } as any } });
  return any ? any.id : null;
}

async function buildTemplates(): Promise<SeedTemplate[]> {
  const base = await pickNutrient('base');
  const bloom = (await pickNutrient('supplement')) ?? base;
  if (!base) {
    throw new Error('No system nutrients found — run seedNutrients first.');
  }

  // A generic soil chart: 1 seedling, 2 veg, 3 flower (ramping), 1 flush.
  const phTarget = { ph_min: 6.0, ph_max: 6.5 };
  const week = (n: number, opts: Partial<SeedWeek>, nuts: SeedWeekNutrient[]): SeedWeek => ({
    week_number: n,
    ...phTarget,
    ...opts,
    nutrients: nuts,
  });

  const soilChart = (name: string, desc: string): SeedTemplate => ({
    name,
    description: desc,
    ppm_scale: 500,
    display_unit: 'ml/gal',
    week_counting_mode: 'flip-reset',
    flower_start_week: 4,
    weeks: [
      week(1, { notes: 'Seedling — plain water / very light feed', ec_min: 0.2, ec_max: 0.6, ppm_min: 100, ppm_max: 300, is_water_only: true }, []),
      week(2, { notes: 'Early veg', ec_min: 0.8, ec_max: 1.2, ppm_min: 400, ppm_max: 600 }, [{ nutrientId: base!, dosage: 2 }]),
      week(3, { notes: 'Late veg', ec_min: 1.2, ec_max: 1.6, ppm_min: 600, ppm_max: 800 }, [{ nutrientId: base!, dosage: 3 }]),
      week(4, { notes: 'Flower wk1 (transition)', ec_min: 1.4, ec_max: 1.8, ppm_min: 700, ppm_max: 900 }, [{ nutrientId: base!, dosage: 3 }]),
      week(5, { notes: 'Flower wk2 — bloom booster', ec_min: 1.6, ec_max: 2.0, ppm_min: 800, ppm_max: 1000 }, [{ nutrientId: base!, dosage: 3 }, { nutrientId: bloom!, dosage: 1 }]),
      week(6, { notes: 'Flower peak', ec_min: 1.8, ec_max: 2.2, ppm_min: 900, ppm_max: 1100 }, [{ nutrientId: base!, dosage: 4 }, { nutrientId: bloom!, dosage: 2 }]),
      week(7, { notes: 'Flush — plain water only', ec_min: 0, ec_max: 0.4, ppm_min: 0, ppm_max: 200, is_flush: true, is_water_only: true }, []),
    ],
  });

  return [
    soilChart('Generic Soil Feed (sample)', 'A starter week-by-week soil feeding chart you can clone and tune to your nutrient line.'),
    soilChart('Coco/Hydro Feed (sample)', 'A starter feeding chart for coco/hydro — feed every watering; clone and adjust EC/PPM to your line.'),
  ];
}

async function createSystemTemplate(tpl: SeedTemplate): Promise<'created' | 'skipped'> {
  const existing = await FeedingScheduleTemplate.findOne({
    where: { name: tpl.name, is_system: true },
  });
  if (existing) return 'skipped';

  const template = await FeedingScheduleTemplate.create({
    user_id: null,
    is_system: true,
    name: tpl.name,
    description: tpl.description,
    ppm_scale: tpl.ppm_scale,
    display_unit: tpl.display_unit,
    week_counting_mode: tpl.week_counting_mode,
    flower_start_week: tpl.flower_start_week,
  } as any);

  for (const w of tpl.weeks) {
    const week = await FeedingScheduleTemplateWeek.create({
      template_id: template.id,
      week_number: w.week_number,
      notes: w.notes ?? null,
      ec_min: w.ec_min ?? null,
      ec_max: w.ec_max ?? null,
      ppm_min: w.ppm_min ?? null,
      ppm_max: w.ppm_max ?? null,
      ph_min: w.ph_min ?? null,
      ph_max: w.ph_max ?? null,
      is_flush: w.is_flush ?? false,
      is_water_only: w.is_water_only ?? false,
    } as any);
    for (const n of w.nutrients) {
      await FeedingScheduleTemplateWeekNutrient.create({
        template_week_id: week.id,
        nutrient_id: n.nutrientId,
        dosage_ml_per_gallon: n.dosage,
        notes: null,
      } as any);
    }
  }
  return 'created';
}

async function seedFeedingTemplates() {
  try {
    const sequelize = await getSequelize();
    await initializeModels(sequelize);

    const templates = await buildTemplates();
    let created = 0;
    let skipped = 0;
    for (const tpl of templates) {
      const result = await createSystemTemplate(tpl);
      result === 'created' ? created++ : skipped++;
      console.log(`  ${result}: ${tpl.name}`);
    }
    console.log(`Feeding templates seed complete — created ${created}, skipped ${skipped}.`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Feeding templates seed failed:', error);
    process.exit(1);
  }
}

seedFeedingTemplates();
