import axios from 'axios';
import { logApi } from './logging/logger';

interface WeatherData {
  temp: number;
  humidity: number;
  precipitation: number;
  conditions: string;
  forecast: {
    date: string;
    temp_high: number;
    temp_low: number;
    precipitation_chance: number;
  }[];
}

// Simple cache to avoid excessive API calls
const weatherCache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Fetches weather data for a given postal code using OpenWeatherMap API
 * @param postalCode - US postal code
 * @param countryCode - Country code (default: 'US')
 * @returns Weather data including current conditions and forecast
 */
export async function getWeatherByPostalCode(
  postalCode: string,
  countryCode = 'US'
): Promise<WeatherData | null> {
  const cacheKey = `${postalCode}_${countryCode}`;

  // Check cache first
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    logApi.debug('Cache hit for weather data', {
      postalCode,
      countryCode,
      cacheAge: Date.now() - cached.timestamp,
    });
    logApi.info('Weather data fetched successfully', {
      postalCode,
      source: 'cache',
    });
    return cached.data;
  }

  logApi.debug('Cache miss for weather data', {
    postalCode,
  });

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    logApi.warn('OpenWeatherMap API key not configured');
    return null;
  }

  try {
    // Get coordinates from postal code
    logApi.debug('Geocoding request', {
      postalCode,
      countryCode,
    });

    const geocodeUrl = `http://api.openweathermap.org/geo/1.0/zip?zip=${postalCode},${countryCode}&appid=${apiKey}`;
    const geocodeResponse = await axios.get(geocodeUrl);

    if (!geocodeResponse.data || !geocodeResponse.data.lat) {
      logApi.warn('Geocoding returned no results', {
        postalCode,
        countryCode,
      });
      logApi.error('Failed to geocode postal code', {
        postalCode,
        countryCode,
      });
      return null;
    }

    const { lat, lon } = geocodeResponse.data;

    // Get current weather
    logApi.debug('API call to OpenWeatherMap', {
      postalCode,
      endpoint: 'weather',
      lat,
      lon,
    });

    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;
    const currentWeatherResponse = await axios.get(currentWeatherUrl);

    // Get 5-day forecast
    logApi.debug('API call to OpenWeatherMap', {
      postalCode,
      endpoint: 'forecast',
      lat,
      lon,
    });

    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;
    const forecastResponse = await axios.get(forecastUrl);

    // Calculate precipitation from current weather
    const precipitation = currentWeatherResponse.data.rain
      ? currentWeatherResponse.data.rain['1h'] || 0
      : 0;

    // Parse forecast data (get daily forecasts)
    const dailyForecasts: { [key: string]: any } = {};
    forecastResponse.data.list.forEach((item: any) => {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = {
          temps: [],
          precipChances: [],
        };
      }
      dailyForecasts[date].temps.push(item.main.temp);
      dailyForecasts[date].precipChances.push(item.pop * 100);
    });

    const forecast = Object.keys(dailyForecasts)
      .slice(0, 5)
      .map((date) => ({
        date,
        temp_high: Math.max(...dailyForecasts[date].temps),
        temp_low: Math.min(...dailyForecasts[date].temps),
        precipitation_chance: Math.max(...dailyForecasts[date].precipChances),
      }));

    const weatherData: WeatherData = {
      temp: currentWeatherResponse.data.main.temp,
      humidity: currentWeatherResponse.data.main.humidity,
      precipitation,
      conditions: currentWeatherResponse.data.weather[0].main,
      forecast,
    };

    // Cache the result
    weatherCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now(),
    });

    logApi.info('Weather data cached', {
      postalCode,
      ttl: CACHE_DURATION,
    });

    logApi.info('Weather data fetched successfully', {
      postalCode,
      source: 'api',
      temp: weatherData.temp,
      conditions: weatherData.conditions,
    });

    return weatherData;
  } catch (error) {
    // Check if it's a rate limit error
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      logApi.error('API rate limit hit', {
        postalCode,
        error: error.message,
      });
    } else {
      logApi.error('Error fetching weather data', {
        postalCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

/**
 * Determines if recent weather suggests plant needs less water
 * @param postalCode - US postal code
 * @returns True if recent rain or high humidity reduces water needs
 */
export async function hasRecentRain(postalCode: string): Promise<boolean> {
  const weather = await getWeatherByPostalCode(postalCode);

  if (!weather) {
    return false;
  }

  // Check if there was recent precipitation or high humidity
  return weather.precipitation > 0.1 || weather.humidity > 80;
}

/**
 * Gets recommended care adjustments based on weather
 * @param postalCode - US postal code
 * @returns Care recommendations based on current weather
 */
export async function getWeatherBasedCareAdjustments(
  postalCode: string
): Promise<string[]> {
  const weather = await getWeatherByPostalCode(postalCode);
  const recommendations: string[] = [];

  if (!weather) {
    return recommendations;
  }

  // Temperature-based recommendations
  if (weather.temp > 85) {
    recommendations.push('High temperatures detected - consider extra watering or shade');
  } else if (weather.temp < 40) {
    recommendations.push('Cold temperatures detected - protect sensitive plants from frost');
  }

  // Precipitation-based recommendations
  if (weather.precipitation > 0.5) {
    recommendations.push('Recent rain detected - reduce watering schedule');
  }

  // Humidity-based recommendations
  if (weather.humidity > 80) {
    recommendations.push('High humidity - monitor for fungal diseases');
  }

  // Forecast-based recommendations
  const upcomingRain = weather.forecast.some((day) => day.precipitation_chance > 70);
  if (upcomingRain) {
    recommendations.push('Rain expected soon - delay watering');
  }

  return recommendations;
}
