/**
 * Garden Prompt Builder
 * Responsible for constructing AI prompts for garden analysis
 */

import { AIPrompts } from '../core/types';
import { GardenContext } from './types';
import {
  SYSTEM_PROMPT_BASE,
  SECTION_HEADERS,
  ANALYSIS_REQUEST_TEMPLATE,
  getStatusPromptGuidance,
  getStatusLabel,
} from './prompts';

export class GardenPromptBuilder {
  /**
   * Build comprehensive AI prompts for garden analysis
   */
  static build(context: GardenContext): AIPrompts {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt with AI role and response format
   */
  private static buildSystemPrompt(): string {
    return SYSTEM_PROMPT_BASE + getStatusPromptGuidance();
  }

  /**
   * Build detailed user prompt with all garden context
   */
  private static buildUserPrompt(context: GardenContext): string {
    const sections: string[] = [];

    sections.push(this.buildOverviewSection(context));
    sections.push(this.buildPlotDetailsSection(context));
    sections.push(this.buildCompanionRulesSection(context));
    sections.push(this.buildSeasonalTipsSection(context));
    sections.push(this.buildMetricsSection(context));
    sections.push(this.buildAnalysisRequestSection());

    return sections.join('\n');
  }

  /**
   * Build garden overview section
   */
  private static buildOverviewSection(context: GardenContext): string {
    return `${SECTION_HEADERS.GARDEN_OVERVIEW}
Name: ${context.garden.name}
Dimensions: ${context.garden.dimensions.width}ft x ${context.garden.dimensions.height}ft
Zone: ${context.garden.zone || context.user.zone || 'Not specified'}
Total Plots: ${context.metrics.totalPlots}
Occupied Plots: ${context.metrics.occupiedPlots}
Unique Plants: ${context.metrics.uniquePlants}
Plot Status Distribution:
  - Planned (not yet planted): ${context.metrics.plannedPlots}
  - Planted (in ground): ${context.metrics.plantedPlots}
  - Harvested (completed): ${context.metrics.harvestedPlots}`;
  }

  /**
   * Build plot details section
   */
  private static buildPlotDetailsSection(context: GardenContext): string {
    if (context.plots.length === 0) return '';

    const plotDetails = context.plots.map((plot, index) => {
      const plantInfo = plot.plant
        ? `
  Plant: ${plot.plant.name} (${plot.plant.type})
  Sunlight Needs: ${plot.plant.sunlightRequirements || 'not specified'}
  Spacing Requirement: ${plot.plant.spacingInches ? plot.plant.spacingInches + ' inches' : 'not specified'}
  Zone Range: ${plot.plant.zoneMin || '?'} - ${plot.plant.zoneMax || '?'}
  Plant Family: ${plot.plant.plantFamily || 'not specified'}
  Difficulty: ${plot.plant.difficulty}`
        : '  Plant: Empty plot';

      const statusLabel = getStatusLabel(plot.status);

      return `
Plot ${index + 1} (ID: ${plot.id})
  Status: ${statusLabel}
  Position: (${plot.position.x}, ${plot.position.y})
  Size: ${plot.dimensions.width}ft x ${plot.dimensions.height}ft
  Direction: ${plot.compassDirection || 'not specified'}${plantInfo}${plot.notes ? '\n  Notes: ' + plot.notes : ''}`;
    });

    return '\n' + SECTION_HEADERS.PLOT_DETAILS + plotDetails.join('');
  }

  /**
   * Build companion planting rules section
   */
  private static buildCompanionRulesSection(context: GardenContext): string {
    if (context.companionRules.length === 0) return '';

    const sections: string[] = ['\n' + SECTION_HEADERS.COMPANION_RULES];

    const beneficial = context.companionRules.filter(
      (r) => r.relationship === 'beneficial'
    );
    const harmful = context.companionRules.filter((r) => r.relationship === 'harmful');

    if (beneficial.length > 0) {
      sections.push('\nBeneficial Companions:');
      beneficial.forEach((rule) => {
        sections.push(
          `- ${rule.plantAName} + ${rule.plantBName}${rule.notes ? ': ' + rule.notes : ''}`
        );
      });
    }

    if (harmful.length > 0) {
      sections.push('\nHarmful Combinations (AVOID):');
      harmful.forEach((rule) => {
        sections.push(
          `- ${rule.plantAName} + ${rule.plantBName}${rule.notes ? ': ' + rule.notes : ''}`
        );
      });
    }

    return sections.join('\n');
  }

  /**
   * Build seasonal tips section
   */
  private static buildSeasonalTipsSection(context: GardenContext): string {
    if (context.seasonalTips.length === 0) return '';

    const sections: string[] = ['\n' + SECTION_HEADERS.SEASONAL_TIPS];

    const tipsByPlant = new Map<string, typeof context.seasonalTips>();
    context.seasonalTips.forEach((tip) => {
      if (!tipsByPlant.has(tip.plantName)) {
        tipsByPlant.set(tip.plantName, []);
      }
      tipsByPlant.get(tip.plantName)!.push(tip);
    });

    tipsByPlant.forEach((tips, plantName) => {
      sections.push(`\n${plantName}:`);
      tips.forEach((tip) => {
        sections.push(
          `  - [${tip.season}${tip.timing ? `, week ${tip.timing}` : ''}] ${tip.tip}`
        );
      });
    });

    return sections.join('\n');
  }

  /**
   * Build metrics section
   */
  private static buildMetricsSection(context: GardenContext): string {
    return `\n${SECTION_HEADERS.METRICS}
Average Plot Spacing: ${context.metrics.averageSpacing ? context.metrics.averageSpacing.toFixed(2) + ' feet' : 'N/A'}
Zone Compatibility Issues: ${context.metrics.zoneCompatibilityIssues}
Companion Conflicts Detected: ${context.metrics.companionConflicts}`;
  }

  /**
   * Build analysis request section
   */
  private static buildAnalysisRequestSection(): string {
    return ANALYSIS_REQUEST_TEMPLATE;
  }
}
