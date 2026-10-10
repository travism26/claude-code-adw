import { GrowEnvironment } from '../models';
import { GrowEnvironmentService } from './GrowEnvironmentService';

export type CapacityStatus = 'normal' | 'warning' | 'over';

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

/**
 * EnvironmentOverviewService - Provides aggregated environment capacity data
 */
export const EnvironmentOverviewService = {
  /**
   * Calculate capacity status based on current plants, max plants, and warning threshold
   */
  calculateCapacityStatus(
    currentPlants: number,
    maxPlants: number | null,
    warningThreshold: number
  ): CapacityStatus {
    if (maxPlants === null || maxPlants === 0) {
      return 'normal';
    }

    const utilizationPercent = (currentPlants / maxPlants) * 100;

    if (utilizationPercent > 100) {
      return 'over';
    }

    if (utilizationPercent >= warningThreshold) {
      return 'warning';
    }

    return 'normal';
  },

  /**
   * Calculate utilization percentage
   */
  calculateUtilizationPercent(
    currentPlants: number,
    maxPlants: number | null
  ): number | null {
    if (maxPlants === null || maxPlants === 0) {
      return null;
    }

    return Math.round((currentPlants / maxPlants) * 100);
  },

  /**
   * Transform GrowEnvironment and associated Grows into EnvironmentWithCapacity
   */
  transformEnvironment(environment: GrowEnvironment): EnvironmentWithCapacity {
    // Calculate current plants from all grows in environment
    const grows = environment.grows || [];
    const activeGrows = grows.filter(
      (grow: any) => grow.phase !== 'archived' && grow.phase !== 'harvest'
    );

    const currentPlants = activeGrows.reduce(
      (sum: number, grow: any) => sum + (grow.plant_count || 0),
      0
    );

    const warningThreshold = environment.capacity_warning_threshold || 80;
    const utilizationPercent = this.calculateUtilizationPercent(
      currentPlants,
      environment.max_plants
    );
    const capacityStatus = this.calculateCapacityStatus(
      currentPlants,
      environment.max_plants,
      warningThreshold
    );

    return {
      id: environment.id,
      name: environment.name,
      type: environment.type,
      displayColor: environment.display_color,
      maxPlants: environment.max_plants,
      currentPlants,
      utilizationPercent,
      capacityWarningThreshold: warningThreshold,
      capacityStatus,
      isActive: environment.is_active,
      activeGrows: activeGrows.map((grow: any) => ({
        id: grow.id,
        name: grow.strain_name,
        plantCount: grow.plant_count || 0,
        phase: grow.phase,
      })),
      dimensions: {
        widthInches: environment.width_inches,
        depthInches: environment.depth_inches,
        heightInches: environment.height_inches,
      },
      lightInfo: {
        type: environment.light_type,
        wattage: environment.light_wattage,
      },
    };
  },

  /**
   * Calculate summary statistics from environments
   */
  calculateSummary(environments: EnvironmentWithCapacity[]): CapacitySummary {
    const totalEnvironments = environments.length;
    const activeEnvironments = environments.filter((env) => env.isActive).length;

    const totalCapacity = environments.reduce(
      (sum, env) => sum + (env.maxPlants || 0),
      0
    );

    const totalPlants = environments.reduce((sum, env) => sum + env.currentPlants, 0);

    const utilizationPercent =
      totalCapacity > 0 ? Math.round((totalPlants / totalCapacity) * 100) : null;

    const warningCount = environments.filter(
      (env) => env.capacityStatus === 'warning'
    ).length;

    const overCapacityCount = environments.filter(
      (env) => env.capacityStatus === 'over'
    ).length;

    return {
      totalEnvironments,
      activeEnvironments,
      totalCapacity,
      totalPlants,
      utilizationPercent,
      warningCount,
      overCapacityCount,
    };
  },

  /**
   * Get overview of all environments with capacity data
   */
  async getOverview(userId: string): Promise<EnvironmentOverview> {
    const { environments } = await GrowEnvironmentService.findAllByUser(userId, {
      limit: 1000, // Get all environments
    });

    const environmentsWithCapacity = environments.map((env) =>
      this.transformEnvironment(env)
    );

    const summary = this.calculateSummary(environmentsWithCapacity);

    return {
      environments: environmentsWithCapacity,
      summary,
    };
  },

  /**
   * Get capacity data for a single environment
   */
  async getEnvironmentCapacity(
    environmentId: string,
    userId: string
  ): Promise<EnvironmentWithCapacity | null> {
    const environment = await GrowEnvironmentService.findByIdAndUser(
      environmentId,
      userId
    );

    if (!environment) {
      return null;
    }

    return this.transformEnvironment(environment);
  },

  /**
   * Get just the summary statistics (lightweight endpoint)
   */
  async getCapacitySummary(userId: string): Promise<CapacitySummary> {
    const overview = await this.getOverview(userId);
    return overview.summary;
  },
};
