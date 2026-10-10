/**
 * Weather Action Context Builder
 * Responsible for gathering weather and plant data for AI analysis
 */

import { Garden } from '../../../models/Garden';
import { Plot } from '../../../models/Plot';
import { PlantProfile } from '../../../models/PlantProfile';
import { User } from '../../../models/User';
import { WeatherActionContext, WeatherForecast } from './types';

export class WeatherActionContextBuilder {
  constructor() {
    // Models are initialized at app startup, no sequelize needed
  }

  /**
   * Build comprehensive weather action context for AI analysis
   * @param payload - Contains gardenId (optional), userId, and weatherForecast
   */
  async build(payload: {
    gardenId?: string;
    userId: string;
    weatherForecast?: WeatherForecast[];
    location?: string;
  }): Promise<WeatherActionContext> {
    const user = await this.fetchUser(payload.userId);

    let gardenInfo = null;
    let plants: any[] = [];

    if (payload.gardenId) {
      // Get plants from specific garden
      const garden = await this.fetchGarden(payload.gardenId, payload.userId);
      gardenInfo = {
        id: garden.id,
        name: garden.name,
        zone: garden.zone,
      };

      // Get all plots with plants in this garden
      const plots = await Plot.findAll({
        where: { garden_id: garden.id },
        include: [
          {
            model: PlantProfile,
            as: 'plantProfile',
          },
        ],
      });

      plants = plots
        .filter((plot: any) => plot.plantProfile)
        .map((plot: any) => ({
          id: plot.plant_profile_id!,
          name: plot.plantProfile.name,
          species: plot.plantProfile.species,
          type: plot.plantProfile.type,
          sunlightRequirements: plot.plantProfile.sunlight_requirements,
          zoneMin: plot.plantProfile.zone_min,
          zoneMax: plot.plantProfile.zone_max,
          difficulty: plot.plantProfile.difficulty,
          plotId: plot.id,
        }));
    } else {
      // Get all user's plants (if no garden specified)
      // This is a simplified version - in real implementation you'd want to query Plant model
      // For now, we'll just use empty array if no garden
      plants = [];
    }

    // Use provided weather forecast or generate mock data
    const weatherForecast =
      payload.weatherForecast || this.generateMockWeatherForecast();

    // Determine current season and month
    const season = this.getCurrentSeason();

    // Analyze weather risks
    const risks = this.analyzeWeatherRisks(weatherForecast);

    return {
      garden: gardenInfo,
      user: {
        zone: user.growing_zone,
        timezone: user.tz,
      },
      plants,
      weather: {
        forecast: weatherForecast,
        location: payload.location || user.growing_zone || 'Unknown',
      },
      season,
      risks,
    };
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
   * Fetch garden
   */
  private async fetchGarden(gardenId: string, userId: string) {
    const garden = await Garden.findOne({
      where: { id: gardenId, user_id: userId },
    });

    if (!garden) {
      throw new Error('Garden not found or access denied');
    }

    return garden;
  }

  /**
   * Generate mock weather forecast for testing
   */
  private generateMockWeatherForecast(): WeatherForecast[] {
    const today = new Date();
    const forecast: WeatherForecast[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Generate realistic temperature variation
      const baseTemp = 65;
      const variation = Math.sin((date.getMonth() / 12) * Math.PI * 2) * 20;
      const highTemp = Math.round(baseTemp + variation + Math.random() * 10);
      const lowTemp = Math.round(highTemp - 10 - Math.random() * 5);

      forecast.push({
        date: date.toISOString().split('T')[0],
        highTemp,
        lowTemp,
        conditions: this.getRandomCondition(),
        precipitation: Math.random() * 0.5,
        humidity: Math.round(40 + Math.random() * 40),
      });
    }

    return forecast;
  }

  /**
   * Get random weather condition
   */
  private getRandomCondition(): string {
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Rain'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  /**
   * Get current season and month
   */
  private getCurrentSeason(): { current: string; month: string } {
    const now = new Date();
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    const monthNum = now.getMonth(); // 0-11

    let current = 'unknown';
    if (monthNum >= 2 && monthNum <= 4) current = 'spring';
    else if (monthNum >= 5 && monthNum <= 7) current = 'summer';
    else if (monthNum >= 8 && monthNum <= 10) current = 'fall';
    else current = 'winter';

    return { current, month };
  }

  /**
   * Analyze weather forecast for potential risks
   */
  private analyzeWeatherRisks(forecast: WeatherForecast[]) {
    let frost = false;
    let heatStress = false;
    let drought = false;
    let excessiveRain = false;

    forecast.forEach((day) => {
      if (day.lowTemp <= 32) frost = true;
      if (day.highTemp >= 95) heatStress = true;
      if (day.precipitation >= 1.5) excessiveRain = true;
    });

    // Check for drought (no rain for extended period)
    const totalPrecipitation = forecast.reduce(
      (sum, day) => sum + day.precipitation,
      0
    );
    if (totalPrecipitation < 0.5) drought = true;

    return { frost, heatStress, drought, excessiveRain };
  }
}
