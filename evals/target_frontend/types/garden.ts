// Garden Types
export interface Garden {
  id: string;
  user_id: string;
  name: string;
  zone: string | null;
  width: number;
  height: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  plots?: Plot[];
}

export interface CreateGardenRequest {
  name: string;
  width: number;
  height: number;
  zone?: string;
  notes?: string;
}

export interface UpdateGardenRequest {
  name?: string;
  width?: number;
  height?: number;
  zone?: string;
  notes?: string;
}

// Compass Direction Type
export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// Plot Types
export interface Plot {
  id: string;
  garden_id: string;
  plant_profile_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  notes: string | null;
  compass_direction: CompassDirection | null;
  status?: 'planned' | 'planted' | 'harvested' | 'archived';
  created_at: string;
  updated_at: string;
  plantProfile?: PlantProfileForPlot;
}

// Simplified PlantProfile for plot display
export interface PlantProfileForPlot {
  id: string;
  name: string;
  common_name: string | null;
  type: 'vegetable' | 'herb' | 'flower' | 'houseplant' | 'fruit' | 'tree' | 'succulent' | 'vine';
  spacing_inches: number | null;
  icon_url?: string | null;
}

export interface CreatePlotRequest {
  plant_profile_id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes?: string;
  compass_direction?: CompassDirection | null;
  status?: 'planned' | 'planted' | 'harvested' | 'archived';
}

export interface UpdatePlotRequest {
  plant_profile_id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  notes?: string;
  compass_direction?: CompassDirection | null;
  status?: 'planned' | 'planted' | 'harvested' | 'archived';
}

// Companion Planting Types
export interface CompanionPlant {
  id: string;
  name: string;
  common_name: string | null;
  type: 'vegetable' | 'herb' | 'flower' | 'houseplant' | 'fruit' | 'tree' | 'succulent' | 'vine';
}

export interface CompanionRelationship {
  id: string;
  plant_profile_id: string;
  companion_plant_id: string;
  relationship: 'beneficial' | 'harmful' | 'neutral';
  notes: string | null;
  companion_plant?: CompanionPlant;
}

export interface CompanionData {
  plantProfileId: string;
  beneficial: CompanionRelationship[];
  harmful: CompanionRelationship[];
  neutral: CompanionRelationship[];
}

export interface CompanionWarning {
  plotId: string;
  companionPlotId: string;
  relationship: 'beneficial' | 'harmful';
  plantName: string;
  companionPlantName: string;
  notes: string | null;
}

// Spacing Validation Types
export interface GridPosition {
  x: number;
  y: number;
}

export interface PlotDimensions {
  width: number;
  height: number;
}

export interface SpacingWarning {
  plotId: string;
  nearbyPlotId: string;
  plantName: string;
  nearbyPlantName: string;
  currentDistance: number;
  requiredDistance: number;
  message: string;
}

// Yield Estimation Types
export interface YieldEstimate {
  plotId: string;
  plantName: string;
  plantType: string;
  estimatedYield: number;
  unit: 'lbs' | 'kg' | 'count' | 'bunches';
  plantsPerPlot: number;
  yieldPerPlant: number;
  daysToHarvest: number | null;
  harvestDate: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface YieldSummary {
  totalYields: YieldByType[];
  totalPlots: number;
  earliestHarvest: string | null;
  latestHarvest: string | null;
}

export interface YieldByType {
  plantType: string;
  totalYield: number;
  unit: 'lbs' | 'kg' | 'count' | 'bunches';
  plotCount: number;
}

// Garden Canvas Types
export interface CanvasSettings {
  gridSize: number; // Size of grid squares in feet
  showGrid: boolean;
  snapToGrid: boolean;
  zoom: number;
  pan: GridPosition;
}

export interface DragState {
  isDragging: boolean;
  dragType: 'new-plot' | 'move-plot' | 'resize-plot' | null;
  plantProfileId: string | null;
  plotId: string | null;
  startPosition: GridPosition | null;
}
