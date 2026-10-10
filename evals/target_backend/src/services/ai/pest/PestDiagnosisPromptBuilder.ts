/**
 * Pest Diagnosis Prompt Builder
 * Responsible for constructing AI prompts for pest and disease diagnosis
 */

import { AIPrompts } from '../core/types';
import { PestDiagnosisContext } from './types';

export class PestDiagnosisPromptBuilder {
  /**
   * Build comprehensive AI prompts for pest diagnosis analysis
   */
  static build(context: PestDiagnosisContext): AIPrompts {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt with AI role and response format
   */
  private static buildSystemPrompt(): string {
    return `You are GrowBuddy AI, an expert plant pathologist and pest management specialist.

Your role is to diagnose plant health issues based on symptoms and provide treatment recommendations:
- Identify likely pests, diseases, or environmental issues
- Assess severity and urgency of treatment
- Provide organic and chemical treatment options
- Include preventive measures for future protection
- Consider plant species, family, and common vulnerabilities

Respond with a JSON object in this exact format:
{
  "suggestions": [
    {
      "type": "improvement" | "warning" | "optimization",
      "category": "pest_treatment" | "disease_treatment" | "environmental_issue" | "prevention" | "monitoring",
      "title": "Brief diagnosis title",
      "description": "Detailed diagnosis with treatment steps and timeline",
      "affectedIds": ["plant-id"],
      "priority": "high" | "medium" | "low",
      "actionable": true | false
    }
  ],
  "overallScore": 75,
  "summary": "Brief 2-3 sentence diagnosis and treatment overview"
}

Guidelines:
- Provide clear identification of likely causes
- Be specific about treatment methods and products
- Include both immediate actions and preventive measures
- Consider safety (organic options first when possible)
- Give realistic expectations for recovery timeline`;
  }

  /**
   * Build detailed user prompt with all diagnosis context
   */
  private static buildUserPrompt(context: PestDiagnosisContext): string {
    const sections: string[] = [];

    sections.push(this.buildPlantOverviewSection(context));
    sections.push(this.buildSymptomsSection(context));
    sections.push(this.buildEnvironmentalSection(context));
    sections.push(this.buildRecentChangesSection(context));
    sections.push(this.buildAnalysisRequestSection());

    return sections.join('\n');
  }

  /**
   * Build plant overview section
   */
  private static buildPlantOverviewSection(context: PestDiagnosisContext): string {
    return `=== PLANT INFORMATION ===
Name: ${context.plant.name}
Species: ${context.plant.species || 'Not specified'}
Type: ${context.plant.type}
Plant Family: ${context.plant.plantFamily || 'Not specified'}
Difficulty: ${context.plant.difficulty}
Sunlight Requirements: ${context.plant.sunlightRequirements || 'Not specified'}
Zone Range: ${context.plant.zoneMin || '?'} - ${context.plant.zoneMax || '?'}`;
  }

  /**
   * Build symptoms section
   */
  private static buildSymptomsSection(context: PestDiagnosisContext): string {
    const affectedPartsText = context.symptoms.affectedParts.join(', ');

    return `\n=== REPORTED SYMPTOMS ===
Severity: ${context.symptoms.severity.toUpperCase()}
Affected Parts: ${affectedPartsText}
Description: ${context.symptoms.description}${context.symptoms.photoUrls && context.symptoms.photoUrls.length > 0 ? `\nPhotos Available: ${context.symptoms.photoUrls.length} photo(s) provided` : ''}`;
  }

  /**
   * Build environmental section
   */
  private static buildEnvironmentalSection(context: PestDiagnosisContext): string {
    return `\n=== ENVIRONMENTAL CONTEXT ===
Location: ${context.environmental.indoorOrOutdoor}
Current Season: ${context.environmental.currentSeason}
User's Zone: ${context.user.zone || 'Not specified'}${context.environmental.recentWeather ? `\nRecent Weather: ${context.environmental.recentWeather}` : ''}`;
  }

  /**
   * Build recent changes section
   */
  private static buildRecentChangesSection(context: PestDiagnosisContext): string {
    if (!context.recentChanges) {
      return '\n=== RECENT CHANGES ===\nNo recent changes reported.';
    }

    const changes: string[] = [];
    if (context.recentChanges.newLocation) {
      changes.push('- Plant recently moved to new location');
    }
    if (context.recentChanges.wateringChange) {
      changes.push('- Watering schedule recently changed');
    }
    if (context.recentChanges.fertilizingChange) {
      changes.push('- Fertilizing schedule recently changed');
    }
    if (context.recentChanges.otherChanges) {
      changes.push(`- Other: ${context.recentChanges.otherChanges}`);
    }

    if (changes.length === 0) {
      return '\n=== RECENT CHANGES ===\nNo recent changes reported.';
    }

    return `\n=== RECENT CHANGES ===\n${changes.join('\n')}`;
  }

  /**
   * Build analysis request section
   */
  private static buildAnalysisRequestSection(): string {
    return `\n=== DIAGNOSIS REQUEST ===
Please provide a comprehensive pest/disease diagnosis including:

1. IDENTIFICATION
   - Most likely pest, disease, or environmental issue causing these symptoms
   - Confidence level in diagnosis
   - Alternative possibilities if symptoms match multiple conditions

2. IMMEDIATE TREATMENT
   - Urgent actions needed within 24-48 hours
   - Organic treatment options (preferred)
   - Chemical treatment options if necessary
   - Specific products or methods to use

3. ONGOING CARE
   - Treatment schedule and duration
   - Monitoring instructions
   - Signs of improvement to watch for
   - When to reassess or escalate treatment

4. PREVENTION
   - How to prevent this issue in the future
   - Environmental modifications needed
   - Companion planting or beneficial insects
   - Regular maintenance practices

Focus on actionable, safe, and effective recommendations to restore plant health.`;
  }
}
