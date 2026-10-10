import { detectZoneFromPostalCode } from '../utils/zoneData';
import { User } from '../models/User';

export interface ZoneDetectionResult {
  zone: number | null;
  method: 'auto' | 'manual' | 'none';
  postalCode?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detect zone from postal code and return result with confidence
 */
export async function detectZone(postalCode: string): Promise<ZoneDetectionResult> {
  const zone = detectZoneFromPostalCode(postalCode);

  if (zone !== null) {
    return {
      zone,
      method: 'auto',
      postalCode,
      confidence: 'high',
    };
  }

  return {
    zone: null,
    method: 'none',
    postalCode,
    confidence: 'low',
  };
}

/**
 * Update user's zone information
 */
export async function updateUserZone(
  userId: string,
  zone: string,
  postalCode?: string,
  isOverride = false
): Promise<User> {
  // Validate zone format
  if (!/^([1-9]|1[0-3])[ab]?$/.test(zone)) {
    throw new Error('Invalid zone format. Must be like "6a", "7b", or "10"');
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await user.update({
    growing_zone: zone,
    postal_code: postalCode || user.postal_code,
    zone_override: isOverride,
  });

  return user;
}

/**
 * Get user's current zone
 */
export async function getUserZone(userId: string): Promise<ZoneDetectionResult> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.growing_zone) {
    // Parse zone string to number for compatibility
    const zoneNum = parseInt(user.growing_zone, 10);
    return {
      zone: isNaN(zoneNum) ? null : zoneNum,
      method: user.zone_override ? 'manual' : 'auto',
      postalCode: user.postal_code || undefined,
      confidence: 'high',
    };
  }

  // If user has postal code but no zone, try to detect
  if (user.postal_code) {
    const detected = await detectZone(user.postal_code);
    if (detected.zone) {
      // Auto-update user's zone
      await updateUserZone(userId, detected.zone.toString(), user.postal_code, false);
      return detected;
    }
  }

  return {
    zone: null,
    method: 'none',
    confidence: 'low',
  };
}

/**
 * Check if a plant is compatible with a user's zone
 */
export function isPlantCompatibleWithZone(
  plantZoneMin: number | null,
  plantZoneMax: number | null,
  userZone: number | null
): boolean {
  // If user has no zone, we can't determine compatibility
  if (userZone === null) {
    return true; // Allow by default
  }

  // If plant has no zone restrictions, it's compatible
  if (plantZoneMin === null && plantZoneMax === null) {
    return true;
  }

  // Check if user's zone is within plant's range
  const minOk = plantZoneMin === null || userZone >= plantZoneMin;
  const maxOk = plantZoneMax === null || userZone <= plantZoneMax;

  return minOk && maxOk;
}
