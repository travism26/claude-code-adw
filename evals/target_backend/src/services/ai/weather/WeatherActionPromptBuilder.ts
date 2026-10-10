/**
 * Weather Action Prompt Builder
 * Responsible for constructing AI prompts for weather-based action analysis
 */

import { AIPrompts } from '../core/types';
import { WeatherActionContext } from './types';

export class WeatherActionPromptBuilder {
  /**
   * Build comprehensive AI prompts for weather action analysis
   */
  static build(context: WeatherActionContext): AIPrompts {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt with AI role and response format
   */
  private static buildSystemPrompt(): string {
    return `You are GrowBuddy AI, an expert weather-based gardening advisor.

Your role is to analyze weather forecasts and provide actionable recommendations to protect plants and optimize garden care based on:
- Temperature extremes (frost, heat stress)
- Precipitation patterns (drought, excessive rain)
- Seasonal timing and plant vulnerability
- Plant hardiness zones and weather tolerance
- Preventive measures and urgent actions

Respond with a JSON object in this exact format:
{
  "suggestions": [
    {
      "type": "improvement" | "warning" | "optimization",
      "category": "frost_protection" | "heat_management" | "water_management" | "storm_prep" | "general_weather",
      "title": "Brief title",
      "description": "Detailed explanation with specific protective actions",
      "affectedIds": ["plant-id-1", "plant-id-2"],
      "priority": "high" | "medium" | "low",
      "actionable": true | false
    }
  ],
  "overallScore": 75,
  "summary": "Brief 2-3 sentence overview of weather risks and key protective actions needed"
}

Guidelines:
- Prioritize urgent threats (frost, extreme heat) as high priority
- Be specific about timing (within 24 hours, this weekend, etc.)
- Include both protective actions and preventive measures
- Consider plant vulnerability based on type and zone
- Keep recommendations practical and actionable`;
  }

  /**
   * Build detailed user prompt with all weather context
   */
  private static buildUserPrompt(context: WeatherActionContext): string {
    const sections: string[] = [];

    sections.push(this.buildOverviewSection(context));
    sections.push(this.buildWeatherForecastSection(context));
    sections.push(this.buildRiskAnalysisSection(context));
    sections.push(this.buildPlantsSection(context));
    sections.push(this.buildAnalysisRequestSection(context));

    return sections.join('\n');
  }

  /**
   * Build overview section
   */
  private static buildOverviewSection(context: WeatherActionContext): string {
    return `=== LOCATION & SEASON ===
${context.garden ? `Garden: ${context.garden.name}\nGarden Zone: ${context.garden.zone || 'Not specified'}\n` : ''}User Zone: ${context.user.zone || 'Not specified'}
Location: ${context.weather.location}
Current Season: ${context.season.current} (${context.season.month})
Timezone: ${context.user.timezone}`;
  }

  /**
   * Build weather forecast section
   */
  private static buildWeatherForecastSection(
    context: WeatherActionContext
  ): string {
    const forecastLines = context.weather.forecast.map((day) => {
      const date = new Date(day.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return `  ${date}: High ${day.highTemp}°F / Low ${day.lowTemp}°F | ${day.conditions} | ${day.precipitation.toFixed(2)}" rain | ${day.humidity}% humidity`;
    });

    return `\n=== 7-DAY WEATHER FORECAST ===\n${forecastLines.join('\n')}`;
  }

  /**
   * Build risk analysis section
   */
  private static buildRiskAnalysisSection(context: WeatherActionContext): string {
    const risks: string[] = [];

    if (context.risks.frost) {
      risks.push('⚠️  FROST WARNING: Temperatures at or below freezing expected');
    }
    if (context.risks.heatStress) {
      risks.push('⚠️  HEAT STRESS: Extreme high temperatures expected');
    }
    if (context.risks.drought) {
      risks.push('⚠️  DROUGHT CONDITIONS: Low precipitation forecast');
    }
    if (context.risks.excessiveRain) {
      risks.push('⚠️  HEAVY RAIN: Excessive precipitation may cause waterlogging');
    }

    if (risks.length === 0) {
      risks.push('✓ No immediate weather threats detected');
    }

    return `\n=== WEATHER RISK ANALYSIS ===\n${risks.join('\n')}`;
  }

  /**
   * Build plants section
   */
  private static buildPlantsSection(context: WeatherActionContext): string {
    if (context.plants.length === 0) {
      return '\n=== PLANTS ===\nNo plants currently in garden.';
    }

    const plantLines = context.plants.map((plant, index) => {
      return `${index + 1}. ${plant.name} (${plant.type})
   Species: ${plant.species || 'Not specified'}
   Sunlight: ${plant.sunlightRequirements || 'Not specified'}
   Zone Range: ${plant.zoneMin || '?'} - ${plant.zoneMax || '?'}
   Difficulty: ${plant.difficulty}`;
    });

    return `\n=== PLANTS IN GARDEN (${context.plants.length}) ===\n${plantLines.join('\n')}`;
  }

  /**
   * Build analysis request section
   */
  private static buildAnalysisRequestSection(
    context: WeatherActionContext
  ): string {
    const urgentRisks = [];
    if (context.risks.frost) urgentRisks.push('frost protection');
    if (context.risks.heatStress) urgentRisks.push('heat management');
    if (context.risks.excessiveRain) urgentRisks.push('drainage/waterlogging');

    return `\n=== ANALYSIS REQUEST ===
Please analyze this weather forecast and provide:
1. ${urgentRisks.length > 0 ? `URGENT actions needed for: ${urgentRisks.join(', ')}` : 'Protective measures for any weather concerns'}
2. Specific recommendations for each vulnerable plant
3. Timeline for when actions should be taken (within 24hrs, this weekend, etc.)
4. Watering schedule adjustments based on precipitation forecast
5. General preventive measures for the upcoming weather conditions

Focus on actionable recommendations that will protect plants and optimize their health given the forecast.`;
  }
}
