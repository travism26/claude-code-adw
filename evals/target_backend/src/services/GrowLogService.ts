import { GrowLog, GrowLogEnvironment, Grow } from '../models';

export interface GrowLogData {
  logged_at: Date;
  day_number?: number | null;
  phase?: 'germination' | 'vegetative' | 'flowering' | 'harvest' | null;
  height_inches?: number | null;
  notes?: string | null;
  environment?: GrowLogEnvironmentData;
}

export interface GrowLogEnvironmentData {
  temperature_f?: number | null;
  humidity_percent?: number | null;
  ph?: number | null;
  ec?: number | null;
  ppm?: number | null;
  co2_ppm?: number | null;
  light_hours?: number | null;
  light_distance_inches?: number | null;
  vpd?: number | null;
}

export interface GrowLogFilters {
  phase?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * GrowLogService - Encapsulates all GrowLog model operations
 */
export const GrowLogService = {
  /**
   * Create a log entry with optional environment data
   */
  async create(growId: string, data: GrowLogData): Promise<GrowLog> {
    const { environment, ...logData } = data;

    const log = await GrowLog.create({
      ...logData,
      grow_id: growId,
    });

    // Create environment data if provided
    if (environment) {
      await GrowLogEnvironment.create({
        ...environment,
        grow_log_id: log.id,
      });
    }

    // Reload with environment
    return (await GrowLog.findByPk(log.id, {
      include: [
        {
          model: GrowLogEnvironment,
          as: 'environment',
        },
      ],
    }))!;
  },

  /**
   * Find logs for a grow with optional filters
   */
  async findByGrow(growId: string, filters?: GrowLogFilters): Promise<GrowLog[]> {
    const whereClause: any = { grow_id: growId };

    if (filters?.phase) {
      whereClause.phase = filters.phase;
    }

    return GrowLog.findAll({
      where: whereClause,
      include: [
        {
          model: GrowLogEnvironment,
          as: 'environment',
        },
      ],
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      order: [['logged_at', 'DESC']],
    });
  },

  /**
   * Find a single log by ID and grow
   */
  async findByIdAndGrow(logId: string, growId: string): Promise<GrowLog | null> {
    return GrowLog.findOne({
      where: {
        id: logId,
        grow_id: growId,
      },
      include: [
        {
          model: GrowLogEnvironment,
          as: 'environment',
        },
      ],
    });
  },

  /**
   * Find a log by ID (for ownership verification)
   */
  async findById(logId: string): Promise<GrowLog | null> {
    return GrowLog.findOne({
      where: { id: logId },
      include: [
        {
          model: Grow,
          as: 'grow',
          attributes: ['id', 'user_id'],
        },
        {
          model: GrowLogEnvironment,
          as: 'environment',
        },
      ],
    });
  },

  /**
   * Update a log entry
   */
  async update(log: GrowLog, data: Partial<Omit<GrowLogData, 'environment'>>): Promise<GrowLog> {
    await log.update(data);
    return log;
  },

  /**
   * Delete a log entry
   */
  async delete(log: GrowLog): Promise<void> {
    await log.destroy();
  },

  /**
   * Create environment data for a log
   */
  async createEnvironment(logId: string, data: GrowLogEnvironmentData): Promise<GrowLogEnvironment> {
    return GrowLogEnvironment.create({
      ...data,
      grow_log_id: logId,
    });
  },

  /**
   * Update environment data
   */
  async updateEnvironment(
    environment: GrowLogEnvironment,
    data: Partial<GrowLogEnvironmentData>
  ): Promise<GrowLogEnvironment> {
    await environment.update(data);
    return environment;
  },

  /**
   * Find environment by log ID
   */
  async findEnvironmentByLogId(logId: string): Promise<GrowLogEnvironment | null> {
    return GrowLogEnvironment.findOne({
      where: { grow_log_id: logId },
    });
  },

  /**
   * Verify grow ownership
   */
  async verifyGrowOwnership(growId: string, userId: string): Promise<boolean> {
    const grow = await Grow.findOne({
      where: {
        id: growId,
        user_id: userId,
      },
    });
    return !!grow;
  },
};
