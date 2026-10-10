// "Feeding due today" agenda types — aggregated across a user's active grows.
import type { FeedEventStatus } from "./feedEvent";

export interface DueFeedingItem {
  nutrient_id: string;
  name: string;
  base_ml_per_gallon: number | null;
  adjusted_ml_per_gallon: number | null;
  mix_ml: number | null;
}

export interface DueFeeding {
  grow_id: string;
  strain_name: string;
  week_number: number;
  segment: "veg" | "flower" | null;
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

export interface FeedingTodayResponse {
  due: DueFeeding[];
}
