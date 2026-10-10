import { User, Plant, CareHistory, Recommendation, PlantProfile } from '../models';
import { Op } from 'sequelize';
import { getWeatherBasedCareAdjustments, hasRecentRain } from './weatherService';
import { logApi } from './logging/logger';

interface RecommendationInput {
  user_id: string;
  plant_id: string | null;
  type: 'water' | 'fertilize' | 'prune' | 'pest_check' | 'harvest' | 'general';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Generates smart care recommendations for a specific user
 * Analyzes care history, weather data, and seasonal timing
 * @param userId - User ID to generate recommendations for
 * @returns Array of created recommendations
 */
export async function generateRecommendationsForUser(
  userId: string
): Promise<Recommendation[]> {
  const startTime = Date.now();
  const recommendations: RecommendationInput[] = [];

  try {
    // Fetch user with plants and care history
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Plant,
          as: 'plants',
          include: [
            {
              model: CareHistory,
              as: 'careHistory',
            },
            {
              model: PlantProfile,
              as: 'plantProfile',
            },
          ],
        },
      ],
    });

    if (!user) {
      logApi.error('User not found for recommendation generation', { userId });
      return [];
    }

    const plants = (user as any).plants || [];

    if (plants.length === 0) {
      logApi.warn('No plants found for user', { userId });
      return [];
    }

    logApi.info('Recommendation generation started', {
      userId,
      plantCount: plants.length,
    });

    // Get weather-based recommendations if postal code is available
    let weatherRecommendations: string[] = [];
    let recentRain = false;
    if (user.postal_code) {
      weatherRecommendations = await getWeatherBasedCareAdjustments(user.postal_code);
      recentRain = await hasRecentRain(user.postal_code);

      // Add weather recommendations as general recommendations
      weatherRecommendations.forEach((msg) => {
        recommendations.push({
          user_id: userId,
          plant_id: null,
          type: 'general',
          message: msg,
          severity: 'low',
        });
      });
    }

    // Analyze each plant
    for (const plant of plants) {
      const careHistory = plant.careHistory || [];
      const now = new Date();

      logApi.debug('Processing plant for recommendations', {
        plantId: plant.id,
        plantName: plant.name,
        plantType: plant.plant_profile_id,
      });

      // Check for overdue watering
      if (plant.water_interval_days && plant.water_interval_days > 0) {
        const lastWater = careHistory
          .filter((ch: any) => ch.action_type === 'water')
          .sort((a: any, b: any) => b.action_date.getTime() - a.action_date.getTime())[0];

        const daysSinceWater = lastWater
          ? Math.floor((now.getTime() - lastWater.action_date.getTime()) / (1000 * 60 * 60 * 24))
          : plant.water_interval_days + 1;

        const daysOverdue = daysSinceWater - plant.water_interval_days;

        // Adjust for recent rain
        const waterThreshold = recentRain ? plant.water_interval_days + 2 : plant.water_interval_days;

        if (daysSinceWater >= waterThreshold) {
          const severity = daysOverdue > 3 ? 'high' : daysOverdue > 1 ? 'medium' : 'low';
          const message = lastWater
            ? `${plant.name} needs watering (last watered ${daysSinceWater} days ago)`
            : `${plant.name} needs its first watering`;

          recommendations.push({
            user_id: userId,
            plant_id: plant.id,
            type: 'water',
            message,
            severity,
          });
        }
      }

      // Check for overdue fertilizing
      if (plant.fert_interval_days && plant.fert_interval_days > 0) {
        const lastFertilize = careHistory
          .filter((ch: any) => ch.action_type === 'fertilize')
          .sort((a: any, b: any) => b.action_date.getTime() - a.action_date.getTime())[0];

        const daysSinceFertilize = lastFertilize
          ? Math.floor((now.getTime() - lastFertilize.action_date.getTime()) / (1000 * 60 * 60 * 24))
          : plant.fert_interval_days + 1;

        const daysOverdue = daysSinceFertilize - plant.fert_interval_days;

        if (daysSinceFertilize >= plant.fert_interval_days) {
          const severity = daysOverdue > 7 ? 'high' : daysOverdue > 3 ? 'medium' : 'low';
          const message = lastFertilize
            ? `${plant.name} needs fertilizing (last fertilized ${daysSinceFertilize} days ago)`
            : `${plant.name} needs its first fertilizing`;

          recommendations.push({
            user_id: userId,
            plant_id: plant.id,
            type: 'fertilize',
            message,
            severity,
          });
        }
      }

      // Suggest periodic pest checks (every 14 days)
      const lastPestCheck = careHistory
        .filter((ch: any) => ch.action_type === 'prune' || ch.notes?.toLowerCase().includes('pest'))
        .sort((a: any, b: any) => b.action_date.getTime() - a.action_date.getTime())[0];

      const daysSincePestCheck = lastPestCheck
        ? Math.floor((now.getTime() - lastPestCheck.action_date.getTime()) / (1000 * 60 * 60 * 24))
        : 15;

      if (daysSincePestCheck >= 14) {
        recommendations.push({
          user_id: userId,
          plant_id: plant.id,
          type: 'pest_check',
          message: `Check ${plant.name} for pests and diseases`,
          severity: 'low',
        });
      }

      // Seasonal recommendations based on zone
      if (user.growing_zone) {
        const month = now.getMonth() + 1; // 1-12
        const zone = parseInt(user.growing_zone);

        // Spring recommendations (March-May for most zones)
        if (month >= 3 && month <= 5) {
          if (!careHistory.some((ch: any) => {
            const actionMonth = new Date(ch.action_date).getMonth() + 1;
            return ch.action_type === 'fertilize' && actionMonth >= 3 && actionMonth <= 5;
          })) {
            recommendations.push({
              user_id: userId,
              plant_id: plant.id,
              type: 'fertilize',
              message: `Spring feeding time for ${plant.name}`,
              severity: 'medium',
            });
          }
        }

        // Fall recommendations (September-November)
        if (month >= 9 && month <= 11 && zone <= 7) {
          recommendations.push({
            user_id: userId,
            plant_id: plant.id,
            type: 'general',
            message: `Prepare ${plant.name} for winter - consider mulching or moving indoors`,
            severity: 'medium',
          });
        }
      }
    }

    // Create recommendation records
    logApi.debug('Checking existing recommendations', {
      userId,
      newRecommendationsCount: recommendations.length,
    });

    const createdRecommendations: Recommendation[] = [];
    for (const rec of recommendations) {
      const created = await Recommendation.create(rec as any);
      createdRecommendations.push(created);
    }

    const duration = Date.now() - startTime;
    logApi.info('Recommendations generated successfully', {
      userId,
      count: createdRecommendations.length,
      duration,
    });

    return createdRecommendations;
  } catch (error) {
    logApi.error('Error generating recommendations', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Generates recommendations for all users with plants
 * @returns Total number of recommendations created
 */
export async function generateRecommendationsForAllUsers(): Promise<number> {
  const startTime = Date.now();

  try {
    // Delete old recommendations (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await Recommendation.destroy({
      where: {
        created_at: {
          [Op.lt]: sevenDaysAgo,
        },
      },
    });

    // Get all users with plants
    const users = await User.findAll({
      include: [
        {
          model: Plant,
          as: 'plants',
          required: true, // Only users with plants
        },
      ],
    });

    let totalRecommendations = 0;

    for (const user of users) {
      const recommendations = await generateRecommendationsForUser(user.id);
      totalRecommendations += recommendations.length;
    }

    const duration = Date.now() - startTime;
    logApi.info('Batch generation complete', {
      userCount: users.length,
      totalRecommendations,
      duration,
    });

    return totalRecommendations;
  } catch (error) {
    logApi.error('Error generating recommendations for all users', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
