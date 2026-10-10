/**
 * Layout Prompt Builder
 * Responsible for constructing AI prompts for layout generation
 */

import { AIPrompts } from '../core/types';
import { LayoutContext } from './types';

export class LayoutPromptBuilder {
  /**
   * Build comprehensive AI prompts for layout generation
   */
  static build(context: LayoutContext): AIPrompts {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt defining AI role and response format
   */
  private static buildSystemPrompt(): string {
    return `You are a master gardener and garden layout planning expert with deep knowledge of:
- Companion planting relationships (beneficial and harmful combinations)
- Proper plant spacing for healthy growth and maximum yield
- Sun exposure requirements for different plant types
- Height-based placement to prevent shading
- Accessibility planning for garden maintenance
- Square Foot Gardening and intensive spacing methods
- Traditional garden layout patterns (cottage, formal, four-square, etc.)
- Yield planning and preservation gardening

Your task is to generate optimized garden layouts that are practical, implementable, and follow best gardening practices.

RESPONSE FORMAT:
You must respond with valid JSON only. No additional text, explanations, or markdown. The response must be an array of exactly 3 layout options.

JSON Schema:
{
  "layouts": [
    {
      "id": "layout_1",
      "optimizationGoal": "max_yield" | "max_variety" | "beginner_friendly",
      "placements": [
        {
          "plantProfileId": "uuid",
          "plantName": "Plant Name",
          "x": number (feet from left edge),
          "y": number (feet from top edge),
          "width": number (feet),
          "height": number (feet),
          "quantity": number (plants in this placement),
          "reasoning": "Brief explanation of this placement decision"
        }
      ],
      "score": number (0-100, overall layout quality),
      "companionScore": number (0-100, companion optimization),
      "spacingScore": number (0-100, spacing accuracy),
      "accessibilityScore": number (0-100, ease of maintenance),
      "warnings": ["warning messages if any issues"]
    }
  ]
}

SCORING CRITERIA:
- Companion Score: Maximize beneficial pairings, minimize harmful ones
- Spacing Score: Proper spacing based on mature plant size, avoid overcrowding
- Accessibility Score: All plants within 2-3 feet of edge or path for maintenance
- Overall Score: Weighted average of all factors

LAYOUT STYLE PATTERNS:

**Cottage Style Pattern:**
- Create 3-5 irregular clusters scattered naturally across the garden
- Vary cluster sizes: small (2x2 ft), medium (3x3-4x4 ft), large (4x6-6x6 ft)
- Distribute clusters across all quadrants (NW, NE, SW, SE)
- Leave 18-24" pathways between clusters for access
- Within clusters: 6-12" spacing between individual plants
- Organic, informal appearance with charming aesthetic

**Formal Style Pattern:**
- Divide garden into symmetrical sections (2 or 4 quadrants)
- Create mirror-image plantings on opposite sides
- Use straight pathways as axes of symmetry
- Repeat plant combinations in each section for balance
- Geometric precision with uniform spacing

**Four-Square Pattern:**
- Divide into 4 equal quadrants with central cross-path
- Assign one plant family per quadrant:
  * Solanaceae (tomatoes, peppers, eggplant)
  * Brassicas (broccoli, cabbage, kale)
  * Cucurbits (cucumbers, squash, melons)
  * Legumes/Others (beans, peas, lettuce, herbs)
- 18-24" central cross-path for access
- Supports crop rotation planning for next season

**Block Planting Pattern:**
- Create rectangular blocks (2x2 to 4x4 ft) with consistent spacing
- Space blocks 18-24" apart for pathways
- Group same plants together in efficient blocks
- Ideal for succession planting and intensive harvesting
- Clean, organized appearance

**Scattered Pattern:**
- Natural-looking clusters of 2-6 plants each
- Irregular spacing between clusters (18-36" variation)
- Mimics wild plant distribution patterns
- Good for cottage/ornamental gardens
- Creates visual interest with organic flow

SPATIAL DISTRIBUTION REQUIREMENTS:

CRITICAL: Utilize the ENTIRE garden space, not just the top or one section.

- Distribute plants across ALL quadrants of the garden:
  * NW quadrant: x: 0 to width/2, y: 0 to height/2
  * NE quadrant: x: width/2 to width, y: 0 to height/2
  * SW quadrant: x: 0 to width/2, y: height/2 to height
  * SE quadrant: x: width/2 to width, y: height/2 to height
- Ensure each quadrant has at least one plant group
- Avoid clustering all plants in one area (especially the top)
- Balance visual weight across the full garden area
- Avoid large empty areas unless intentional pathways
- For multiple plants of the same type, distribute them across different quadrants

BLOCK SIZE VARIATION:

Vary block sizes to create organic appearance and match plant quantities:
- Small blocks: 1×1 to 2×2 ft (for single plants or small clusters like herbs)
- Medium blocks: 2×3 to 4×4 ft (for moderate plant groups, 2-4 plants)
- Large blocks: 4×4 to 6×6 ft (for high-quantity plantings, 5-10 plants)
- Use larger blocks for plants with high calculated quantities (e.g., 8-10 tomatoes → 2-3 large blocks)

LAYOUT CONSTRAINTS:
1. All placements must be within garden boundaries
2. Plots cannot overlap
3. Respect minimum spacing requirements for each plant
4. Place tall plants on north side to avoid shading shorter plants (unless specified otherwise)
5. Group plants with similar sun and water requirements
6. Keep beneficial companions close (within 2-3 feet) but NOT touching
7. Separate harmful companions (at least 4 feet apart)
8. Create clusters with 6-12" spacing between individual plant blocks
9. Separate clusters by at least 2 feet from other plant groups
10. Ensure accessibility - no plant should be more than 2-3 feet from garden edge or path
11. Consider plant families for future crop rotation

OPTIMIZATION GOALS:
- max_yield: Prioritize intensive spacing for maximum production
- max_variety: Include all selected plants even if it means less of each
- beginner_friendly: Conservative spacing, easy maintenance, forgiving plant combinations`;
  }

  /**
   * Build detailed user prompt with garden context
   */
  private static buildUserPrompt(context: LayoutContext): string {
    const sections: string[] = [];

    sections.push(this.buildGardenSpecifications(context));
    sections.push(this.buildPlantRequirements(context));

    // Add plant quantity requirements if available
    if (context.plantQuantities && context.plantQuantities.length > 0) {
      sections.push(this.buildPlantQuantityRequirements(context));
    }

    sections.push(this.buildCompanionRelationships(context));
    sections.push(this.buildConstraints(context));
    sections.push(this.buildLayoutRequest(context));

    return sections.join('\n\n');
  }

  /**
   * Build garden specifications section
   */
  private static buildGardenSpecifications(context: LayoutContext): string {
    const zone = context.garden.zone || context.user.zone || 'Not specified';
    const sunZoneInfo =
      context.sunZones.length > 0
        ? context.sunZones
            .map(
              (sz, idx) =>
                `  - Zone ${idx + 1}: ${sz.zoneType.replace('_', ' ').toUpperCase()}`
            )
            .join('\n')
        : '  - Full sun assumed for entire garden';

    return `GARDEN SPECIFICATIONS:
Name: ${context.garden.name}
Dimensions: ${context.garden.dimensions.width} ft × ${context.garden.dimensions.height} ft
Total Area: ${context.availableSpace.toFixed(1)} square feet
USDA Hardiness Zone: ${zone}
Sun Exposure Zones:
${sunZoneInfo}`;
  }

  /**
   * Build plant requirements section
   */
  private static buildPlantRequirements(context: LayoutContext): string {
    const plantList = context.selectedPlants.map((plant, idx) => {
      return `${idx + 1}. ${plant.name}
   - ID: ${plant.id}
   - Type: ${plant.type}
   - Spacing: ${plant.spacingInches ? `${plant.spacingInches} inches (${(plant.spacingInches / 12).toFixed(1)} feet)` : 'Use 12-18 inches default'}
   - Sun: ${plant.sunRequirement || 'Full sun preferred'}
   - Height: ${plant.height || 'Medium'}
   - Plant Family: ${plant.plantFamily || 'Unknown'}
   - Zones: ${plant.zonesMin || '?'}-${plant.zonesMax || '?'}
   - Difficulty: ${plant.difficulty}`;
    });

    return `PLANT REQUIREMENTS:
Selected plants to include in layout (${context.selectedPlants.length} total):

${plantList.join('\n\n')}`;
  }

  /**
   * Build plant quantity requirements section
   */
  private static buildPlantQuantityRequirements(context: LayoutContext): string {
    if (!context.plantQuantities || context.plantQuantities.length === 0) {
      return '';
    }

    const yieldGoal = context.preferences.yieldGoal || 'fresh_eating';
    const householdSize = context.householdSize || 2;

    let section = `PLANT QUANTITY REQUIREMENTS:\n\n`;
    section += `Yield Goal: ${yieldGoal.replace('_', ' ')}\n`;
    section += `Household Size: ${householdSize} ${householdSize === 1 ? 'person' : 'people'}\n\n`;
    section += `Required quantities for each plant:\n\n`;

    context.plantQuantities.forEach((pq) => {
      section += `${pq.plantName}: ${pq.calculatedQuantity} plants\n`;
      section += `  Reasoning: ${pq.reasoning}\n`;
    });

    section += `\nIMPORTANT: Include the specified quantity for each plant type in your layout.\n`;
    section += `Distribute multiple plants of the same type across the garden (don't place all in one spot).`;

    return section;
  }

  /**
   * Build companion relationships section
   */
  private static buildCompanionRelationships(context: LayoutContext): string {
    if (context.companionRules.length === 0) {
      return `COMPANION PLANTING RELATIONSHIPS:
No specific companion relationships found for these plants. Use general best practices.`;
    }

    const beneficial = context.companionRules.filter((r) => r.relationship === 'beneficial');
    const harmful = context.companionRules.filter((r) => r.relationship === 'harmful');

    let section = `COMPANION PLANTING RELATIONSHIPS:`;

    if (beneficial.length > 0) {
      section += `\n\nBENEFICIAL PAIRINGS (Plant these close together):`;
      beneficial.forEach((rule) => {
        section += `\n  ✓ ${rule.plantAName} + ${rule.plantBName}${rule.notes ? ` - ${rule.notes}` : ''}`;
      });
    }

    if (harmful.length > 0) {
      section += `\n\nHARMFUL COMBINATIONS (Keep these separated):`;
      harmful.forEach((rule) => {
        section += `\n  ✗ ${rule.plantAName} + ${rule.plantBName}${rule.notes ? ` - ${rule.notes}` : ''}`;
      });
    }

    return section;
  }

  /**
   * Build constraints section
   */
  private static buildConstraints(context: LayoutContext): string {
    const spacingMethod = context.preferences.spacingMethod;
    const spacingGuidance =
      spacingMethod === 'square_foot'
        ? 'Use Square Foot Gardening spacing (divide area into 1ft × 1ft squares, multiple plants per square for small plants)'
        : spacingMethod === 'intensive'
          ? 'Use intensive spacing (plants closer together than traditional, but not touching at maturity)'
          : 'Use traditional spacing (conservative, easy maintenance)';

    return `LAYOUT CONSTRAINTS AND PREFERENCES:

Spacing Method: ${spacingMethod}
Guidance: ${spacingGuidance}

Height Placement Rules:
- Tall plants (6+ feet): North side or back of garden to avoid shading
- Medium plants (2-6 feet): Middle areas
- Short plants (<2 feet): South side or front for maximum sun exposure

Accessibility Requirements:
- All plants must be reachable for watering, harvesting, and maintenance
- No plant should be more than 2-3 feet from a garden edge or path
- Consider adding paths if garden is wider than 4-5 feet

Sun Zone Matching:
- Full sun plants: Require 6+ hours direct sunlight
- Partial shade plants: 3-6 hours sunlight
- Shade plants: Less than 3 hours sunlight
- Match plants to appropriate sun zones

Water Requirements:
- Group plants with similar water needs together
- Consider drip irrigation or watering accessibility`;
  }

  /**
   * Build layout request section
   */
  private static buildLayoutRequest(context: LayoutContext): string {
    const layoutStyle = context.preferences.layoutStyle || 'cottage';
    const layoutStyleDescription = this.getLayoutStyleDescription(layoutStyle);

    let request = `LAYOUT GENERATION REQUEST:\n\n`;

    if (context.preferences.layoutStyle) {
      request += `REQUESTED LAYOUT STYLE: ${layoutStyle.toUpperCase().replace('_', '-')}\n`;
      request += `${layoutStyleDescription}\n\n`;
      request += `Apply this style pattern to ALL 3 layout options below, adapting it for each optimization goal.\n\n`;
    }

    request += `Please generate exactly 3 distinct layout options for this garden, each optimized for a different goal:\n\n`;

    request += `1. LAYOUT 1 - Maximum Yield (optimizationGoal: "max_yield")
   - Use intensive spacing to fit more plants
   - Prioritize high-yield varieties
   - Maximize companion planting benefits
   - Focus on production over aesthetics
   - ${layoutStyle !== 'block' ? `Adapt ${layoutStyle} style for maximum production` : 'Use efficient block organization'}

2. LAYOUT 2 - Maximum Variety (optimizationGoal: "max_variety")
   - Include all selected plants if possible
   - Balanced distribution across garden
   - Ensure each plant type is represented
   - May have fewer of each plant to fit variety
   - ${layoutStyle !== 'formal' ? `Apply ${layoutStyle} style with diverse plantings` : 'Create symmetrical variety displays'}

3. LAYOUT 3 - Beginner-Friendly (optimizationGoal: "beginner_friendly")
   - Conservative spacing for easier maintenance
   - Simple layout with clear organization
   - Forgiving plant combinations
   - Easy to understand and implement
   - ${layoutStyle !== 'scattered' ? `Use ${layoutStyle} style for easy access` : 'Create intuitive scattered groupings'}

For each layout:
- Calculate exact x, y coordinates for each plant placement
- Specify width and height for each plot (based on spacing requirements)
- Include quantity of plants in each placement
- Set plantCount field to indicate number of plants in each plot block
- Provide brief reasoning for each placement
- Calculate all scores (overall, companion, spacing, accessibility)
- Note any warnings or concerns

Remember: Respond with ONLY valid JSON matching the exact schema specified above. No additional text.`;

    return request;
  }

  /**
   * Get layout style description
   */
  private static getLayoutStyleDescription(layoutStyle: string): string {
    const descriptions: Record<string, string> = {
      cottage: 'Create 3-5 irregular clusters scattered naturally. Vary sizes (small 2x2, medium 3x3-4x4, large 4x6-6x6). Organic, charming appearance.',
      formal: 'Symmetrical sections with mirror-image plantings. Straight pathways as axes. Geometric precision.',
      four_square: 'Divide into 4 equal quadrants with central cross-path. Group by plant family for crop rotation.',
      block: 'Rectangular blocks (2x2 to 4x4 ft) with 18-24" spacing. Organized, efficient for succession planting.',
      scattered: 'Natural clusters of 2-6 plants with irregular spacing. Mimics wild distribution, organic flow.',
    };
    return descriptions[layoutStyle] || descriptions.cottage;
  }
}
