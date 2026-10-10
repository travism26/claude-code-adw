import { PlantProfile, SeasonalTip } from '../models';
import { Op } from 'sequelize';

export interface PlantProfileFilters {
  page?: number;
  limit?: number;
  type?: string;
  difficulty?: string;
  zone?: number;
  search?: string;
}

export interface PlantProfilePaginationResult {
  plantProfiles: PlantProfile[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * PlantProfileService - Encapsulates all PlantProfile model operations
 */
export const PlantProfileService = {
  /**
   * Find plant profiles with pagination and filtering
   */
  async findAll(filters: PlantProfileFilters): Promise<PlantProfilePaginationResult> {
    const { page = 1, limit = 20, type, difficulty, zone, search } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    const andConditions: any[] = [];

    if (type) whereClause.type = type;
    if (difficulty) whereClause.difficulty = difficulty;

    if (zone) {
      andConditions.push({
        [Op.or]: [
          {
            [Op.and]: [
              { zone_min: { [Op.lte]: zone } },
              { zone_max: { [Op.gte]: zone } },
            ],
          },
          {
            [Op.and]: [{ zone_min: null }, { zone_max: null }],
          },
        ],
      });
    }

    if (search) {
      andConditions.push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { species: { [Op.iLike]: `%${search}%` } },
          { common_name: { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    if (andConditions.length > 0) {
      whereClause[Op.and] = andConditions;
    }

    const { count, rows: profiles } = await PlantProfile.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['name', 'ASC']],
    });

    return {
      plantProfiles: profiles,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Search plant profiles by name/species
   */
  async search(query: string): Promise<PlantProfile[]> {
    return PlantProfile.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { species: { [Op.iLike]: `%${query}%` } },
          { common_name: { [Op.iLike]: `%${query}%` } },
        ],
      },
      limit: 50,
      order: [['name', 'ASC']],
    });
  },

  /**
   * Find plant profile by ID with seasonal tips
   */
  async findByIdWithTips(id: string): Promise<{ profile: PlantProfile; tips: SeasonalTip[] } | null> {
    try {
      const profile = await PlantProfile.findOne({
        where: { id },
        include: [
          {
            model: SeasonalTip,
            as: 'tips',
            required: false,
          },
        ],
      });

      if (!profile) return null;

      return {
        profile,
        tips: (profile as any).tips || [],
      };
    } catch (dbError: any) {
      if (dbError.name === 'SequelizeDatabaseError' || dbError.message?.includes('invalid input syntax')) {
        return null;
      }
      throw dbError;
    }
  },

  /**
   * Find plant profile by ID
   */
  async findById(id: string): Promise<PlantProfile | null> {
    return PlantProfile.findByPk(id);
  },

  /**
   * Find multiple plant profiles by IDs
   */
  async findByIds(ids: string[]): Promise<PlantProfile[]> {
    return PlantProfile.findAll({
      where: { id: ids },
    });
  },

  /**
   * Find seasonal tips for a given hardiness zone and season.
   *
   * Includes `year_round` tips alongside the requested season, and matches
   * tips whose [zone_min, zone_max] range contains the zone (null bounds = any
   * zone). Each tip is joined with its plant profile's common name.
   */
  async findSeasonalTips(zone?: number, season?: string): Promise<SeasonalTip[]> {
    const where: any = {};

    if (season) {
      where.season = { [Op.in]: [season, 'year_round'] };
    }

    if (zone !== undefined) {
      where[Op.and] = [
        { [Op.or]: [{ zone_min: null }, { zone_min: { [Op.lte]: zone } }] },
        { [Op.or]: [{ zone_max: null }, { zone_max: { [Op.gte]: zone } }] },
      ];
    }

    return SeasonalTip.findAll({
      where,
      include: [
        {
          model: PlantProfile,
          as: 'plant_profile',
          required: false,
          attributes: ['id', 'common_name'],
        },
      ],
      order: [['priority', 'DESC']],
      limit: 50,
    });
  },
};
