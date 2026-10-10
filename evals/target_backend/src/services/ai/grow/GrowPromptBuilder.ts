/**
 * Grow Prompt Builder
 * Responsible for constructing AI prompts for grow analysis
 */

import { AIPrompts } from '../core/types';
import { GrowContext, AnalysisType } from './types';
import {
  SYSTEM_PROMPT_GENERAL,
  SYSTEM_PROMPT_NUTRIENTS,
  SYSTEM_PROMPT_DIAGNOSIS,
  SYSTEM_PROMPT_OPTIMIZATION,
  SYSTEM_PROMPT_HARVEST_TIMING,
  SECTION_HEADERS,
  ANALYSIS_REQUEST_GENERAL,
  ANALYSIS_REQUEST_NUTRIENTS,
  ANALYSIS_REQUEST_DIAGNOSIS,
  ANALYSIS_REQUEST_OPTIMIZATION,
  ANALYSIS_REQUEST_HARVEST_TIMING,
  getPhaseAnalysisGuidance,
} from './prompts';

export class GrowPromptBuilder {
  /**
   * Build comprehensive AI prompts for grow analysis
   */
  static build(
    context: GrowContext,
    analysisType: AnalysisType = 'general'
  ): AIPrompts {
    const systemPrompt = this.buildSystemPrompt(analysisType, context);
    const userPrompt = this.buildUserPrompt(context, analysisType);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt with AI role and response format
   */
  private static buildSystemPrompt(
    analysisType: AnalysisType,
    context: GrowContext
  ): string {
    // Select base prompt based on analysis type
    let basePrompt: string;
    switch (analysisType) {
      case 'nutrients':
        basePrompt = SYSTEM_PROMPT_NUTRIENTS;
        break;
      case 'diagnosis':
        basePrompt = SYSTEM_PROMPT_DIAGNOSIS;
        break;
      case 'optimization':
        basePrompt = SYSTEM_PROMPT_OPTIMIZATION;
        break;
      case 'harvest_timing':
        basePrompt = SYSTEM_PROMPT_HARVEST_TIMING;
        break;
      case 'general':
      default:
        basePrompt = SYSTEM_PROMPT_GENERAL;
    }

    // Add phase-specific guidance
    const phaseGuidance = getPhaseAnalysisGuidance(
      context.grow.phase,
      analysisType
    );

    return `${basePrompt}\n\n${phaseGuidance}`;
  }

  /**
   * Build detailed user prompt with all grow context
   */
  private static buildUserPrompt(
    context: GrowContext,
    analysisType: AnalysisType
  ): string {
    const sections: string[] = [];

    sections.push(this.buildOverviewSection(context));
    sections.push(this.buildRecentActivitySection(context));
    sections.push(this.buildEnvironmentTrendsSection(context));
    sections.push(this.buildNutrientScheduleSection(context));

    if (context.harvest) {
      sections.push(this.buildHarvestDataSection(context));
    }

    sections.push(this.buildAnalysisRequestSection(analysisType));

    return sections.join('\n\n');
  }

  /**
   * Build grow overview section
   */
  private static buildOverviewSection(context: GrowContext): string {
    const grow = context.grow;
    return `${SECTION_HEADERS.GROW_OVERVIEW}
Strain: ${grow.strainName} (${grow.strainType || 'type not specified'})
Current Phase: ${grow.phase} (${context.metrics.daysInPhase} days in phase)
Total Days: ${context.metrics.daysSinceStart} days since start
Grow Method: ${grow.growMethod || 'not specified'}
Grow Medium: ${grow.growMedium || 'not specified'}
Light Type: ${grow.lightType || 'not specified'}${grow.lightWattage ? ` (${grow.lightWattage}W)` : ''}
Grow Space: ${grow.growSpaceSqft ? `${grow.growSpaceSqft} sq ft` : 'not specified'}
Container Size: ${grow.potSizeGallons ? `${grow.potSizeGallons} gallons` : 'not specified'}
Plant Count: ${grow.plantCount}
Started: ${grow.startedAt.toISOString().split('T')[0]}${grow.phaseStartedAt ? `\nPhase Started: ${grow.phaseStartedAt.toISOString().split('T')[0]}` : ''}${grow.notes ? `\nGrower Notes: ${grow.notes}` : ''}`;
  }

  /**
   * Build recent activity section
   */
  private static buildRecentActivitySection(context: GrowContext): string {
    if (context.logs.length === 0) {
      return `${SECTION_HEADERS.RECENT_ACTIVITY}\nNo log entries recorded yet.`;
    }

    // Show most recent 20 logs (already reversed by context builder)
    const recentLogs = context.logs.slice(0, 20);

    const logEntries = recentLogs.map((log, index) => {
      const dayInfo = log.dayNumber !== null ? `Day ${log.dayNumber}` : 'Day N/A';
      const phaseInfo = log.phase ? ` (${log.phase})` : '';
      const heightInfo = log.heightInches !== null ? `Height: ${log.heightInches}"` : '';
      const photoInfo = log.photoCount > 0 ? ` | ${log.photoCount} photo(s)` : '';
      const notes = log.notes ? `\n  Notes: ${log.notes}` : '';

      return `Log ${index + 1} - ${log.loggedAt.toISOString().split('T')[0]} | ${dayInfo}${phaseInfo}
  ${heightInfo}${photoInfo}${notes}`;
    });

    return `${SECTION_HEADERS.RECENT_ACTIVITY}\nShowing ${recentLogs.length} most recent entries:\n\n${logEntries.join('\n\n')}`;
  }

  /**
   * Build environment trends section
   */
  private static buildEnvironmentTrendsSection(context: GrowContext): string {
    const env = context.environment;

    if (!env.hasTrends) {
      return `${SECTION_HEADERS.ENVIRONMENT_TRENDS}\nNo environmental data recorded.`;
    }

    const formatTrend = (name: string, trend: typeof env.temperature): string => {
      if (trend.count === 0 || trend.average === null) {
        return `${name}: No data`;
      }
      return `${name}: avg ${trend.average.toFixed(1)} (min ${trend.min!.toFixed(1)}, max ${trend.max!.toFixed(1)}) [${trend.count} readings]`;
    };

    return `${SECTION_HEADERS.ENVIRONMENT_TRENDS}
Based on ${context.logs.length} log entries:

${formatTrend('Temperature (°F)', env.temperature)}
${formatTrend('Humidity (%)', env.humidity)}
${formatTrend('VPD (kPa)', env.vpd)}
${formatTrend('pH', env.ph)}
${formatTrend('EC (mS/cm)', env.ec)}
${formatTrend('PPM', env.ppm)}
${formatTrend('CO2 (PPM)', env.co2)}
${formatTrend('Light Hours', env.lightHours)}
${formatTrend('Light Distance (inches)', env.lightDistance)}`;
  }

  /**
   * Build nutrient schedule section
   */
  private static buildNutrientScheduleSection(context: GrowContext): string {
    if (context.nutrients.length === 0) {
      return `${SECTION_HEADERS.NUTRIENT_SCHEDULE}\nNo nutrient schedule configured.`;
    }

    const nutrientEntries = context.nutrients.map((nutrient) => {
      const brandInfo = nutrient.brand ? `${nutrient.brand} - ` : '';
      const npkInfo = nutrient.npkRatio ? ` (NPK: ${nutrient.npkRatio})` : '';
      const dosageInfo = nutrient.dosageMl !== null ? `${nutrient.dosageMl} ml/gal` : 'dosage not specified';
      const frequencyInfo = nutrient.frequency || 'frequency not specified';
      const phaseInfo = nutrient.phaseUsed ? ` | Used in: ${nutrient.phaseUsed}` : '';
      const typeInfo = nutrient.type ? ` | Type: ${nutrient.type}` : '';

      return `- ${brandInfo}${nutrient.productName}${npkInfo}
  Dosage: ${dosageInfo} | Frequency: ${frequencyInfo}${phaseInfo}${typeInfo}`;
    });

    return `${SECTION_HEADERS.NUTRIENT_SCHEDULE}\n${nutrientEntries.join('\n\n')}`;
  }

  /**
   * Build harvest data section
   */
  private static buildHarvestDataSection(context: GrowContext): string {
    const harvest = context.harvest!;

    return `${SECTION_HEADERS.HARVEST_DATA}
Harvested: ${harvest.harvestedAt.toISOString().split('T')[0]}
Wet Weight: ${harvest.wetWeightGrams !== null ? `${harvest.wetWeightGrams}g` : 'not recorded'}
Dry Weight: ${harvest.dryWeightGrams !== null ? `${harvest.dryWeightGrams}g` : 'not recorded'}
THC%: ${harvest.thcPercent !== null ? `${harvest.thcPercent}%` : 'not tested'}
CBD%: ${harvest.cbdPercent !== null ? `${harvest.cbdPercent}%` : 'not tested'}
Terpene Profile: ${harvest.terpeneProfile || 'not tested'}
Quality Rating: ${harvest.qualityRating !== null ? `${harvest.qualityRating}/10` : 'not rated'}${harvest.notes ? `\nSmoke Report: ${harvest.notes}` : ''}`;
  }

  /**
   * Build analysis request section
   */
  private static buildAnalysisRequestSection(analysisType: AnalysisType): string {
    switch (analysisType) {
      case 'nutrients':
        return ANALYSIS_REQUEST_NUTRIENTS;
      case 'diagnosis':
        return ANALYSIS_REQUEST_DIAGNOSIS;
      case 'optimization':
        return ANALYSIS_REQUEST_OPTIMIZATION;
      case 'harvest_timing':
        return ANALYSIS_REQUEST_HARVEST_TIMING;
      case 'general':
      default:
        return ANALYSIS_REQUEST_GENERAL;
    }
  }
}
