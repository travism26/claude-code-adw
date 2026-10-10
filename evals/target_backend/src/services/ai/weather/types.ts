/**
 * Types specific to weather action analysis
 */

import { BaseAnalysisResponse } from '../core/types';

export interface WeatherForecast {
  date: string;
  highTemp: number;
  lowTemp: number;
  conditions: string;
  precipitation: number;
  humidity: number;
}

export interface WeatherActionContext {
  garden: {
    id: string;
    name: string;
    zone: string | null;
  } | null;
  user: {
    zone: string | null;
    timezone: string;
  };
  plants: Array<{
    id: string;
    name: string;
    species: string | null;
    type: string;
    sunlightRequirements: string | null;
    zoneMin: number | null;
    zoneMax: number | null;
    difficulty: string;
    plotId: string | null;
  }>;
  weather: {
    forecast: WeatherForecast[];
    location: string;
  };
  season: {
    current: string;
    month: string;
  };
  risks: {
    frost: boolean;
    heatStress: boolean;
    drought: boolean;
    excessiveRain: boolean;
  };
}

export interface WeatherActionResponse extends BaseAnalysisResponse<WeatherActionContext> {
  gardenId?: string;
}
