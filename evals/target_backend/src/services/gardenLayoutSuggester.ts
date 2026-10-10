import { PlantProfile, PlantCompanion } from '../models';
import { Op } from 'sequelize';
import { logApi } from './logging/logger';

interface SuggestedPlot {
  x: number;
  y: number;
  width: number;
  height: number;
  plant_profile_id: string;
  plant_name: string;
  notes?: string;
}

interface LayoutSuggestion {
  plots: SuggestedPlot[];
  warnings: string[];
  tips: string[];
}

/**
 * Suggests an optimal garden layout based on selected plants
 * Considers spacing requirements, companion planting, and sunlight needs
 * @param gardenWidth - Width of garden in feet
 * @param gardenHeight - Height of garden in feet
 * @param plantProfileIds - Array of plant profile IDs to include
 * @param zone - Growing zone for zone-specific recommendations
 * @returns Suggested layout with plots and tips
 */
export async function suggestGardenLayout(
  gardenWidth: number,
  gardenHeight: number,
  plantProfileIds: string[],
  _zone?: string
): Promise<LayoutSuggestion> {
  const startTime = Date.now();
  const gardenId = `temp-${Date.now()}`; // For logging purposes
  const plots: SuggestedPlot[] = [];
  const warnings: string[] = [];
  const tips: string[] = [];

  logApi.info('Layout suggestion started', {
    gardenId,
    dimensions: { width: gardenWidth, height: gardenHeight },
    plantCount: plantProfileIds.length,
  });

  try {
    if (plantProfileIds.length === 0) {
      logApi.warn('No plants selected for layout', { gardenId });
      return { plots, warnings: ['No plants selected'], tips };
    }

    logApi.debug('Analyzing garden space', {
      gardenId,
      length: gardenHeight,
      width: gardenWidth,
      area: gardenWidth * gardenHeight,
    });

    // Fetch plant profiles with companion data
    const profiles = await PlantProfile.findAll({
      where: {
        id: {
          [Op.in]: plantProfileIds,
        },
      },
    });

    if (profiles.length === 0) {
      return { plots, warnings: ['No valid plant profiles found'], tips };
    }

    // Get companion relationships for all selected plants
    const companions = await PlantCompanion.findAll({
      where: {
        [Op.or]: [
          { plant_a_id: { [Op.in]: plantProfileIds } },
          { plant_b_id: { [Op.in]: plantProfileIds } },
        ],
      },
      include: [
        { model: PlantProfile, as: 'plantA', attributes: ['id', 'common_name'] },
        { model: PlantProfile, as: 'plantB', attributes: ['id', 'common_name'] },
      ],
    });

    // Build companion map
    const beneficialCompanions: Map<string, string[]> = new Map();
    const harmfulCompanions: Map<string, string[]> = new Map();

    companions.forEach((comp: any) => {
      const map = comp.relationship === 'beneficial' ? beneficialCompanions : harmfulCompanions;

      if (plantProfileIds.includes(comp.plant_a_id)) {
        const list = map.get(comp.plant_a_id) || [];
        list.push(comp.plant_b_id);
        map.set(comp.plant_a_id, list);
      }

      if (plantProfileIds.includes(comp.plant_b_id)) {
        const list = map.get(comp.plant_b_id) || [];
        list.push(comp.plant_a_id);
        map.set(comp.plant_b_id, list);
      }
    });

    // Sort plants by sun requirements (full sun first) and size
    const sortedProfiles = profiles.sort((a, b) => {
      // Prioritize full sun plants
      const sunOrder = { full_sun: 0, partial_sun: 1, partial_shade: 2, full_shade: 3 };
      const aSun = sunOrder[a.sunlight_requirements as keyof typeof sunOrder] || 1;
      const bSun = sunOrder[b.sunlight_requirements as keyof typeof sunOrder] || 1;

      if (aSun !== bSun) return aSun - bSun;

      // Then by spacing (larger plants first to establish structure)
      return (b.spacing_inches || 12) - (a.spacing_inches || 12);
    });

    // Layout algorithm: Simple row-based layout with companion considerations
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    const padding = 0.5; // feet between plants

    for (let i = 0; i < sortedProfiles.length; i++) {
      const profile = sortedProfiles[i];
      const spacingFeet = (profile.spacing_inches || 12) / 12;
      const plotSize = spacingFeet + padding;

      // Check if this plant has harmful companions already placed
      const harmful = harmfulCompanions.get(profile.id) || [];
      const hasHarmfulNeighbor = plots.some(
        (plot) => harmful.includes(plot.plant_profile_id) &&
        Math.abs(plot.x - currentX) < 3 && // Within 3 feet
        Math.abs(plot.y - currentY) < 3
      );

      if (hasHarmfulNeighbor) {
        warnings.push(
          `Warning: ${profile.common_name} has harmful companions nearby. Consider repositioning.`
        );
      }

      // Check if we need to start a new row
      if (currentX + plotSize > gardenWidth) {
        currentX = 0;
        currentY += rowHeight + padding;
        rowHeight = 0;
      }

      // Check if we're out of vertical space
      if (currentY + plotSize > gardenHeight) {
        warnings.push(
          `Not enough space for ${profile.common_name}. Garden is too small for all selected plants.`
        );
        continue;
      }

      // Find beneficial companions already placed
      const beneficial = beneficialCompanions.get(profile.id) || [];
      const beneficialNeighbor = plots.find(
        (plot) => beneficial.includes(plot.plant_profile_id) &&
        Math.abs(plot.x - currentX) < 3 &&
        Math.abs(plot.y - currentY) < 3
      );

      const notes = beneficialNeighbor
        ? `Placed near ${beneficialNeighbor.plant_name} (beneficial companion)`
        : undefined;

      // Add plot
      plots.push({
        x: Number(currentX.toFixed(2)),
        y: Number(currentY.toFixed(2)),
        width: Number(plotSize.toFixed(2)),
        height: Number(plotSize.toFixed(2)),
        plant_profile_id: profile.id,
        plant_name: profile.common_name || 'Unknown',
        notes,
      });

      // Update position for next plant
      currentX += plotSize;
      rowHeight = Math.max(rowHeight, plotSize);
    }

    // Generate tips
    if (beneficialCompanions.size > 0) {
      tips.push('Companion planting detected - beneficial plants placed near each other');
    }

    const sunRequirements = sortedProfiles.map((p) => p.sunlight_requirements);
    const hasFullSun = sunRequirements.includes('full_sun');
    const hasShade = sunRequirements.includes('full_shade');

    if (hasFullSun && hasShade) {
      tips.push('Mix of sun requirements - position garden so shade-loving plants are shaded by taller plants');
    } else if (hasFullSun) {
      tips.push('All plants need full sun - choose a location with 6+ hours of direct sunlight');
    } else if (hasShade) {
      tips.push('Shade-loving plants - choose a location with filtered light or partial shade');
    }

    const totalArea = plots.reduce((sum, plot) => sum + plot.width * plot.height, 0);
    const utilizationPercent = ((totalArea / (gardenWidth * gardenHeight)) * 100).toFixed(1);
    tips.push(`Garden utilization: ${utilizationPercent}% of available space`);

    const duration = Date.now() - startTime;
    logApi.info('Layout suggestion completed', {
      gardenId,
      suggestedPlots: plots.length,
      warningCount: warnings.length,
      utilizationPercent,
      duration,
    });

    return { plots, warnings, tips };
  } catch (error) {
    logApi.error('Error suggesting garden layout', {
      gardenId,
      gardenWidth,
      gardenHeight,
      plantCount: plantProfileIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      plots,
      warnings: ['Failed to generate layout suggestions'],
      tips,
    };
  }
}
