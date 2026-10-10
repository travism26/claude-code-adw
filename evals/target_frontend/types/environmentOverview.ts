/**
 * Environment Overview Type Definitions
 * Used for the Environment Dashboard and capacity monitoring features
 */

export type CapacityStatus = 'normal' | 'warning' | 'over';
export type EnvironmentFilter = 'all' | 'active' | 'warning' | 'over';

export interface ActiveGrow {
  id: string;
  name: string;
  plantCount: number;
  phase: string;
}

export interface EnvironmentWithCapacity {
  id: string;
  name: string;
  type: string;
  displayColor: string | null;
  maxPlants: number | null;
  currentPlants: number;
  utilizationPercent: number | null;
  capacityWarningThreshold: number;
  capacityStatus: CapacityStatus;
  isActive: boolean;
  activeGrows: ActiveGrow[];
  dimensions: {
    widthInches: number | null;
    depthInches: number | null;
    heightInches: number | null;
  };
  lightInfo: {
    type: string | null;
    wattage: number | null;
  };
}

export interface CapacitySummary {
  totalEnvironments: number;
  activeEnvironments: number;
  totalCapacity: number;
  totalPlants: number;
  utilizationPercent: number | null;
  warningCount: number;
  overCapacityCount: number;
}

export interface EnvironmentOverview {
  environments: EnvironmentWithCapacity[];
  summary: CapacitySummary;
}
