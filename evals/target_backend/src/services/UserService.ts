import { User } from '../models/User';
import { Op } from 'sequelize';

export interface UserZoneData {
  growing_zone: string | null;
  postal_code: string | null;
  zone_override: boolean;
}

export interface UserBasicInfo {
  id: string;
  email: string;
  timezone: string | null;
}

export interface UserPaginationResult {
  users: User[];
  total: number;
}

/**
 * UserService - Encapsulates all User model operations
 * Routes should use this service instead of importing User model directly
 */
export const UserService = {
  /**
   * Find user by primary key
   */
  async findById(userId: string): Promise<User | null> {
    return User.findByPk(userId);
  },

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  },

  /**
   * Get user zone data for the zones route
   */
  async getUserZoneData(userId: string): Promise<UserZoneData | null> {
    const user = await User.findByPk(userId);
    if (!user) {
      return null;
    }
    return {
      growing_zone: user.growing_zone || null,
      postal_code: user.postal_code || null,
      zone_override: user.zone_override || false,
    };
  },

  /**
   * Create a new user
   */
  async create(data: {
    email: string;
    password_hash: string;
    tz?: string;
  }): Promise<User> {
    return User.create(data);
  },

  /**
   * Update user refresh token
   */
  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ refresh_token: refreshToken });
    }
  },

  /**
   * Validate user password
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    return user.validatePassword(password);
  },

  /**
   * Get paginated users list (for admin)
   */
  async findAllPaginated(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<UserPaginationResult> {
    const { page, limit, search } = options;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (search) {
      whereClause.email = {
        [Op.iLike]: `%${search}%`,
      };
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'email', 'growing_zone', 'postal_code', 'tz', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return { users: rows, total: count };
  },

  /**
   * Get user by ID with specific attributes (for admin)
   */
  async findByIdWithAttributes(userId: string): Promise<User | null> {
    return User.findByPk(userId, {
      attributes: ['id', 'email', 'growing_zone', 'postal_code', 'tz', 'zone_override', 'created_at', 'updated_at'],
    });
  },

  /**
   * Update user fields
   */
  async update(userId: string, data: Partial<{
    email: string;
    growing_zone: string;
    postal_code: string;
    tz: string;
  }>): Promise<User | null> {
    const user = await User.findByPk(userId);
    if (!user) {
      return null;
    }
    await user.update(data);
    return User.findByPk(userId, {
      attributes: ['id', 'email', 'growing_zone', 'postal_code', 'tz', 'zone_override', 'created_at', 'updated_at'],
    });
  },

  /**
   * Find all users (for bulk operations)
   */
  async findAll(options?: { attributes?: string[] }): Promise<User[]> {
    return User.findAll(options);
  },

  /**
   * Count total users
   */
  async count(where?: any): Promise<number> {
    return User.count({ where });
  },

  /**
   * Get users grouped by zone (for stats)
   */
  async getUsersByZone(): Promise<{ zone: string; count: number }[]> {
    const results = await User.findAll({
      attributes: [
        'growing_zone',
        [User.sequelize!.fn('COUNT', User.sequelize!.col('id')), 'count'],
      ],
      where: {
        growing_zone: {
          [Op.not]: null,
        },
      },
      group: ['growing_zone'],
      order: [[User.sequelize!.literal('count'), 'DESC']],
    });

    return results.map((item: any) => ({
      zone: item.growing_zone,
      count: parseInt(item.dataValues.count, 10),
    }));
  },

  /**
   * Get recent signup counts
   */
  async getRecentSignupCounts(): Promise<{ last7Days: number; last30Days: number }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [last7Days, last30Days] = await Promise.all([
      User.count({
        where: {
          created_at: { [Op.gte]: sevenDaysAgo },
        },
      }),
      User.count({
        where: {
          created_at: { [Op.gte]: thirtyDaysAgo },
        },
      }),
    ]);

    return { last7Days, last30Days };
  },
};
