/**
 * Phase-specific prompt guidance for cannabis cultivation
 */

import { AnalysisType } from '../types';

/**
 * Phase-specific guidance for different grow stages
 */
export const PHASE_GUIDANCE = {
  germination: `
GERMINATION PHASE FOCUS:
- Humidity should be 70-80% for optimal germination
- Temperature should be 75-80°F
- No nutrients needed during germination
- Light schedule: 18/6 or 24/0 (gentle light, low intensity)
- Watch for damping off (fungal issues from excess moisture)
- Typical duration: 1-7 days`,

  vegetative: `
VEGETATIVE PHASE FOCUS:
- Humidity: 50-70% (lower as plants mature)
- Temperature: 70-85°F (lights on), 58-70°F (lights off)
- VPD target: 0.8-1.2 kPa
- Light schedule: 18/6 or 20/4 (some use 24/0)
- Nutrients: High nitrogen (3-1-2 NPK ratio typical)
- EC/PPM: 0.8-1.3 EC (400-650 PPM)
- pH: 6.0-6.5 (soil), 5.5-6.0 (hydro)
- Training opportunities: LST, topping, FIM, defoliation
- Typical duration: 4-8 weeks`,

  flowering: `
FLOWERING PHASE FOCUS:
- Humidity: 40-50% (lower to 30-40% in late flower to prevent mold)
- Temperature: 68-79°F (lights on), 58-70°F (lights off)
- VPD target: 1.0-1.5 kPa
- Light schedule: 12/12 CRITICAL (any light leaks can cause hermaphroditism)
- Nutrients: High phosphorus and potassium (1-3-2 NPK ratio typical)
- EC/PPM: 1.2-2.0 EC (600-1000 PPM)
- pH: 6.0-6.5 (soil), 5.5-6.0 (hydro)
- Monitor for bud rot in high humidity
- Flush 1-2 weeks before harvest (plain water to remove nutrients)
- Typical duration: 7-11 weeks (strain-dependent)`,

  harvest: `
HARVEST/CURING PHASE FOCUS:
- Harvest timing based on trichome color (clear = early, cloudy = peak THC, amber = more CBN/sedative)
- Flush completed 1-2 weeks prior
- Drying: 60°F, 60% RH for 7-14 days
- Curing: 62% RH in sealed jars, burp daily for first 2 weeks
- Monitor for mold during drying
- Trimming: wet trim vs dry trim preferences
- Quality assessment: cannabinoid testing, terpene preservation`,

  archived: `
ARCHIVED GROW:
- This grow is complete and archived
- Focus on harvest data and what was learned
- Compare results to goals
- Identify successes and areas for improvement in next grow`,
} as const;

/**
 * Get phase-specific guidance based on grow phase
 */
export function getPhaseGuidance(phase: string): string {
  return PHASE_GUIDANCE[phase as keyof typeof PHASE_GUIDANCE] || '';
}

/**
 * Get analysis type-specific phase considerations
 */
export function getPhaseAnalysisGuidance(
  phase: string,
  analysisType: AnalysisType
): string {
  const phaseKey = phase as keyof typeof PHASE_GUIDANCE;

  // Base guidance for the phase
  let guidance = PHASE_GUIDANCE[phaseKey] || '';

  // Add analysis type-specific considerations
  switch (analysisType) {
    case 'nutrients':
      if (phase === 'vegetative') {
        guidance += `\n\nNUTRIENT FOCUS (VEGETATIVE):
- Prioritize nitrogen for vigorous growth
- Common ratios: 3-1-2, 4-2-3, or similar high-N
- Watch for nitrogen deficiency (yellowing lower leaves)
- Cal-Mag often needed in hydro/coco systems`;
      } else if (phase === 'flowering') {
        guidance += `\n\nNUTRIENT FOCUS (FLOWERING):
- Reduce nitrogen, increase P/K for flower development
- Common ratios: 1-3-2, 1-4-3, or similar high-P/K
- Bloom boosters in mid-flower
- Reduce EC in final weeks before flush`;
      }
      break;

    case 'optimization':
      if (phase === 'vegetative') {
        guidance += `\n\nOPTIMIZATION FOCUS (VEGETATIVE):
- Training techniques maximize light exposure
- Top/FIM before week 4 for bushier structure
- LST throughout veg for even canopy
- Defoliation to improve air flow and light penetration
- Maximize vegetative growth rate for bigger yields`;
      } else if (phase === 'flowering') {
        guidance += `\n\nOPTIMIZATION FOCUS (FLOWERING):
- VPD optimization critical for transpiration
- Light intensity affects bud density
- Temperature differential (10-15°F day/night) can improve resin
- CO2 supplementation (1200-1500 PPM) in sealed rooms
- Strategic defoliation in early flower (lollipop technique)`;
      }
      break;

    case 'harvest_timing':
      if (phase === 'flowering') {
        guidance += `\n\nHARVEST TIMING (FLOWERING):
- Track flowering days from flip to 12/12
- Indica: typically 7-9 weeks
- Sativa: typically 10-14 weeks
- Hybrid: typically 8-11 weeks
- Start checking trichomes at day 45-50
- Flush when mostly cloudy trichomes, few amber`;
      }
      break;
  }

  return guidance;
}
