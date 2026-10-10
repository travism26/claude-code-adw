/**
 * Grow Nutrient Recommendation Prompt Builder
 *
 * Responsible for constructing AI prompts for nutrient recommendations.
 * Includes cannabis-specific NPK guidance, pH/EC targets, and deficiency knowledge.
 */

import { AIPrompts } from '../../core/types';
import { GrowContext } from '../types';
import { RecommendationType, OptimizationGoal } from './types';

/**
 * JSON response format for nutrient recommendations
 */
const NUTRIENT_RECOMMENDATION_FORMAT = `{
  "summary": "2-3 sentence overview of the nutrient recommendation strategy",
  "schedule": [
    {
      "phase": "vegetative" | "flowering" | "harvest",
      "weekNumber": 1,
      "weekLabel": "Veg Week 1",
      "nutrients": [
        {
          "productName": "Product name",
          "brand": "Brand name (optional)",
          "npkRatio": "3-1-2 (optional)",
          "type": "base" | "supplement" | "additive" | "other",
          "dosageMlPerGallon": 5.0,
          "frequency": "Every watering" | "Weekly" | "2x per week",
          "notes": "Product-specific notes (optional)"
        }
      ],
      "waterParameters": {
        "phMin": 5.5,
        "phMax": 6.5,
        "ecMin": 0.8,
        "ecMax": 1.2,
        "ppmMin": 400,
        "ppmMax": 600
      },
      "notes": "Week-specific guidance (optional)"
    }
  ],
  "additionalTips": [
    "General cultivation tip 1",
    "General cultivation tip 2"
  ],
  "warnings": [
    "Warning about nutrient lockout risk",
    "Warning about pH drift"
  ],
  "totalWeeks": 12
}`;

/**
 * Cannabis-specific NPK knowledge by phase
 */
const CANNABIS_NPK_KNOWLEDGE = `
Cannabis NPK Requirements by Phase:

**Germination (Week 0-1)**:
- Minimal to no nutrients required
- Focus on clean water pH 6.0-6.5
- If feeding: Very light (0.2-0.4 EC, 100-200 PPM)

**Seedling/Early Veg (Week 1-2)**:
- Light nutrients: 0.4-0.8 EC (200-400 PPM)
- NPK ratio: 3-1-2 (higher nitrogen for leaf development)
- Examples: 5-3-3, 6-2-4, 4-2-3

**Vegetative (Week 3-8)**:
- Moderate to high nitrogen for leaf and stem growth
- NPK ratio: 3-1-2 to 3-1-3
- EC: 0.8-1.4 mS/cm (400-700 PPM)
- Examples: 8-4-6, 7-3-6, 6-3-4
- Supplements: Cal-Mag (especially for coco/hydro), silica for stem strength

**Pre-Flower/Transition (Week 1-2 of flower)**:
- Transition NPK: 1-1-1 to 1-2-2 (balanced, increasing P)
- Begin reducing nitrogen gradually
- EC: 1.2-1.6 mS/cm (600-800 PPM)
- Examples: 5-5-5, 4-6-6

**Early to Mid Flowering (Week 3-5)**:
- High phosphorus and potassium for bud development
- NPK ratio: 1-3-2 to 1-3-3
- EC: 1.4-1.8 mS/cm (700-900 PPM)
- Examples: 2-8-6, 1-8-7, 3-10-10
- Supplements: Bloom boosters, PK boosters (0-13-14), molasses/carbs

**Late Flowering (Week 6-8)**:
- Maximum P/K, minimal nitrogen
- NPK ratio: 0-3-3 to 1-3-3
- EC: 1.6-2.0 mS/cm (800-1000 PPM)
- Examples: 0-10-10, 1-7-6, 2-8-8
- Continue bloom boosters

**Pre-Harvest/Flush (Final 1-2 weeks)**:
- Plain water or very light nutrients
- EC: 0.0-0.4 mS/cm (0-200 PPM)
- Goal: Remove excess salts from medium and plant tissue
- Improves taste and smoothness`;

/**
 * pH and EC targets by grow method
 */
const PH_EC_KNOWLEDGE = `
pH and EC Targets by Grow Method:

**Soil**:
- pH: 6.0-7.0 (optimal: 6.3-6.8)
- EC: Lower dosages (0.8-1.4 veg, 1.2-1.8 flower)
- Soil buffers nutrients, less precision needed
- Feed-water-water pattern common (feed every 2-3rd watering)

**Coco Coir**:
- pH: 5.5-6.5 (optimal: 5.8-6.2)
- EC: Medium dosages (1.0-1.6 veg, 1.4-2.0 flower)
- Requires Cal-Mag supplementation (coco binds calcium)
- Frequent feeding (daily) with 10-20% runoff

**Hydro/DWC**:
- pH: 5.5-6.5 (optimal: 5.8-6.0, allow drift 5.5-6.2)
- EC: Higher dosages (1.2-1.8 veg, 1.6-2.2 flower)
- Check pH daily, adjust with pH up/down
- Change reservoir weekly
- Monitor root health (white = healthy, brown = root rot)

**General pH Drift**:
- pH naturally drifts as plants feed
- Allow natural drift within range for better nutrient uptake
- Different nutrients absorb better at different pH levels`;

/**
 * Nutrient deficiency symptom mapping
 */
const DEFICIENCY_KNOWLEDGE = `
Cannabis Nutrient Deficiency Symptoms:

**Macronutrients**:

*Nitrogen (N) Deficiency*:
- Yellowing of lower, older leaves (chlorosis)
- Pale green overall appearance
- Slow growth, small leaves
- Fix: Increase N (veg nutrients, blood meal, fish emulsion)
- Common in flowering when N is reduced too early

*Phosphorus (P) Deficiency*:
- Dark green or purple leaves
- Purple/red stems and petioles
- Slow growth, delayed flowering
- Leaf tips may curl down
- Fix: Increase P (bloom nutrients, bone meal, bat guano)

*Potassium (K) Deficiency*:
- Brown, crispy edges on leaves (necrosis)
- Yellowing between veins
- Weak stems, easily broken
- Affects older leaves first
- Fix: Increase K (bloom nutrients, kelp meal, potassium sulfate)

**Secondary Nutrients**:

*Calcium (Ca) Deficiency*:
- Brown spots on new growth
- Twisted or deformed new leaves
- Blossom end rot (rare in cannabis)
- Common in coco coir without Cal-Mag
- Fix: Add Cal-Mag supplement (2-5 ml/gal)

*Magnesium (Mg) Deficiency*:
- Interveinal yellowing (veins stay green, tissue yellows)
- Affects lower, older leaves first
- Leaf curling upward
- Fix: Epsom salt (1 tsp/gal water) or Cal-Mag

*Sulfur (S) Deficiency*:
- Yellowing of new growth (unlike N which affects old growth)
- Slow growth
- Fix: Gypsum, Epsom salt, or complete nutrient

**Micronutrients**:

*Iron (Fe) Deficiency*:
- Yellowing of new growth, veins may stay green
- Caused by pH lockout (pH too high)
- Fix: Correct pH first, then add iron chelate if needed

*Zinc (Zn) Deficiency*:
- Twisted, distorted new growth
- Short internodes (stunted)
- Fix: Micronutrient supplement, correct pH

*Manganese (Mn) Deficiency*:
- Interveinal chlorosis on new growth
- Brown spots may develop
- Fix: Micronutrient supplement, lower pH slightly

**Nutrient Lockout**:
- When pH is outside optimal range, plants cannot absorb nutrients
- Symptoms can mimic deficiencies
- ALWAYS check and correct pH before adding more nutrients
- Overfeeding can also cause lockout (flush with pH'd water)`;

/**
 * Build system prompt based on recommendation type
 */
function buildSystemPrompt(
  type: RecommendationType,
  context: GrowContext
): string {
  const growMethod = context.grow.growMethod || 'soil';
  const phase = context.grow.phase;

  let roleDescription: string;
  let focusAreas: string;

  switch (type) {
    case 'full_schedule':
      roleDescription = `You are GrowBuddy AI, an expert cannabis nutrient consultant specializing in comprehensive feeding schedules.

Your role is to create a complete week-by-week nutrient schedule from the current phase through harvest, tailored to the grower's specific setup.`;

      focusAreas = `Focus on:
- Creating a complete schedule from current ${phase} phase through harvest
- Matching NPK ratios to each growth phase (high N in veg, high P/K in flower)
- Specifying exact dosages (ml/gallon) for each product
- Setting appropriate pH and EC targets for ${growMethod} growing
- Including phase transition strategies (veg to flower transition weeks)
- Recommending supplements (Cal-Mag for coco/hydro, bloom boosters, carbs)
- Planning the pre-harvest flush (final 1-2 weeks)
- Providing weekly guidance and warnings`;
      break;

    case 'phase_adjustment':
      roleDescription = `You are GrowBuddy AI, an expert cannabis nutrient consultant specializing in phase transitions.

Your role is to adjust existing nutrient schedules for optimal phase transitions (vegetative to flowering, or within flowering stages).`;

      focusAreas = `Focus on:
- Analyzing current nutrient schedule and phase requirements
- Adjusting NPK ratios for the new phase (reduce N, increase P/K for flower)
- Modifying dosages and EC/PPM targets appropriately
- Timing the transition (gradual vs immediate changes)
- Adding or removing supplements as needed for the phase
- Preventing stress during the transition period`;
      break;

    case 'deficiency_fix':
      roleDescription = `You are GrowBuddy AI, an expert cannabis problem diagnostician specializing in nutrient deficiencies.

Your role is to identify the specific deficiency from symptoms and create a rapid remediation plan.`;

      focusAreas = `Focus on:
- Confirming the deficiency type based on symptoms described
- Ruling out pH lockout as the root cause (MOST COMMON ISSUE)
- Creating a rapid fix schedule (immediate and follow-up treatments)
- Specifying exact products and dosages for the deficiency
- Preventing over-correction (more isn't always better)
- Monitoring guidelines (how to know if it's working)
- Long-term prevention strategies`;
      break;

    case 'optimization':
      roleDescription = `You are GrowBuddy AI, an expert cannabis nutrient consultant specializing in yield and quality optimization.

Your role is to optimize existing nutrient schedules based on specific goals (yield, quality, or balanced).`;

      focusAreas = `Focus on:
- Analyzing current schedule for optimization opportunities
- Adjusting for the grower's goal (yield = aggressive feeding, quality = balanced approach)
- Fine-tuning EC/PPM levels for optimal results
- Recommending advanced supplements and techniques
- Balancing growth speed vs plant stress
- Optimizing for terpene and cannabinoid production (if quality focus)
- Maximizing bud density and weight (if yield focus)`;
      break;
  }

  return `${roleDescription}

${focusAreas}

${CANNABIS_NPK_KNOWLEDGE}

${PH_EC_KNOWLEDGE}

${DEFICIENCY_KNOWLEDGE}

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any text before or after the JSON.
Do not include markdown code blocks, explanations, or commentary.
Output ONLY the raw JSON object in this exact format:

${NUTRIENT_RECOMMENDATION_FORMAT}

Additional Guidelines:
- Be specific with product names, dosages, and frequencies
- Consider the grower's current setup (${growMethod}, ${phase} phase)
- Reference actual data from their logs when relevant
- Provide actionable week-by-week guidance
- Include warnings about common mistakes (overfeeding, pH lockout, etc.)
- Keep summary concise and encouraging`;
}

/**
 * Build user prompt with grow context
 */
function buildUserPrompt(
  context: GrowContext,
  type: RecommendationType,
  options?: { goal?: OptimizationGoal; deficiency?: string }
): string {
  const sections: string[] = [];

  // Grow Overview
  sections.push(`=== GROW OVERVIEW ===
Strain: ${context.grow.strainName} (${context.grow.strainType || 'type not specified'})
Current Phase: ${context.grow.phase} (${context.metrics.daysInPhase} days in phase)
Total Days: ${context.metrics.daysSinceStart} days since start
Grow Method: ${context.grow.growMethod || 'not specified'}
Grow Medium: ${context.grow.growMedium || 'not specified'}
Light Type: ${context.grow.lightType || 'not specified'}${context.grow.lightWattage ? ` (${context.grow.lightWattage}W)` : ''}
Container Size: ${context.grow.potSizeGallons ? `${context.grow.potSizeGallons} gallons` : 'not specified'}
Plant Count: ${context.grow.plantCount}
Started: ${context.grow.startedAt.toISOString().split('T')[0]}`);

  // Current Nutrients
  if (context.nutrients.length > 0) {
    const nutrientList = context.nutrients
      .map(
        (n) =>
          `- ${n.productName}${n.brand ? ` (${n.brand})` : ''}${n.npkRatio ? ` [NPK: ${n.npkRatio}]` : ''}\n  Type: ${n.type || 'not specified'}\n  Dosage: ${n.dosageMl ? `${n.dosageMl} ml` : 'not specified'}${n.frequency ? ` | Frequency: ${n.frequency}` : ''}${n.phaseUsed ? ` | Phase: ${n.phaseUsed}` : ''}`
      )
      .join('\n');

    sections.push(`=== CURRENT NUTRIENT SCHEDULE ===
${nutrientList}`);
  } else {
    sections.push(`=== CURRENT NUTRIENT SCHEDULE ===
No nutrients currently configured.`);
  }

  // Environmental Trends
  const env = context.environment;
  if (env.hasTrends) {
    const trends: string[] = [];

    if (env.ph.average !== null) {
      trends.push(
        `pH: ${env.ph.average.toFixed(1)} (range: ${env.ph.min?.toFixed(1) || 'N/A'} - ${env.ph.max?.toFixed(1) || 'N/A'})`
      );
    }

    if (env.ec.average !== null) {
      trends.push(
        `EC: ${env.ec.average.toFixed(2)} mS/cm (range: ${env.ec.min?.toFixed(2) || 'N/A'} - ${env.ec.max?.toFixed(2) || 'N/A'})`
      );
    }

    if (env.ppm.average !== null) {
      trends.push(
        `PPM: ${env.ppm.average.toFixed(0)} (range: ${env.ppm.min?.toFixed(0) || 'N/A'} - ${env.ppm.max?.toFixed(0) || 'N/A'})`
      );
    }

    if (env.temperature.average !== null) {
      trends.push(
        `Temperature: ${env.temperature.average.toFixed(1)}°F (range: ${env.temperature.min?.toFixed(1) || 'N/A'} - ${env.temperature.max?.toFixed(1) || 'N/A'})`
      );
    }

    if (env.humidity.average !== null) {
      trends.push(
        `Humidity: ${env.humidity.average.toFixed(1)}% (range: ${env.humidity.min?.toFixed(1) || 'N/A'} - ${env.humidity.max?.toFixed(1) || 'N/A'})`
      );
    }

    if (env.vpd.average !== null) {
      trends.push(
        `VPD: ${env.vpd.average.toFixed(2)} kPa (range: ${env.vpd.min?.toFixed(2) || 'N/A'} - ${env.vpd.max?.toFixed(2) || 'N/A'})`
      );
    }

    sections.push(`=== ENVIRONMENTAL CONDITIONS ===
${trends.length > 0 ? trends.join('\n') : 'No environmental data recorded.'}`);
  } else {
    sections.push(`=== ENVIRONMENTAL CONDITIONS ===
No environmental data recorded.`);
  }

  // Recent Log Notes (for deficiency detection)
  if (context.logs.length > 0) {
    const logsWithNotes = context.logs
      .slice(0, 10)
      .filter((log) => log.notes)
      .map(
        (log) =>
          `Day ${log.dayNumber || 'N/A'} (${log.loggedAt.toISOString().split('T')[0]}): ${log.notes}`
      );

    if (logsWithNotes.length > 0) {
      sections.push(`=== RECENT LOG NOTES ===
${logsWithNotes.join('\n')}`);
    }
  }

  // Request Type
  let requestSection = '=== NUTRIENT RECOMMENDATION REQUEST ===\n';

  switch (type) {
    case 'full_schedule':
      requestSection += `Generate a complete week-by-week feeding schedule from the current ${context.grow.phase} phase through harvest and flush.

Requirements:
- Start from current phase and week
- Include all phases through harvest
- Specify exact products, dosages (ml/gallon), and frequencies
- Set appropriate pH and EC/PPM ranges for each week
- Include supplements appropriate for ${context.grow.growMethod || 'the grow method'}
- Plan the pre-harvest flush (final 1-2 weeks)
- Provide weekly notes and warnings`;
      break;

    case 'phase_adjustment':
      requestSection += `Adjust the existing nutrient schedule for the current phase transition.

Requirements:
- Review current nutrients and adjust NPK ratios for ${context.grow.phase} phase
- Modify dosages and EC/PPM targets appropriately
- Time the transition properly (gradual over 1-2 weeks)
- Add or remove supplements as needed
- Prevent stress during transition`;
      break;

    case 'deficiency_fix':
      requestSection += `Create a remediation plan for the following deficiency:\n${options?.deficiency || 'Deficiency symptoms described in log notes above'}

Requirements:
- Confirm the deficiency type from symptoms
- Check for pH lockout (root cause check)
- Provide immediate fix (product and dosage)
- Create follow-up treatment schedule
- Include monitoring guidelines
- Provide long-term prevention strategies`;
      break;

    case 'optimization':
      requestSection += `Optimize the existing nutrient schedule for: ${options?.goal || 'balanced'} results

Goal: ${options?.goal === 'yield' ? 'Maximum yield (aggressive feeding, dense buds)' : options?.goal === 'quality' ? 'Maximum quality (terpenes, cannabinoids, smoothness)' : 'Balanced (good yield with quality)'}

Requirements:
- Analyze current schedule for optimization opportunities
- Adjust EC/PPM levels for the goal
- Recommend advanced supplements
- Balance growth speed vs plant stress
- Fine-tune for the selected goal`;
      break;
  }

  sections.push(requestSection);

  return sections.join('\n\n');
}

/**
 * Main prompt builder class
 */
export class GrowNutrientPromptBuilder {
  /**
   * Build comprehensive AI prompts for nutrient recommendations
   */
  static build(
    context: GrowContext,
    type: RecommendationType = 'full_schedule',
    options?: { goal?: OptimizationGoal; deficiency?: string }
  ): AIPrompts {
    const systemPrompt = buildSystemPrompt(type, context);
    const userPrompt = buildUserPrompt(context, type, options);

    return { systemPrompt, userPrompt };
  }
}
