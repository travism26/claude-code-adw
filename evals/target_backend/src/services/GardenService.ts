import { Garden, Plot, PlantProfile, GardenAnalysis } from '../models';

export interface PlotData {
  x: number;
  y: number;
  width: number;
  height: number;
  plant_profile_id?: string;
  notes?: string;
  compass_direction?: string;
  status?: string;
}

/**
 * GardenService - Encapsulates all Garden and Plot model operations
 */
export const GardenService = {
  /**
   * Find all gardens for a user with plots
   */
  async findAllByUser(userId: string): Promise<Garden[]> {
    return Garden.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Plot,
          as: 'plots',
          include: [
            {
              model: PlantProfile,
              as: 'plantProfile',
              attributes: ['id', 'name', 'common_name', 'species', 'icon_url', 'type'],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  },

  /**
   * Find a garden by ID and user with plots
   */
  async findByIdAndUser(id: string, userId: string): Promise<Garden | null> {
    return Garden.findOne({
      where: {
        id,
        user_id: userId,
      },
      include: [
        {
          model: Plot,
          as: 'plots',
          include: [
            {
              model: PlantProfile,
              as: 'plantProfile',
              attributes: ['id', 'name', 'common_name', 'species', 'spacing_inches', 'icon_url', 'type'],
            },
          ],
        },
      ],
    });
  },

  /**
   * Find a garden by ID and user (simple, without includes)
   */
  async findByIdAndUserSimple(id: string, userId: string): Promise<Garden | null> {
    return Garden.findOne({
      where: {
        id,
        user_id: userId,
      },
    });
  },

  /**
   * Find a garden by ID and user with plots (for overlap checking)
   */
  async findByIdAndUserWithPlots(id: string, userId: string): Promise<Garden | null> {
    return Garden.findOne({
      where: {
        id,
        user_id: userId,
      },
      include: [{ model: Plot, as: 'plots' }],
    });
  },

  /**
   * Create a new garden
   */
  async create(data: {
    name: string;
    width: number;
    height: number;
    user_id: string;
    zone?: string;
    notes?: string;
  }): Promise<Garden> {
    return Garden.create(data);
  },

  /**
   * Update a garden
   */
  async update(garden: Garden, data: Partial<{
    name: string;
    width: number;
    height: number;
    zone: string;
    notes: string;
  }>): Promise<Garden> {
    await garden.update(data);
    return garden;
  },

  /**
   * Delete a garden
   */
  async delete(garden: Garden): Promise<void> {
    await garden.destroy();
  },

  /**
   * Create a plot in a garden
   */
  async createPlot(gardenId: string, data: PlotData): Promise<Plot> {
    const plot = await Plot.create({
      garden_id: gardenId,
      ...data,
    });

    return (await Plot.findByPk(plot.id, {
      include: [
        {
          model: PlantProfile,
          as: 'plantProfile',
          attributes: ['id', 'name', 'common_name', 'species', 'icon_url', 'type'],
        },
      ],
    }))!;
  },

  /**
   * Find a plot by ID and garden
   */
  async findPlotByIdAndGarden(plotId: string, gardenId: string): Promise<Plot | null> {
    return Plot.findOne({
      where: {
        id: plotId,
        garden_id: gardenId,
      },
    });
  },

  /**
   * Update a plot
   */
  async updatePlot(plot: Plot, data: Partial<PlotData>): Promise<Plot> {
    await plot.update(data);
    return (await Plot.findByPk(plot.id, {
      include: [
        {
          model: PlantProfile,
          as: 'plantProfile',
          attributes: ['id', 'name', 'common_name', 'species', 'icon_url', 'type'],
        },
      ],
    }))!;
  },

  /**
   * Delete a plot
   */
  async deletePlot(plot: Plot): Promise<void> {
    await plot.destroy();
  },

  /**
   * Bulk create plots
   */
  async bulkCreatePlots(plots: Array<{
    garden_id: string;
    plant_profile_id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    status: string;
    notes?: string;
  }>): Promise<Plot[]> {
    const createdPlots = await Plot.bulkCreate(plots);
    return Plot.findAll({
      where: { id: createdPlots.map((p) => p.id) },
      include: [
        {
          model: PlantProfile,
          as: 'plantProfile',
          attributes: ['id', 'name', 'common_name', 'species', 'icon_url'],
        },
      ],
    });
  },

  /**
   * Find plant profile by ID
   */
  async findPlantProfileById(id: string): Promise<PlantProfile | null> {
    return PlantProfile.findByPk(id);
  },

  /**
   * Find multiple plant profiles by IDs
   */
  async findPlantProfilesByIds(ids: string[]): Promise<PlantProfile[]> {
    return PlantProfile.findAll({
      where: { id: ids },
    });
  },

  /**
   * Get current garden analysis
   */
  async getCurrentAnalysis(gardenId: string): Promise<GardenAnalysis | null> {
    return GardenAnalysis.findOne({
      where: {
        garden_id: gardenId,
        is_current: true,
      },
      order: [['analyzed_at', 'DESC']],
    });
  },
};
