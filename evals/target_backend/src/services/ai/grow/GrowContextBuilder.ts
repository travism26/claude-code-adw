/**
 * Grow Context Builder
 * Responsible for gathering all grow-related data for AI analysis
 */

import { Grow } from '../../../models/Grow';
import { GrowLog } from '../../../models/GrowLog';
import { GrowLogEnvironment } from '../../../models/GrowLogEnvironment';
import { GrowLogPhoto } from '../../../models/GrowLogPhoto';
import { GrowNutrient } from '../../../models/GrowNutrient';
import { Nutrient } from '../../../models/Nutrient';
import { GrowHarvest } from '../../../models/GrowHarvest';
import { User } from '../../../models/User';
import { logAI } from '../../logging/logger';
import {
  GrowContext,
  GrowInfo,
  LogEntry,
  EnvironmentData,
  EnvironmentTrends,
  MetricTrend,
  NutrientInfo,
  HarvestData,
  GrowMetrics,
} from './types';

export class GrowContextBuilder {
  constructor() {
    // Models are initialized at app startup, no sequelize needed
  }

  /**
   * Build comprehensive grow context for AI analysis
   */
  async build(growId: string, userId: string): Promise<GrowContext> {
    logAI.debug('Building grow context', { growId, userId });

    // Fetch grow with owner
    const grow = await this.fetchGrow(growId, userId);
    const user = await this.fetchUser(userId);

    // Fetch logs with environment and photos
    const logs = await this.fetchLogs(growId);

    // Build environment trends
    const environment = this.buildEnvironmentTrends(logs);

    // Fetch nutrients
    const nutrients = await this.fetchNutrients(growId);

    // Fetch harvest data if available
    const harvest = await this.fetchHarvest(growId);

    // Calculate metrics
    const metrics = this.calculateMetrics(grow, logs, environment);

    // Build grow info
    const growInfo = this.buildGrowInfo(grow);

    logAI.info('Grow context built', {
      growId,
      logCount: logs.length,
      hasEnvironment: environment.hasTrends,
      nutrientCount: nutrients.length,
      hasHarvest: harvest !== null,
    });

    return {
      grow: growInfo,
      logs,
      environment,
      nutrients,
      harvest,
      metrics,
      user: {
        timezone: user.tz,
      },
    };
  }

  /**
   * Fetch grow with verification of ownership
   */
  private async fetchGrow(growId: string, userId: string) {
    const grow = await Grow.findOne({
      where: { id: growId, user_id: userId },
    });

    if (!grow) {
      throw new Error('Grow not found or access denied');
    }

    return grow;
  }

  /**
   * Fetch user
   */
  private async fetchUser(userId: string) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Fetch logs with environment and photos
   * Limited to most recent 50 entries for context window management
   */
  private async fetchLogs(growId: string): Promise<LogEntry[]> {
    const growLogs = await GrowLog.findAll({
      where: { grow_id: growId },
      include: [
        {
          model: GrowLogEnvironment,
          as: 'environment',
          required: false,
        },
        {
          model: GrowLogPhoto,
          as: 'photos',
          required: false,
        },
      ],
      order: [['logged_at', 'DESC']],
      limit: 50, // Context window management - limit to recent 50 logs
    });

    logAI.debug('Logs fetched', { growId, count: growLogs.length });

    return growLogs.map((log: any) => ({
      id: log.id,
      loggedAt: log.logged_at,
      dayNumber: log.day_number,
      phase: log.phase,
      heightInches: log.height_inches ? parseFloat(log.height_inches) : null,
      notes: log.notes,
      environment: log.environment
        ? this.buildEnvironmentData(log.environment)
        : null,
      photoCount: log.photos ? log.photos.length : 0,
    }));
  }

  /**
   * Build environment data from log environment
   */
  private buildEnvironmentData(env: any): EnvironmentData {
    return {
      temperatureF: env.temperature_f ? parseFloat(env.temperature_f) : null,
      humidityPercent: env.humidity_percent
        ? parseFloat(env.humidity_percent)
        : null,
      ph: env.ph ? parseFloat(env.ph) : null,
      ec: env.ec ? parseFloat(env.ec) : null,
      ppm: env.ppm ? parseFloat(env.ppm) : null,
      co2Ppm: env.co2_ppm ? parseFloat(env.co2_ppm) : null,
      lightHours: env.light_hours ? parseFloat(env.light_hours) : null,
      lightDistanceInches: env.light_distance_inches
        ? parseFloat(env.light_distance_inches)
        : null,
      vpd: env.vpd ? parseFloat(env.vpd) : null,
    };
  }

  /**
   * Build environment trends from logs
   */
  private buildEnvironmentTrends(logs: LogEntry[]): EnvironmentTrends {
    const logsWithEnv = logs.filter((log) => log.environment !== null);

    if (logsWithEnv.length === 0) {
      logAI.warn('No environment data available');
      return this.createEmptyTrends();
    }

    const trends: EnvironmentTrends = {
      hasTrends: true,
      temperature: this.calculateMetricTrend(
        logsWithEnv,
        (env) => env.temperatureF
      ),
      humidity: this.calculateMetricTrend(
        logsWithEnv,
        (env) => env.humidityPercent
      ),
      ph: this.calculateMetricTrend(logsWithEnv, (env) => env.ph),
      ec: this.calculateMetricTrend(logsWithEnv, (env) => env.ec),
      ppm: this.calculateMetricTrend(logsWithEnv, (env) => env.ppm),
      co2: this.calculateMetricTrend(logsWithEnv, (env) => env.co2Ppm),
      lightHours: this.calculateMetricTrend(
        logsWithEnv,
        (env) => env.lightHours
      ),
      lightDistance: this.calculateMetricTrend(
        logsWithEnv,
        (env) => env.lightDistanceInches
      ),
      vpd: this.calculateMetricTrend(logsWithEnv, (env) => env.vpd),
    };

    logAI.debug('Environment trends calculated', {
      logsWithEnvData: logsWithEnv.length,
      temperatureAvg: trends.temperature.average,
      humidityAvg: trends.humidity.average,
      vpdAvg: trends.vpd.average,
    });

    return trends;
  }

  /**
   * Calculate trend for a single metric
   */
  private calculateMetricTrend(
    logs: LogEntry[],
    extractor: (env: EnvironmentData) => number | null
  ): MetricTrend {
    const values = logs
      .map((log) => log.environment && extractor(log.environment))
      .filter((val): val is number => val !== null);

    if (values.length === 0) {
      return { average: null, min: null, max: null, count: 0 };
    }

    return {
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  /**
   * Create empty trends when no environment data exists
   */
  private createEmptyTrends(): EnvironmentTrends {
    const emptyTrend: MetricTrend = {
      average: null,
      min: null,
      max: null,
      count: 0,
    };
    return {
      hasTrends: false,
      temperature: emptyTrend,
      humidity: emptyTrend,
      ph: emptyTrend,
      ec: emptyTrend,
      ppm: emptyTrend,
      co2: emptyTrend,
      lightHours: emptyTrend,
      lightDistance: emptyTrend,
      vpd: emptyTrend,
    };
  }

  /**
   * Fetch nutrients for grow
   */
  private async fetchNutrients(growId: string): Promise<NutrientInfo[]> {
    const growNutrients = await GrowNutrient.findAll({
      where: { grow_id: growId },
      include: [
        {
          model: Nutrient,
          as: 'nutrient',
          required: true,
        },
      ],
    });

    logAI.debug('Nutrients fetched', { growId, count: growNutrients.length });

    return growNutrients.map((gn: any) => ({
      id: gn.nutrient.id,
      brand: gn.nutrient.brand,
      productName: gn.nutrient.product_name,
      npkRatio: gn.nutrient.npk_ratio,
      type: gn.nutrient.type,
      dosageMl: gn.dosage_ml_per_gallon
        ? parseFloat(gn.dosage_ml_per_gallon)
        : null,
      frequency: gn.frequency,
      phaseUsed: gn.phase_used,
    }));
  }

  /**
   * Fetch harvest data if available
   */
  private async fetchHarvest(growId: string): Promise<HarvestData | null> {
    const harvest = await GrowHarvest.findOne({
      where: { grow_id: growId },
    });

    if (!harvest) {
      logAI.debug('No harvest data available', { growId });
      return null;
    }

    logAI.debug('Harvest data fetched', { growId });

    return {
      id: harvest.id,
      harvestedAt: harvest.harvested_at,
      wetWeightGrams: harvest.wet_weight_grams
        ? parseFloat(harvest.wet_weight_grams as any)
        : null,
      dryWeightGrams: harvest.dry_weight_grams
        ? parseFloat(harvest.dry_weight_grams as any)
        : null,
      thcPercent: harvest.thc_percent
        ? parseFloat(harvest.thc_percent as any)
        : null,
      cbdPercent: harvest.cbd_percent
        ? parseFloat(harvest.cbd_percent as any)
        : null,
      terpeneProfile: harvest.terpene_profile
        ? JSON.stringify(harvest.terpene_profile)
        : null,
      qualityRating: harvest.quality_rating,
      notes: harvest.smoke_report,
    };
  }

  /**
   * Calculate grow metrics
   */
  private calculateMetrics(
    grow: any,
    logs: LogEntry[],
    environment: EnvironmentTrends
  ): GrowMetrics {
    const now = new Date();
    const daysSinceStart = Math.floor(
      (now.getTime() - new Date(grow.started_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const daysInPhase = grow.phase_started_at
      ? Math.floor(
          (now.getTime() - new Date(grow.phase_started_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    // Calculate growth rate (inches per day)
    let growthRate: number | null = null;
    const logsWithHeight = logs.filter((log) => log.heightInches !== null);
    if (logsWithHeight.length >= 2) {
      // Sort by logged_at ascending for growth rate calculation
      const sortedLogs = [...logsWithHeight].sort(
        (a, b) => a.loggedAt.getTime() - b.loggedAt.getTime()
      );
      const firstLog = sortedLogs[0];
      const lastLog = sortedLogs[sortedLogs.length - 1];
      const heightDiff = lastLog.heightInches! - firstLog.heightInches!;
      const timeDiff =
        (lastLog.loggedAt.getTime() - firstLog.loggedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (timeDiff > 0) {
        growthRate = heightDiff / timeDiff;
      }
    }

    // Count total photos
    const photoCount = logs.reduce((sum, log) => sum + log.photoCount, 0);

    logAI.debug('Metrics calculated', {
      daysSinceStart,
      daysInPhase,
      growthRate,
      photoCount,
    });

    return {
      daysSinceStart,
      daysInPhase,
      growthRate,
      photoCount,
      logEntryCount: logs.length,
      hasEnvironmentData: environment.hasTrends,
      hasNutrientSchedule: false, // Will be set by caller
      hasHarvestData: false, // Will be set by caller
    };
  }

  /**
   * Build grow info from grow model
   */
  private buildGrowInfo(grow: any): GrowInfo {
    return {
      id: grow.id,
      strainName: grow.strain_name,
      strainType: grow.strain_type,
      growMethod: grow.grow_method,
      growMedium: grow.grow_medium,
      lightType: grow.light_type,
      lightWattage: grow.light_wattage,
      growSpaceSqft: grow.grow_space_sqft
        ? parseFloat(grow.grow_space_sqft)
        : null,
      potSizeGallons: grow.pot_size_gallons
        ? parseFloat(grow.pot_size_gallons)
        : null,
      plantCount: grow.plant_count,
      phase: grow.phase,
      phaseStartedAt: grow.phase_started_at,
      startedAt: grow.started_at,
      harvestedAt: grow.harvested_at,
      notes: grow.notes,
    };
  }
}
