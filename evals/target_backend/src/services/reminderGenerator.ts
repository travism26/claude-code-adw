import { Reminder } from '../models/Reminder';
import { Plant } from '../models/Plant';
import { PlantProfile } from '../models/PlantProfile';
import { User } from '../models/User';
import { Op } from 'sequelize';
import { logApi } from './logging/logger';

interface ReminderGenerationOptions {
  startDate?: Date;
  zoneAdjustment?: boolean;
}

/**
 * Generate reminders for a plant based on its profile and care intervals
 */
export async function generateRemindersForPlant(
  plantId: string,
  options: ReminderGenerationOptions = {}
): Promise<Reminder[]> {
  const { startDate = new Date(), zoneAdjustment = true } = options;

  logApi.info('Reminder generation started', { plantId });

  // Find the plant with its profile and user
  const plant = await Plant.findByPk(plantId, {
    include: [
      { model: PlantProfile, as: 'plantProfile' },
      { model: User, as: 'owner' },
    ],
  });

  if (!plant) {
    logApi.error('Plant not found for reminder generation', { plantId });
    throw new Error('Plant not found');
  }

  const createdReminders: Reminder[] = [];

  // Calculate water reminder date
  const waterIntervalDays = plant.water_interval_days;
  let waterDate = new Date(startDate);
  waterDate.setDate(waterDate.getDate() + waterIntervalDays);

  logApi.debug('Calculating next reminder date', {
    plantId,
    actionType: 'water',
    interval: waterIntervalDays,
    nextDate: waterDate,
  });

  // Apply zone adjustment if enabled and user has a zone
  if (zoneAdjustment && plant.owner?.growing_zone) {
    const adjustment = getZoneWateringAdjustment(plant.owner.growing_zone);
    const adjustedDays = Math.max(1, Math.round(waterIntervalDays * adjustment));
    waterDate = new Date(startDate);
    waterDate.setDate(waterDate.getDate() + adjustedDays);
    logApi.debug('Zone adjustment applied', {
      plantId,
      zoneId: plant.owner.growing_zone,
      adjustmentFactor: adjustment,
      adjustedDays,
    });
  }

  // Check if water reminder already exists for this date
  const existingWaterReminder = await Reminder.findOne({
    where: {
      plant_id: plantId,
      type: 'water',
      scheduled_date: {
        [Op.gte]: new Date(waterDate.setHours(0, 0, 0, 0)),
        [Op.lt]: new Date(waterDate.setHours(23, 59, 59, 999)),
      },
    },
  });

  if (!existingWaterReminder) {
    const waterReminder = await Reminder.create({
      user_id: plant.user_id,
      plant_id: plantId,
      type: 'water',
      scheduled_date: waterDate,
      status: 'pending',
      retry_count: 0,
    });
    createdReminders.push(waterReminder);
  } else {
    logApi.debug('Reminder skipped', {
      plantId,
      actionType: 'water',
      reason: 'already_exists',
    });
  }

  // Calculate fertilize reminder date if applicable
  if (plant.fert_interval_days) {
    const fertIntervalDays = plant.fert_interval_days;
    const fertDate = new Date(startDate);
    fertDate.setDate(fertDate.getDate() + fertIntervalDays);

    // Check if fertilize reminder already exists
    const existingFertReminder = await Reminder.findOne({
      where: {
        plant_id: plantId,
        type: 'fertilize',
        scheduled_date: {
          [Op.gte]: new Date(fertDate.setHours(0, 0, 0, 0)),
          [Op.lt]: new Date(fertDate.setHours(23, 59, 59, 999)),
        },
      },
    });

    if (!existingFertReminder) {
      const fertReminder = await Reminder.create({
        user_id: plant.user_id,
        plant_id: plantId,
        type: 'fertilize',
        scheduled_date: fertDate,
        status: 'pending',
        retry_count: 0,
      });
      createdReminders.push(fertReminder);
    } else {
      logApi.debug('Reminder skipped', {
        plantId,
        actionType: 'fertilize',
        reason: 'already_exists',
      });
    }
  } else {
    logApi.warn('No reminders needed', {
      plantId,
      reason: 'no_fertilize_interval',
    });
  }

  if (createdReminders.length === 0) {
    logApi.warn('No reminders needed', {
      plantId,
      reason: 'all_reminders_exist',
    });
  } else {
    logApi.info('Reminders generated', {
      plantId,
      reminderCount: createdReminders.length,
      nextReminder: createdReminders[0]?.scheduled_date,
    });
  }

  return createdReminders;
}

/**
 * Regenerate reminders after a care action is logged
 * This creates the next reminder based on when care was actually performed
 */
export async function regenerateRemindersAfterCare(
  plantId: string,
  actionType: 'water' | 'fertilize',
  actionDate: Date
): Promise<Reminder | null> {
  const plant = await Plant.findByPk(plantId, {
    include: [{ model: User, as: 'owner' }],
  });

  if (!plant) {
    throw new Error('Plant not found');
  }

  // Delete any pending reminders of this type for this plant
  await Reminder.destroy({
    where: {
      plant_id: plantId,
      type: actionType,
      status: 'pending',
    },
  });

  // Determine interval days
  const intervalDays =
    actionType === 'water'
      ? plant.water_interval_days
      : plant.fert_interval_days;

  if (!intervalDays) {
    return null; // No interval set for this action type
  }

  // Calculate next reminder date
  const nextDate = new Date(actionDate);
  let adjustedDays = intervalDays;

  // Apply zone adjustment for watering
  if (actionType === 'water' && plant.owner?.growing_zone) {
    const adjustment = getZoneWateringAdjustment(plant.owner.growing_zone);
    adjustedDays = Math.max(1, Math.round(intervalDays * adjustment));
  }

  nextDate.setDate(nextDate.getDate() + adjustedDays);

  // Create new reminder
  const reminder = await Reminder.create({
    user_id: plant.user_id,
    plant_id: plantId,
    type: actionType,
    scheduled_date: nextDate,
    status: 'pending',
    retry_count: 0,
  });

  return reminder;
}

/**
 * Get watering frequency adjustment based on hardiness zone
 * Hotter zones (higher numbers) may need more frequent watering
 */
function getZoneWateringAdjustment(zone: string): number {
  // Parse zone string to number (e.g., '6a' -> 6, '10' -> 10)
  const zoneNum = parseInt(zone, 10);

  if (isNaN(zoneNum)) {
    return 1.0;
  }

  // Zone-based adjustment multiplier
  // Lower zones (colder) = longer intervals
  // Higher zones (warmer) = shorter intervals
  const adjustments: Record<number, number> = {
    1: 1.2, // 20% longer intervals (colder, slower evaporation)
    2: 1.15,
    3: 1.1,
    4: 1.05,
    5: 1.0,
    6: 1.0,
    7: 0.95,
    8: 0.9,
    9: 0.85, // 15% shorter intervals (warmer, faster evaporation)
    10: 0.8,
    11: 0.75,
    12: 0.7,
    13: 0.65, // 35% shorter intervals (very hot)
  };

  return adjustments[zoneNum] || 1.0;
}

/**
 * Bulk generate reminders for multiple plants
 */
export async function bulkGenerateReminders(
  plantIds: string[]
): Promise<Record<string, Reminder[]>> {
  const results: Record<string, Reminder[]> = {};

  for (const plantId of plantIds) {
    try {
      const reminders = await generateRemindersForPlant(plantId);
      results[plantId] = reminders;
      logApi.info('Reminders generated', {
        plantId,
        reminderCount: reminders.length,
        nextReminder: reminders[0]?.scheduled_date,
      });
    } catch (error) {
      logApi.error('Error generating reminders for plant', {
        plantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      results[plantId] = [];
    }
  }

  return results;
}

/**
 * Clean up old sent/failed reminders
 */
export async function cleanupOldReminders(daysOld = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await Reminder.destroy({
    where: {
      status: {
        [Op.in]: ['sent', 'failed'],
      },
      updated_at: {
        [Op.lt]: cutoffDate,
      },
    },
  });

  return result;
}
