import { AnalysisUsage } from '../models/AnalysisUsage';
import { User } from '../models/User';
import { AITask } from '../models/AITask';
import { Op } from 'sequelize';
import moment from 'moment-timezone';
import { logApi } from './logging/logger';

/**
 * AnalysisLimitService
 *
 * Manages daily AI analysis limits for users, including:
 * - Checking if a user can perform an analysis
 * - Tracking usage counts
 * - Granting admin bonus analyses
 * - Enforcing the default daily limit (5 analyses per day)
 */

const DEFAULT_DAILY_LIMIT = 5;
const PHOTO_ANALYSIS_DAILY_LIMIT = 3;

/**
 * Analysis types supported by the limit service
 */
export type AnalysisType = 'garden_analysis' | 'grow_analysis' | 'grow_photo_analysis' | 'grow_nutrient_recommendation';

/**
 * Get the daily limit for a specific analysis type
 */
function getDailyLimit(analysisType: AnalysisType): number {
  switch (analysisType) {
    case 'grow_photo_analysis':
      return PHOTO_ANALYSIS_DAILY_LIMIT;
    case 'garden_analysis':
    case 'grow_analysis':
    case 'grow_nutrient_recommendation':
    default:
      return DEFAULT_DAILY_LIMIT;
  }
}

/**
 * Result of checking if a user can analyze
 */
export interface CanAnalyzeResult {
  canAnalyze: boolean;
  remaining: number;
  hasPending: boolean;
  reason?: string;
}

/**
 * Usage statistics for today
 */
export interface UsageStats {
  used: number;
  bonus: number;
  total: number;
  remaining: number;
}

/**
 * Get the current date in the user's timezone (YYYY-MM-DD format)
 */
function getUserDate(userTimezone: string): string {
  return moment.tz(userTimezone).format('YYYY-MM-DD');
}

/**
 * Timeout threshold for stale tasks (5 minutes)
 */
const STALE_TASK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Clean up stale pending/processing tasks that have been stuck for too long
 * This prevents tasks from blocking the user indefinitely if something goes wrong
 *
 * @param userId - The ID of the user
 * @returns Number of tasks cleaned up
 */
async function cleanupStaleTasks(userId: string): Promise<number> {
  try {
    logApi.debug('Checking for stale tasks', { userId, timeout: STALE_TASK_TIMEOUT_MS });

    const staleThreshold = new Date(Date.now() - STALE_TASK_TIMEOUT_MS);

    const [affectedCount] = await AITask.update(
      {
        status: 'failed',
        error_message: 'Task timed out after being stuck in pending/processing state',
        completed_at: new Date(),
      },
      {
        where: {
          user_id: userId,
          task_type: 'garden_analysis',
          status: {
            [Op.in]: ['pending', 'processing'],
          },
          created_at: {
            [Op.lt]: staleThreshold,
          },
        },
      }
    );

    if (affectedCount > 0) {
      logApi.info('Old records cleanup', {
        userId,
        recordsDeleted: affectedCount,
        threshold: STALE_TASK_TIMEOUT_MS
      });
    }

    return affectedCount;
  } catch (error) {
    logApi.error('Failed to cleanup stale tasks', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return 0;
  }
}

/**
 * Check if a user can perform an AI analysis
 *
 * @param userId - The ID of the user
 * @param analysisType - Type of analysis (garden_analysis, grow_analysis, photo_analysis)
 * @param resourceId - Optional resource ID to check for per-resource pending tasks (gardenId, growId, photoId)
 * @returns Object with canAnalyze status, remaining count, pending status, and optional reason
 */
export async function checkCanAnalyze(
  userId: string,
  analysisType: AnalysisType = 'garden_analysis',
  resourceId?: string
): Promise<CanAnalyzeResult> {
  // First, clean up any stale tasks
  await cleanupStaleTasks(userId);

  // Get user with timezone info
  const user = await User.findByPk(userId, {
    attributes: ['id', 'tz', 'ai_analysis_enabled'],
  });

  if (!user) {
    return {
      canAnalyze: false,
      remaining: 0,
      hasPending: false,
      reason: 'user_not_found',
    };
  }

  // Check if AI analysis is enabled for this user
  if (!user.ai_analysis_enabled) {
    return {
      canAnalyze: false,
      remaining: 0,
      hasPending: false,
      reason: 'feature_disabled',
    };
  }

  // Check for pending/processing tasks of this type
  // If resourceId is provided, only check for that specific resource
  const pendingTaskWhere: any = {
    user_id: userId,
    task_type: analysisType,
    status: {
      [Op.in]: ['pending', 'processing'],
    },
  };

  // Per-resource blocking: only block if there's a pending task for THIS resource
  if (resourceId) {
    // The payload structure varies by analysis type
    if (analysisType === 'garden_analysis') {
      pendingTaskWhere.request_payload = { gardenId: resourceId };
    } else if (analysisType === 'grow_analysis') {
      pendingTaskWhere.request_payload = { growId: resourceId };
    } else if (analysisType === 'grow_photo_analysis') {
      pendingTaskWhere.request_payload = { photoId: resourceId };
    } else if (analysisType === 'grow_nutrient_recommendation') {
      pendingTaskWhere.request_payload = { growId: resourceId };
    }
  }

  const pendingTask = await AITask.findOne({
    where: pendingTaskWhere,
  });

  if (pendingTask) {
    logApi.warn('Pending analysis blocking check', {
      userId,
      analysisType,
      resourceId,
      taskId: pendingTask.id,
      taskStatus: pendingTask.status
    });
    return {
      canAnalyze: false,
      remaining: 0,
      hasPending: true,
      reason: 'analysis_pending',
    };
  }

  // Get or create today's usage record
  const today = getUserDate(user.tz);
  logApi.debug('Cache lookup for usage stats', { userId, date: today, analysisType });

  const [usageRecord] = await AnalysisUsage.findOrCreate({
    where: {
      user_id: userId,
      usage_date: today,
    },
    defaults: {
      user_id: userId,
      usage_date: today,
      analyses_used: 0,
      bonus_analyses: 0,
    },
  });

  // Calculate remaining analyses based on analysis type
  const dailyLimit = getDailyLimit(analysisType);
  const totalAvailable = dailyLimit + usageRecord.bonus_analyses;
  const remaining = Math.max(0, totalAvailable - usageRecord.analyses_used);

  const canAnalyze = remaining > 0;

  if (!canAnalyze) {
    logApi.warn('Limit exceeded', {
      userId,
      analysisType,
      dailyLimit,
      used: usageRecord.analyses_used,
      bonus: usageRecord.bonus_analyses,
      total: totalAvailable,
      remaining
    });
  } else {
    logApi.info('Daily limit check result', {
      userId,
      analysisType,
      dailyLimit,
      canAnalyze,
      remaining,
      used: usageRecord.analyses_used
    });
  }

  return {
    canAnalyze,
    remaining,
    hasPending: false,
    reason: remaining > 0 ? undefined : 'limit_reached',
  };
}

/**
 * Increment the usage count for today
 *
 * @param userId - The ID of the user
 * @returns Updated usage record
 */
export async function incrementUsage(userId: string): Promise<AnalysisUsage> {
  // Get user with timezone info
  const user = await User.findByPk(userId, {
    attributes: ['id', 'tz'],
  });

  if (!user) {
    throw new Error('User not found');
  }

  const today = getUserDate(user.tz);

  // Get or create today's usage record
  const [usageRecord] = await AnalysisUsage.findOrCreate({
    where: {
      user_id: userId,
      usage_date: today,
    },
    defaults: {
      user_id: userId,
      usage_date: today,
      analyses_used: 0,
      bonus_analyses: 0,
    },
  });

  // Increment usage
  usageRecord.analyses_used += 1;
  await usageRecord.save();

  logApi.info('Usage increment success', {
    userId,
    newCount: usageRecord.analyses_used,
    date: today,
    bonus: usageRecord.bonus_analyses
  });

  return usageRecord;
}

/**
 * Decrement the usage count for today (refund a failed analysis)
 *
 * @param userId - The ID of the user
 * @returns Updated usage record, or null if no record exists to decrement
 */
export async function decrementUsage(userId: string): Promise<AnalysisUsage | null> {
  // Get user with timezone info
  const user = await User.findByPk(userId, {
    attributes: ['id', 'tz'],
  });

  if (!user) {
    logApi.warn('Cannot decrement usage: user not found', { userId });
    return null;
  }

  const today = getUserDate(user.tz);

  // Find today's usage record
  const usageRecord = await AnalysisUsage.findOne({
    where: {
      user_id: userId,
      usage_date: today,
    },
  });

  if (!usageRecord) {
    logApi.warn('Cannot decrement usage: no usage record', { userId, date: today });
    return null;
  }

  // Only decrement if there's usage to decrement
  if (usageRecord.analyses_used > 0) {
    usageRecord.analyses_used -= 1;
    await usageRecord.save();
    logApi.info('Analysis refunded successfully', {
      userId,
      newCount: usageRecord.analyses_used,
      date: today
    });
  } else {
    logApi.warn('Cannot decrement: zero analyses used', {
      userId,
      date: today
    });
  }

  return usageRecord;
}

/**
 * Grant bonus analyses to a user for today
 *
 * @param userId - The ID of the user
 * @param count - Number of bonus analyses to grant (must be positive)
 * @param adminId - ID of the admin granting the bonus (for audit trail)
 * @returns Updated usage record
 */
export async function grantBonusAnalyses(
  userId: string,
  count: number,
  adminId: string
): Promise<AnalysisUsage> {
  // Validate count
  if (!Number.isInteger(count) || count <= 0) {
    logApi.error('Bonus grant failure: invalid count', {
      userId,
      adminId,
      count,
      reason: 'must be positive integer'
    });
    throw new Error('Bonus count must be a positive integer');
  }

  // Get user with timezone info
  const user = await User.findByPk(userId, {
    attributes: ['id', 'tz'],
  });

  if (!user) {
    logApi.error('Bonus grant failure: user not found', {
      userId,
      adminId,
      count
    });
    throw new Error('User not found');
  }

  const today = getUserDate(user.tz);

  // Get or create today's usage record
  const [usageRecord] = await AnalysisUsage.findOrCreate({
    where: {
      user_id: userId,
      usage_date: today,
    },
    defaults: {
      user_id: userId,
      usage_date: today,
      analyses_used: 0,
      bonus_analyses: 0,
    },
  });

  // Increment bonus analyses
  usageRecord.bonus_analyses += count;
  await usageRecord.save();

  // Log action for audit trail
  logApi.info('Bonus analysis granted', {
    adminId,
    targetUserId: userId,
    amount: count,
    date: today,
    totalBonus: usageRecord.bonus_analyses
  });

  return usageRecord;
}

/**
 * Get usage statistics for today
 *
 * @param userId - The ID of the user
 * @returns Usage statistics including used, bonus, total, and remaining counts
 */
export async function getUsageForToday(userId: string): Promise<UsageStats> {
  // Get user with timezone info
  const user = await User.findByPk(userId, {
    attributes: ['id', 'tz'],
  });

  if (!user) {
    throw new Error('User not found');
  }

  const today = getUserDate(user.tz);

  logApi.debug('Getting current usage stats', { userId, date: today });

  // Try to find today's usage record
  const usageRecord = await AnalysisUsage.findOne({
    where: {
      user_id: userId,
      usage_date: today,
    },
  });

  // If no record exists, return default stats
  if (!usageRecord) {
    return {
      used: 0,
      bonus: 0,
      total: DEFAULT_DAILY_LIMIT,
      remaining: DEFAULT_DAILY_LIMIT,
    };
  }

  const total = DEFAULT_DAILY_LIMIT + usageRecord.bonus_analyses;
  const remaining = Math.max(0, total - usageRecord.analyses_used);

  return {
    used: usageRecord.analyses_used,
    bonus: usageRecord.bonus_analyses,
    total,
    remaining,
  };
}

/**
 * Reset daily usage (for future cron job implementation)
 * Deletes usage records older than 30 days for cleanup
 *
 * @returns Number of deleted records
 */
export async function resetDailyUsage(): Promise<number> {
  const thirtyDaysAgo = moment().subtract(30, 'days').format('YYYY-MM-DD');

  const result = await AnalysisUsage.destroy({
    where: {
      usage_date: {
        [Op.lt]: thirtyDaysAgo,
      },
    },
  });

  logApi.info('Daily reset triggered', {
    date: thirtyDaysAgo,
    recordsDeleted: result
  });

  return result;
}

// Export singleton instance methods
export const analysisLimitService = {
  checkCanAnalyze,
  incrementUsage,
  decrementUsage,
  grantBonusAnalyses,
  getUsageForToday,
  resetDailyUsage,
  DEFAULT_DAILY_LIMIT,
};
