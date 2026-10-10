export interface User {
  id: string;
  email: string;
  timezone: string;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Plant {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor';
  water_interval_days: number;
  fert_interval_days?: number;
  species?: string;
  photo_url?: string;
  user_id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlantRequest {
  name: string;
  type: 'indoor' | 'outdoor';
  water_interval_days: number;
  fert_interval_days?: number;
  species?: string;
  photo_url?: string;
}

export interface UpdatePlantRequest {
  name?: string;
  type?: 'indoor' | 'outdoor';
  water_interval_days?: number;
  fert_interval_days?: number;
  species?: string;
  photo_url?: string;
}

export interface JournalEntry {
  id: string;
  plant_id: string;
  note?: string;
  photo_url?: string;
  entry_ts: string;
  createdAt: string;
  updatedAt: string;
  plant?: Plant;
}

export interface CreateJournalEntryRequest {
  plant_id: string;
  note?: string;
  photo_url?: string;
}

export interface UpdateJournalEntryRequest {
  note?: string;
  photo_url?: string;
}

export interface ApiError {
  error?: string;
  errors?: Array<{
    type: string;
    value: string;
    msg: string;
    path: string;
    location: string;
  }>;
}

export interface DashboardTask {
  id: string;
  plantId: string;
  plantName: string;
  taskType: 'water' | 'fertilize';
  dueDate: string;
  overdue: boolean;
}

// Plant Profile Types
export interface PlantProfile {
  id: string;
  name: string;
  species?: string | null;
  common_name?: string | null;
  type: 'vegetable' | 'herb' | 'flower' | 'houseplant' | 'fruit' | 'tree' | 'succulent' | 'vine';
  difficulty: 'easy' | 'moderate' | 'challenging';
  indoor_outdoor: 'indoor' | 'outdoor' | 'both';
  zone_min?: number | null;
  zone_max?: number | null;
  default_water_interval_days: number;
  default_fert_interval_days?: number | null;
  sunlight_requirements?: 'full_sun' | 'partial_sun' | 'partial_shade' | 'full_shade' | null;
  soil_type?: string | null;
  spacing_inches?: number | null;
  plant_family?: string | null;
  description?: string | null;
  icon_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlantProfileFilters {
  type?: 'vegetable' | 'herb' | 'flower' | 'houseplant' | 'fruit' | 'tree' | 'succulent' | 'vine';
  difficulty?: 'easy' | 'moderate' | 'challenging';
  indoor_outdoor?: 'indoor' | 'outdoor' | 'both';
  zone?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PlantProfilesResponse {
  plantProfiles: PlantProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface PlantProfileTip {
  id: string;
  plant_profile_id: string;
  zone: number;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  tip: string;
  createdAt: string;
  updatedAt: string;
}

// Zone Types
export interface ZoneDetectionResult {
  postalCode: string;
  zone: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface UserZone {
  zone: number;
  postalCode?: string;
  isOverride: boolean;
  updatedAt: string;
}

// Care History Types
export type CareActionType = 'watered' | 'fertilized' | 'pruned' | 'repotted' | 'other';

export interface CareHistoryEntry {
  id: string;
  plant_id: string;
  action_type: CareActionType;
  notes?: string;
  action_date: string;
  createdAt: string;
  updatedAt: string;
  plant?: Plant;
}

export interface CreateCareHistoryRequest {
  plant_id: string;
  action_type: CareActionType;
  notes?: string;
  action_date?: string;
}

export interface CareHistoryFilters {
  actionType?: CareActionType;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface CareHistoryResponse {
  careHistory: CareHistoryEntry[];
  total: number;
}

// Seasonal Tips Types
export interface SeasonalTip {
  id: string;
  zone: number;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  category: 'general' | 'planting' | 'maintenance' | 'harvesting';
  tip: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonalTipsResponse {
  tips: SeasonalTip[];
  zone: number;
  season: string;
}

// Re-export garden types
export * from './garden';

// Re-export suggestion types
export type { SuggestionPriority } from './suggestion';
export * from './suggestion';

// Re-export analysis usage types
export * from './analysisUsage';

// Re-export layout types
export * from './layout';

// Re-export grow types
export * from './grow';

// Re-export nutrient types
export * from './nutrient';

// Re-export grow log types
export * from './growLog';

// Re-export nutrient recommendation types
export * from './nutrientRecommendation';

// Re-export grow analysis types
export * from './growAnalysis';

// Re-export schedule types
export * from './schedule';

// Re-export environment overview types
export * from './environmentOverview';
