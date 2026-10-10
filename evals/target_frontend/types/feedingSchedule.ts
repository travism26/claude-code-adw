// Weekly nutrient feeding-schedule types (templates + per-grow schedule)
import type { Nutrient } from "./nutrient";

export interface WeekNutrient {
  id: string;
  nutrient_id: string;
  dosage_ml_per_gallon: number | null;
  notes: string | null;
  nutrient?: Nutrient;
}

export interface WeekTargets {
  ec_min: number | null;
  ec_max: number | null;
  ppm_min: number | null;
  ppm_max: number | null;
  ph_min: number | null;
  ph_max: number | null;
  is_flush: boolean;
  is_water_only: boolean;
}

export interface TemplateWeek extends WeekTargets {
  id: string;
  week_number: number;
  notes: string | null;
  weekNutrients: WeekNutrient[];
}

export interface FeedingScheduleTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  ppm_scale: number;
  display_unit: string;
  week_counting_mode: WeekCountingMode;
  flower_start_week: number | null;
  weeks: TemplateWeek[];
  created_at: string;
  updated_at: string;
}

export type WeekCountingMode = "continuous" | "flip-reset" | "stage-based";

export interface GrowFeedingWeek extends WeekTargets {
  id: string;
  week_number: number;
  notes: string | null;
  weekNutrients: WeekNutrient[];
  // Derived server-side from the grow's start / flip date:
  date_start: string | null;
  date_end: string | null;
  is_current: boolean;
  segment?: "veg" | "flower" | null;
  pending_flip?: boolean;
}

export interface GrowFeedingSchedule {
  id: string;
  grow_id: string;
  source_template_id: string | null;
  strength_pct: number;
  reservoir_gallons: number | null;
  week_counting_mode: WeekCountingMode;
  flower_start_week: number | null;
  ppm_scale: number;
  display_unit: string;
  weeks: GrowFeedingWeek[];
}

export interface ScheduleSettingsInput {
  strength_pct?: number;
  reservoir_gallons?: number | null;
  week_counting_mode?: WeekCountingMode;
  flower_start_week?: number | null;
  ppm_scale?: number;
  display_unit?: string;
}

// ---- Request inputs ----
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
export interface TemplateInput {
  name: string;
  description?: string | null;
  ppm_scale?: number;
  display_unit?: string;
  weeks?: WeekInput[];
}

// ---- Response envelopes ----
export interface TemplatesResponse {
  templates: FeedingScheduleTemplate[];
}
export interface TemplateResponse {
  template: FeedingScheduleTemplate;
}
export interface GrowFeedingScheduleResponse {
  feedingSchedule: GrowFeedingSchedule | null;
}
