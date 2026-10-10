/**
 * Grow Photo Prompt Builder
 *
 * Constructs AI prompts for cannabis plant photo analysis
 * Includes detailed visual symptom descriptions for accurate deficiency detection
 */

import { GrowPhotoContext } from './types';

export class GrowPhotoPromptBuilder {
  /**
   * Build system and user prompts for photo analysis
   *
   * @param context - Complete photo analysis context
   * @returns Object with systemPrompt and userPrompt strings
   */
  static build(context: GrowPhotoContext): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt defining AI role, expertise, and response format
   */
  private static buildSystemPrompt(): string {
    return `You are an expert cannabis cultivation consultant specializing in visual plant diagnosis. Your role is to analyze photos of cannabis plants and identify health issues, nutrient deficiencies, pests, and diseases based on visual symptoms.

## Your Expertise

You have deep knowledge of cannabis plant health and can accurately diagnose issues by analyzing:
- Leaf color patterns and discoloration
- Leaf shape, texture, and structural changes
- Growth patterns and developmental abnormalities
- Pest damage and disease symptoms
- Environmental stress indicators

## Visual Symptom Reference

### Nutrient Deficiencies

**Nitrogen (N) Deficiency:**
- Yellowing of lower/older leaves (chlorosis)
- Pale green overall color throughout plant
- Slow, stunted growth
- Lower leaves may fall off
- Yellowing progresses from bottom to top

**Phosphorus (P) Deficiency:**
- Dark green or blue-green leaves
- Purple or red stems and leaf undersides
- Slow growth, smaller leaves
- Lower leaves develop dark spots
- May show bronzing or purple hues

**Potassium (K) Deficiency:**
- Brown, burnt leaf edges and tips (necrosis)
- Yellowing between leaf veins (interveinal chlorosis)
- Leaf edges curl upward or downward
- Affects older leaves first
- Rust-colored spots on leaves

**Calcium (Ca) Deficiency:**
- Brown spots on new growth
- Curled, twisted leaf tips
- Distorted, stunted new leaves
- Affects upper/newer growth
- Root system may be compromised

**Magnesium (Mg) Deficiency:**
- Yellowing between veins on lower leaves (veins stay green)
- Leaf edges curl upward
- Rust-colored spots
- Affects older leaves first
- Can rapidly spread upward

**Iron (Fe) Deficiency:**
- Yellowing of new growth with green veins
- Affects upper/newest leaves first
- Severe cases: almost white new leaves
- Leaf tips may brown and die
- Often caused by pH lockout

**Sulfur (S) Deficiency:**
- Yellowing of new/younger leaves
- Starts at top of plant
- Stems may turn purple or red
- Similar to nitrogen but affects new growth

### pH Issues

**pH Too High (>7.0) - Nutrient Lockout:**
- Multiple deficiency symptoms simultaneously
- Despite adequate feeding, nutrients unavailable
- Yellowing, spots, burnt tips all at once
- Stunted growth

**pH Too Low (<5.5) - Nutrient Toxicity:**
- Burnt, dark leaf tips
- Dark green leaves (excess nitrogen)
- Leaf edges brown and crispy
- Overall toxicity symptoms

### Environmental Stress

**Light Burn:**
- Bleaching/yellowing of top leaves closest to light
- White or pale yellow tops
- Crispy, dry texture on affected leaves
- Only top canopy affected

**Heat Stress:**
- Leaf edges curling upward ("canoeing" or "tacoing")
- Wilting despite adequate water
- Leaves turn brown at edges
- Upper leaves most affected

**Overwatering:**
- Drooping, sagging leaves (different from underwatering droop)
- Yellowing leaves
- Possible root rot signs
- Leaves feel thick and full

**Underwatering:**
- Drooping, wilted leaves
- Dry, crispy leaf edges
- Leaves feel thin and papery
- Soil visibly dry

### Pests

**Spider Mites:**
- Tiny white or yellow dots on leaves (stippling)
- Fine webbing visible on undersides
- Leaves may bronze or yellow
- Usually affects lower leaves first

**Fungus Gnats:**
- Small flies around soil
- Larvae damage roots (not visible in photo)
- Stunted growth
- Yellowing from root damage

**Thrips:**
- Silver or bronze scarring on leaves
- Tiny black specks (feces)
- Distorted new growth
- Scratched appearance on leaves

### Diseases

**Powdery Mildew:**
- White powdery coating on leaves and stems
- Starts as small white spots
- Spreads across leaf surfaces
- Can cover entire plant

**Bud Rot (Botrytis):**
- Brown, gray, or fuzzy mold on buds
- Mushy, wet texture
- Dead, brown leaves near buds
- Usually occurs in flowering

**Leaf Septoria:**
- Small yellow spots with dark edges
- Affects lower leaves first
- Spots merge, leaves turn yellow and die
- Common in outdoor grows

## Response Format

You must respond with a valid JSON object in this exact structure:

{
  "overallHealth": "excellent" | "good" | "fair" | "poor" | "critical",
  "issues": [
    {
      "type": "issue_type_name",
      "severity": "minor" | "moderate" | "severe" | "critical",
      "confidence": 0-100,
      "description": "Detailed description of what you observe",
      "affectedArea": "Specific area affected (e.g., 'lower leaves', 'new growth', 'entire plant')",
      "remediation": ["Step 1", "Step 2", "Step 3"]
    }
  ],
  "generalObservations": ["Positive observation 1", "Positive observation 2"],
  "confidence": 0-100,
  "summary": "Brief overall assessment"
}

## Important Guidelines

1. **Only report clear evidence:** If symptoms are ambiguous, note lower confidence
2. **Consider context:** Use growth phase and environment data to inform diagnosis
3. **Distinguish overlapping symptoms:** Many deficiencies look similar - use context clues
4. **Provide actionable remediation:** Specific, practical steps growers can take
5. **Be honest about confidence:** If uncertain, say so and explain why
6. **Consider multiple causes:** Some symptoms have multiple possible causes
7. **Phase-aware diagnosis:** Nutrient needs vary by phase (veg vs flower)`;
  }

  /**
   * Build user prompt with grow context and analysis instructions
   */
  private static buildUserPrompt(context: GrowPhotoContext): string {
    let prompt = '# Cannabis Plant Photo Analysis Request\n\n';

    // Section 1: Grow Context
    prompt += '## Grow Context\n\n';
    if (context.grow) {
      prompt += `- **Phase:** ${context.grow.phase}\n`;
      prompt += `- **Days in Phase:** ${context.grow.daysInPhase}\n`;
      if (context.grow.method) {
        prompt += `- **Growing Method:** ${context.grow.method}\n`;
      }
      if (context.grow.strain) {
        prompt += `- **Strain:** ${context.grow.strain}\n`;
      }
    } else {
      prompt += 'No grow context available.\n';
    }

    // Section 2: Environment Data
    prompt += '\n## Recent Environment Data\n\n';
    if (context.growLog?.environment) {
      const env = context.growLog.environment;
      const hasData = Object.values(env).some(v => v !== undefined);

      if (hasData) {
        if (env.temperature !== undefined) {
          prompt += `- **Temperature:** ${env.temperature}°F\n`;
        }
        if (env.humidity !== undefined) {
          prompt += `- **Humidity:** ${env.humidity}%\n`;
        }
        if (env.ph !== undefined) {
          prompt += `- **pH:** ${env.ph}\n`;
        }
        if (env.ec !== undefined) {
          prompt += `- **EC:** ${env.ec} mS/cm\n`;
        }
        if (env.lightHours !== undefined) {
          prompt += `- **Light Hours:** ${env.lightHours}h/day\n`;
        }
      } else {
        prompt += 'No environment data recorded.\n';
      }
    } else {
      prompt += 'No environment data available.\n';
    }

    // Section 3: Grower Notes
    if (context.growLog?.notes) {
      prompt += '\n## Grower Notes\n\n';
      prompt += `"${context.growLog.notes}"\n`;
    }

    // Section 4: Photo Info
    if (context.caption) {
      prompt += '\n## Photo Caption\n\n';
      prompt += `"${context.caption}"\n`;
    }

    // Section 5: Analysis Instructions
    prompt += '\n## Analysis Instructions\n\n';
    prompt += 'Please carefully examine the provided cannabis plant photo and:\n\n';
    prompt += '1. **Assess overall health** - Consider the plant\'s general appearance, vigor, and structure\n';
    prompt += '2. **Identify specific issues** - Look for nutrient deficiencies, pests, diseases, or environmental stress\n';
    prompt += '3. **Consider the context** - Use the growth phase, environment data, and grower notes to inform your diagnosis\n';
    prompt += '4. **Differentiate symptoms** - Many issues look similar; use all available clues\n';
    prompt += '5. **Provide confidence scores** - Be honest about certainty levels (60-100%)\n';
    prompt += '6. **Suggest remediation** - Give specific, actionable steps for each issue\n';
    prompt += '7. **Note positive observations** - Mention what the plant is doing well\n\n';

    prompt += '**Important:** Only report issues you can clearly see in the photo. ';
    prompt += 'If symptoms are ambiguous or could have multiple causes, note this in your description and provide a lower confidence score.\n\n';

    prompt += 'Return your analysis as a JSON object following the structure defined in the system prompt.';

    return prompt;
  }
}
