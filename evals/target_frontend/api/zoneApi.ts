// Zone detection and management API
import { ApiClient } from "../utils/api";
import type { ZoneDetectionResult, UserZone } from "../types";

const apiClient = ApiClient.getInstance();

export const detectZoneFromPostalCode = async (
  postalCode: string
): Promise<ZoneDetectionResult> => {
  const response = await apiClient.request<{
    zoneDetection: ZoneDetectionResult;
  }>("/zones/detect", {
    method: "POST",
    body: JSON.stringify({ postalCode }),
  });
  return response.zoneDetection;
};

// Backend response interface for user zone
interface UserZoneBackendResponse {
  growing_zone: string | null;
  postal_code: string | null;
  zone_override: boolean;
}

export const fetchUserZone = async (): Promise<UserZone> => {
  const response = await apiClient.request<UserZoneBackendResponse>(
    "/zones/user"
  );

  // Transform backend response to frontend UserZone type
  // Parse zone from string like "6a" to number 6
  const zoneNum = response.growing_zone
    ? parseInt(response.growing_zone.replace(/[ab]$/, ''), 10)
    : 0;

  return {
    zone: zoneNum,
    postalCode: response.postal_code || undefined,
    isOverride: response.zone_override,
    updatedAt: new Date().toISOString(), // Backend doesn't provide this yet
  };
};

export const updateUserZone = async (
  zone: number,
  postalCode?: string,
  override?: boolean
): Promise<UserZone> => {
  // Convert zone number to string format (e.g., 6 -> "6")
  // Note: Backend expects format like "6a" or "7b" but we're sending just the number
  // This might need adjustment based on how the zone is supposed to be updated
  const growing_zone = zone.toString();

  const response = await apiClient.request<UserZoneBackendResponse>(
    "/zones/user",
    {
      method: "PUT",
      body: JSON.stringify({
        growing_zone,
        postal_code: postalCode,
        zone_override: override,
      }),
    }
  );

  // Transform backend response to frontend UserZone type
  const zoneNum = response.growing_zone
    ? parseInt(response.growing_zone.replace(/[ab]$/, ''), 10)
    : 0;

  return {
    zone: zoneNum,
    postalCode: response.postal_code || undefined,
    isOverride: response.zone_override,
    updatedAt: new Date().toISOString(),
  };
};
