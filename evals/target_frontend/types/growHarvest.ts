// Grow harvest record types
export interface GrowHarvest {
  id: string;
  grow_id: string;
  harvested_at: string;
  wet_weight_grams: number | null;
  dry_weight_grams: number | null;
  trim_weight_grams: number | null;
  thc_percent: number | null;
  cbd_percent: number | null;
  terpene_profile: Record<string, number> | null;
  cure_days: number | null;
  quality_rating: number | null;
  smoke_report: string | null;
  created_at: string;
  updated_at: string;
}

export interface HarvestInput {
  harvested_at: string;
  wet_weight_grams?: number | null;
  dry_weight_grams?: number | null;
  trim_weight_grams?: number | null;
  thc_percent?: number | null;
  cbd_percent?: number | null;
  cure_days?: number | null;
  quality_rating?: number | null;
  smoke_report?: string | null;
}

export interface HarvestResponse {
  harvest: GrowHarvest | null;
}
