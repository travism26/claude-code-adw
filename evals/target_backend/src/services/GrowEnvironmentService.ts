import { GrowEnvironment, Grow } from '../models';
import { Op } from 'sequelize';
import { EnvironmentOverviewService, CapacityStatus } from './EnvironmentOverviewService';

export interface GrowEnvironmentData {
  name: string;
  type: 'tent' | 'room' | 'closet' | 'outdoor' | 'greenhouse';
  width_inches?: number | null;
  depth_inches?: number | null;
  height_inches?: number | null;
  light_type?: 'led' | 'hps' | 'mh' | 'cfl' | 'sun' | 'other' | null;
  light_wattage?: number | null;
  ventilation_cfm?: number | null;
  has_carbon_filter?: boolean;
  has_humidifier?: boolean;
  has_dehumidifier?: boolean;
  has_ac?: boolean;
  has_heater?: boolean;
  max_plants?: number | null;
  notes?: string | null;
  is_active?: boolean;
  capacity_warning_threshold?: number | null;
  display_color?: string | null;
}

export interface GrowEnvironmentFilters {
  type?: string;
  is_active?: boolean;
  name?: string;
  limit?: number;
  offset?: number;
}

export interface CapacityCheckResult {
  environmentId: string;
  environmentName: string;
  maxPlants: number | null;
  currentPlants: number;
  requestedPlants: number;
  projectedPlants: number;
  projectedUtilization: number | null;
  capacityWarningThreshold: number;
  status: CapacityStatus;
  warnings: string[];
  allowed: true;
}

/**
 * GrowEnvironmentService - Encapsulates all GrowEnvironment model operations
 */
export const GrowEnvironmentService = {
  /**
   * Create a new grow environment
   */
  async create(userId: string, data: GrowEnvironmentData): Promise<GrowEnvironment> {
    return GrowEnvironment.create({
      ...data,
      user_id: userId,
    });
  },

  /**
   * Find all environments for a user with optional filters
   * Returns both environments array and total count for pagination
   */
  async findAllByUser(
    userId: string,
    filters?: GrowEnvironmentFilters
  ): Promise<{ environments: GrowEnvironment[]; total: number }> {
    const whereClause: any = { user_id: userId };

    if (filters?.type) {
      whereClause.type = filters.type;
    }

    if (filters?.is_active !== undefined) {
      whereClause.is_active = filters.is_active;
    }

    if (filters?.name) {
      whereClause.name = {
        [Op.iLike]: `%${filters.name}%`,
      };
    }

    const { count, rows } = await GrowEnvironment.findAndCountAll({
      where: whereClause,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Grow,
          as: 'grows',
          attributes: ['id', 'strain_name', 'phase', 'plant_count'],
        },
      ],
    });

    return { environments: rows, total: count };
  },

  /**
   * Find an environment by ID and user with associations
   */
  async findByIdAndUser(
    environmentId: string,
    userId: string
  ): Promise<GrowEnvironment | null> {
    return GrowEnvironment.findOne({
      where: {
        id: environmentId,
        user_id: userId,
      },
      include: [
        {
          model: Grow,
          as: 'grows',
          attributes: ['id', 'strain_name', 'phase', 'plant_count', 'started_at'],
        },
      ],
    });
  },

  /**
   * Find an environment by ID and user (simple, without includes)
   */
  async findByIdAndUserSimple(
    environmentId: string,
    userId: string
  ): Promise<GrowEnvironment | null> {
    return GrowEnvironment.findOne({
      where: {
        id: environmentId,
        user_id: userId,
      },
    });
  },

  /**
   * Update an environment
   */
  async update(
    environment: GrowEnvironment,
    data: Partial<GrowEnvironmentData>
  ): Promise<GrowEnvironment> {
    await environment.update(data);
    return environment;
  },

  /**
   * Delete an environment (sets grows' environment_id to null)
   */
  async delete(environment: GrowEnvironment): Promise<void> {
    await environment.destroy();
  },

  /**
   * Calculate recommended plant capacity based on dimensions
   * Returns recommended capacity for vegetative and flowering phases
   */
  calculateRecommendedCapacity(
    widthInches: number,
    depthInches: number
  ): { veg: number; flower: number } {
    // Calculate square footage
    const sqft = (widthInches * depthInches) / 144;

    // Industry standards:
    // Veg: 1 plant per 1-2 sq ft (we'll use 1.5 sq ft average)
    // Flower: 1 plant per 2-4 sq ft (we'll use 3 sq ft average)
    const vegCapacity = Math.floor(sqft / 1.5);
    const flowerCapacity = Math.floor(sqft / 3);

    return {
      veg: Math.max(1, vegCapacity), // At least 1 plant
      flower: Math.max(1, flowerCapacity), // At least 1 plant
    };
  },

  /**
   * Get all grows in a specific environment
   */
  async getGrowsInEnvironment(
    environmentId: string,
    userId: string
  ): Promise<Grow[]> {
    // First verify the environment belongs to the user
    const environment = await GrowEnvironment.findOne({
      where: {
        id: environmentId,
        user_id: userId,
      },
    });

    if (!environment) {
      throw new Error('Environment not found');
    }

    return Grow.findAll({
      where: {
        environment_id: environmentId,
        user_id: userId,
      },
      order: [['started_at', 'DESC']],
    });
  },

  /**
   * Check capacity for an environment with projected additional plants
   *
   * This method calculates what the capacity status would be if the user adds
   * a specified number of additional plants to an environment. It performs
   * ownership verification, calculates current plant count from active grows,
   * projects future capacity, and generates appropriate warning messages.
   *
   * IMPORTANT: This method is non-blocking - it always returns allowed: true
   * regardless of capacity status. Warnings are informational only.
   *
   * @param environmentId - UUID of the environment to check
   * @param additionalPlants - Number of plants the user wants to add (must be >= 0)
   * @param userId - UUID of the user (for ownership verification)
   * @returns CapacityCheckResult with projected capacity metrics and warnings
   * @throws Error if environment not found or user doesn't own environment
   */
  async checkCapacity(
    environmentId: string,
    additionalPlants: number,
    userId: string
  ): Promise<CapacityCheckResult> {
    // Fetch environment with grows for capacity calculation
    const environment = await this.findByIdAndUser(environmentId, userId);

    if (!environment) {
      throw new Error('Environment not found');
    }

    // Calculate current plants from active grows (not archived/harvested)
    const grows = environment.grows || [];
    const activeGrows = grows.filter(
      (grow: any) => grow.phase !== 'archived' && grow.phase !== 'harvest'
    );

    const currentPlants = activeGrows.reduce(
      (sum: number, grow: any) => sum + (grow.plant_count || 0),
      0
    );

    // Calculate projected plants
    const projectedPlants = currentPlants + additionalPlants;

    // Get warning threshold (default 80 if not set)
    const warningThreshold = environment.capacity_warning_threshold || 80;

    // Calculate projected capacity status and utilization
    const status = EnvironmentOverviewService.calculateCapacityStatus(
      projectedPlants,
      environment.max_plants,
      warningThreshold
    );

    const projectedUtilization = EnvironmentOverviewService.calculateUtilizationPercent(
      projectedPlants,
      environment.max_plants
    );

    // Generate warning messages based on status
    const warnings: string[] = [];

    if (status === 'warning' && projectedUtilization !== null) {
      warnings.push(
        `Environment will be at ${projectedUtilization}% capacity (${projectedPlants}/${environment.max_plants} plants)`
      );
    } else if (status === 'over' && environment.max_plants !== null) {
      const overflowCount = projectedPlants - environment.max_plants;
      warnings.push(
        `Environment will exceed capacity by ${overflowCount} plant${overflowCount > 1 ? 's' : ''} (${projectedPlants}/${environment.max_plants} plants)`
      );
    }

    return {
      environmentId: environment.id,
      environmentName: environment.name,
      maxPlants: environment.max_plants,
      currentPlants,
      requestedPlants: additionalPlants,
      projectedPlants,
      projectedUtilization,
      capacityWarningThreshold: warningThreshold,
      status,
      warnings,
      allowed: true, // Always non-blocking
    };
  },
};
