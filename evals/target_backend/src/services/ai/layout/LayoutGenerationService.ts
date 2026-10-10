/**
 * Layout Generation Service
 *
 * Main service for generating optimized garden layouts using AI.
 * Follows the same pattern as GardenAnalysisService.
 *
 * Usage Example:
 * ```typescript
 * const service = new LayoutGenerationService();
 * const result = await service.execute({
 *   gardenId: 'uuid',
 *   userId: 'uuid',
 *   plantProfileIds: ['uuid1', 'uuid2'],
 *   sunZones: [],
 *   preferences: { optimizationGoal: 'max_yield', spacingMethod: 'intensive' }
 * });
 * ```
 */

import { BaseAIService, PromptLogger } from '../core';
import { LayoutContextBuilder } from './LayoutContextBuilder';
import { LayoutPromptBuilder } from './LayoutPromptBuilder';
import {
  LayoutGenerationResponse,
  LayoutGenerationPayload,
  LayoutContext,
  LayoutOption,
} from './types';
import { logAI } from '../../logging/logger';

/**
 * Feature flag - Controlled via ENABLE_AI environment variable
 * Set ENABLE_AI=true in .env to enable AI API calls
 */
const ENABLE_AI_CALLS = process.env.ENABLE_AI === 'true';

export class LayoutGenerationService extends BaseAIService {
  private contextBuilder: LayoutContextBuilder;

  constructor() {
    super({
      enableAICalls: ENABLE_AI_CALLS,
      logPrompts: true,
    });
    this.contextBuilder = new LayoutContextBuilder();
  }

  /**
   * Execute layout generation
   *
   * This is the main entry point called by the worker.
   * Generates 3 layout options optimized for different goals.
   *
   * @param payload - Layout generation payload
   * @returns Layout generation response with 3 layout options
   */
  async execute(payload: LayoutGenerationPayload): Promise<LayoutGenerationResponse> {
    const { gardenId, userId } = payload;

    try {
      // Step 1: Build comprehensive context
      const context = await this.contextBuilder.build(payload);

      // Step 2: Build AI prompts
      const prompts = LayoutPromptBuilder.build(context);

      // Step 3: Log prompts for testing/review
      if (this.config.logPrompts) {
        PromptLogger.log(prompts, context, 'LAYOUT GENERATION');
      }

      // Step 4: Get AI layouts or mock response
      let layouts: LayoutOption[];

      if (this.config.enableAICalls) {
        // Layout generation needs more tokens than typical responses
        // 3 layouts × ~20 placements each × ~100 tokens per placement = ~6000 tokens needed
        const aiResult = await this.callAIWithCustomTokens(
          prompts.systemPrompt,
          prompts.userPrompt,
          userId,
          8192 // Higher limit for complex layout generation
        );

        logAI.debug('AI response received', {
          gardenId,
          userId,
          responseLength: JSON.stringify(aiResult).length,
          responseType: typeof aiResult,
          responseKeys: aiResult ? Object.keys(aiResult) : [],
        });

        // Parse layouts from AI response
        layouts = this.parseLayoutsFromAI(aiResult);

        logAI.debug('Layouts extracted', {
          gardenId,
          layoutCount: layouts.length,
        });
      } else {
        const mockResponse = this.createMockResponse(context);
        layouts = mockResponse.layouts;

        PromptLogger.logAIDisabled();

        if (this.config.logPrompts) {
          PromptLogger.logMockResponse({
            suggestions: [],
            overallScore: this.calculateAverageScore(layouts),
            summary: `Generated ${layouts.length} mock layouts`,
          });
        }
      }

      // Validate layouts
      this.validateLayouts(layouts, context);

      // Validate spatial distribution
      layouts.forEach((layout) => {
        this.validateSpatialDistribution(layout, context);
      });

      return {
        gardenId,
        analyzedAt: new Date(),
        context,
        suggestions: [], // No suggestions for layout generation
        overallScore: this.calculateAverageScore(layouts),
        summary: this.generateSummary(layouts, context),
        layouts,
      };
    } catch (error) {
      logAI.error('Layout generation failed', {
        gardenId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Parse layouts from AI response
   */
  private parseLayoutsFromAI(aiResult: any): LayoutOption[] {
    if (!aiResult) {
      throw new Error('No AI result received');
    }

    // Check if we got a parse error fallback structure
    if (aiResult.parseError) {
      const errorMsg = `AI response parsing failed. This usually indicates a truncated response or invalid JSON. Raw content preview: ${aiResult.rawContent?.substring(0, 200) || 'N/A'}`;
      logAI.error('AI response parse error detected', {
        service: 'LayoutGenerationService',
        rawContentLength: aiResult.rawContent?.length || 0,
        rawContentPreview: aiResult.rawContent?.substring(0, 500),
      });
      throw new Error(errorMsg);
    }

    // AI response should have a "layouts" array
    const layouts = aiResult.layouts || [];

    if (!Array.isArray(layouts) || layouts.length === 0) {
      const debugInfo = {
        hasLayouts: 'layouts' in aiResult,
        layoutsType: typeof aiResult.layouts,
        layoutsValue: aiResult.layouts,
        allKeys: Object.keys(aiResult),
        responsePreview: JSON.stringify(aiResult).substring(0, 500),
      };

      logAI.error('Invalid AI response structure', {
        service: 'LayoutGenerationService',
        ...debugInfo,
      });

      throw new Error(
        `Invalid AI response: expected layouts array but got ${debugInfo.layoutsType}. ` +
          `Response keys: ${debugInfo.allKeys.join(', ')}. ` +
          `This may indicate the AI response was truncated or malformed.`
      );
    }

    return layouts.map((layout: any, index: number) => ({
      id: layout.id || `layout_${index + 1}`,
      optimizationGoal: layout.optimizationGoal || 'max_yield',
      placements: layout.placements || [],
      score: layout.score || 0,
      companionScore: layout.companionScore || 0,
      spacingScore: layout.spacingScore || 0,
      accessibilityScore: layout.accessibilityScore || 0,
      warnings: layout.warnings || [],
    }));
  }

  /**
   * Validate layouts to ensure they meet constraints
   */
  private validateLayouts(layouts: LayoutOption[], context: LayoutContext): void {
    const { garden } = context;

    layouts.forEach((layout, index) => {
      layout.placements.forEach((placement) => {
        // Check if placement is within garden boundaries
        if (placement.x < 0 || placement.y < 0) {
          layout.warnings.push(
            `${placement.plantName}: placement starts outside garden (${placement.x}, ${placement.y})`
          );
        }

        if (
          placement.x + placement.width > garden.dimensions.width ||
          placement.y + placement.height > garden.dimensions.height
        ) {
          layout.warnings.push(
            `${placement.plantName}: placement extends beyond garden boundaries`
          );
        }
      });

      logAI.debug(`Layout ${index + 1} validation complete`, {
        layoutId: layout.id,
        placementCount: layout.placements.length,
        warningCount: layout.warnings.length,
      });
    });
  }

  /**
   * Validate spatial distribution across garden quadrants
   */
  private validateSpatialDistribution(layout: LayoutOption, context: LayoutContext): void {
    const { garden } = context;
    const width = garden.dimensions.width;
    const height = garden.dimensions.height;

    // Define quadrant boundaries
    const midX = width / 2;
    const midY = height / 2;

    // Count placements per quadrant
    const quadrantCounts = {
      nw: 0,
      ne: 0,
      sw: 0,
      se: 0,
    };

    let totalArea = 0;

    layout.placements.forEach((placement) => {
      // Calculate center of placement
      const centerX = placement.x + placement.width / 2;
      const centerY = placement.y + placement.height / 2;

      // Assign to quadrant based on center point
      if (centerX < midX && centerY < midY) {
        quadrantCounts.nw++;
      } else if (centerX >= midX && centerY < midY) {
        quadrantCounts.ne++;
      } else if (centerX < midX && centerY >= midY) {
        quadrantCounts.sw++;
      } else {
        quadrantCounts.se++;
      }

      // Calculate area for utilization check
      totalArea += placement.width * placement.height;
    });

    // Check for empty quadrants
    const emptyQuadrants: string[] = [];
    if (quadrantCounts.nw === 0) emptyQuadrants.push('NW');
    if (quadrantCounts.ne === 0) emptyQuadrants.push('NE');
    if (quadrantCounts.sw === 0) emptyQuadrants.push('SW');
    if (quadrantCounts.se === 0) emptyQuadrants.push('SE');

    if (emptyQuadrants.length > 0) {
      layout.warnings.push(
        `Garden distribution: No plants in ${emptyQuadrants.join(', ')} quadrant(s). Consider spreading plants more evenly.`
      );
    }

    // Calculate space utilization
    const gardenArea = width * height;
    const usagePercent = Math.round((totalArea / gardenArea) * 100);

    if (usagePercent < 40) {
      layout.warnings.push(
        `Garden utilization: Only ${usagePercent}% of space used. Consider adding more plants or using larger spacing.`
      );
    }

    logAI.debug('Spatial distribution validation', {
      layoutId: layout.id,
      plantsPerQuadrant: quadrantCounts,
      usagePercent,
      warningCount: layout.warnings.length,
    });
  }

  /**
   * Calculate average score across all layouts
   */
  private calculateAverageScore(layouts: LayoutOption[]): number {
    if (layouts.length === 0) return 0;
    const total = layouts.reduce((sum, layout) => sum + layout.score, 0);
    return Math.round(total / layouts.length);
  }

  /**
   * Generate summary text for layout generation
   */
  private generateSummary(layouts: LayoutOption[], context: LayoutContext): string {
    const plantCount = context.selectedPlants.length;
    const gardenSize = context.availableSpace.toFixed(1);

    return `Generated 3 layout options for ${plantCount} plants in ${gardenSize} sq ft garden. Options optimized for: maximum yield, maximum variety, and beginner-friendly approach.`;
  }

  /**
   * Create mock response when AI is disabled
   */
  private createMockResponse(context: LayoutContext): { layouts: LayoutOption[] } {
    const layouts: LayoutOption[] = [
      this.createMockLayout(context, 'max_yield', 'layout_1'),
      this.createMockLayout(context, 'max_variety', 'layout_2'),
      this.createMockLayout(context, 'beginner_friendly', 'layout_3'),
    ];

    return { layouts };
  }

  /**
   * Create a single mock layout
   */
  private createMockLayout(
    context: LayoutContext,
    goal: 'max_yield' | 'max_variety' | 'beginner_friendly',
    id: string
  ): LayoutOption {
    const { garden, selectedPlants, plantQuantities } = context;
    const placements = [];

    // Simple grid layout algorithm for mock with quadrant distribution
    let currentX = 0.5; // Start with 0.5ft margin
    let currentY = 0.5;

    // Track which quadrant we're placing in to ensure distribution
    let currentQuadrant = 0;
    const quadrants = [
      { startX: 0.5, startY: 0.5 }, // NW
      { startX: garden.dimensions.width / 2 + 0.5, startY: 0.5 }, // NE
      { startX: 0.5, startY: garden.dimensions.height / 2 + 0.5 }, // SW
      { startX: garden.dimensions.width / 2 + 0.5, startY: garden.dimensions.height / 2 + 0.5 }, // SE
    ];

    for (const plant of selectedPlants) {
      // Get calculated quantity if available, otherwise use default
      const plantQty = plantQuantities?.find((pq) => pq.plantProfileId === plant.id);
      const totalQuantity = plantQty?.calculatedQuantity || (goal === 'max_yield' ? 3 : goal === 'max_variety' ? 1 : 2);

      // Determine number of blocks to create for this plant
      const numBlocks = totalQuantity <= 3 ? 1 : totalQuantity <= 7 ? 2 : 3;
      const plantsPerBlock = Math.ceil(totalQuantity / numBlocks);

      const spacing = plant.spacingInches
        ? plant.spacingInches / 12
        : goal === 'beginner_friendly'
          ? 2.0
          : 1.5;

      // Create multiple blocks for this plant, distributing across quadrants
      for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
        const plantCount = blockIdx === numBlocks - 1
          ? totalQuantity - (plantsPerBlock * (numBlocks - 1))
          : plantsPerBlock;

        // Use different quadrant for each block to ensure distribution
        const quadrant = quadrants[currentQuadrant % quadrants.length];
        currentQuadrant++;

        // Vary block size based on plant count
        const blockMultiplier = plantCount <= 2 ? 1 : plantCount <= 4 ? 1.5 : 2;
        const width = spacing * blockMultiplier;
        const height = spacing * blockMultiplier;

        // Start from quadrant position
        currentX = quadrant.startX;
        currentY = quadrant.startY;

        // Check if we're out of space in this quadrant
        if (currentY + height > garden.dimensions.height - 0.5) {
          continue; // Skip this block if no space
        }

        placements.push({
          plantProfileId: plant.id,
          plantName: plant.name,
          x: parseFloat(currentX.toFixed(2)),
          y: parseFloat(currentY.toFixed(2)),
          width: parseFloat(width.toFixed(2)),
          height: parseFloat(height.toFixed(2)),
          quantity: plantCount,
          plantCount: plantCount,
          reasoning: `${plant.name} (${plantCount} plants) placed with ${spacing.toFixed(1)}ft spacing for ${goal.replace('_', ' ')} optimization`,
        });
      }
    }

    // Calculate scores
    const companionScore = this.calculateMockCompanionScore(placements, context);
    const spacingScore = goal === 'beginner_friendly' ? 95 : goal === 'max_yield' ? 85 : 90;
    const accessibilityScore = 90;
    const overallScore = Math.round(
      (companionScore + spacingScore + accessibilityScore) / 3
    );

    return {
      id,
      optimizationGoal: goal,
      placements,
      score: overallScore,
      companionScore,
      spacingScore,
      accessibilityScore,
      warnings: [],
    };
  }

  /**
   * Call AI with custom max_tokens for layout generation
   * Layout generation requires more output tokens than standard analysis
   */
  private async callAIWithCustomTokens(
    systemPrompt: string,
    userPrompt: string,
    userId: string,
    maxTokens: number
  ): Promise<any> {
    // Temporarily override aiConfig maxTokens
    const { aiConfig } = await import('../../../config/ai');
    const originalMaxTokens = aiConfig.maxTokens;

    try {
      // Override for this call
      aiConfig.maxTokens = maxTokens;

      logAI.info('Layout generation AI call with custom token limit', {
        service: 'LayoutGenerationService',
        maxTokens,
        originalMaxTokens,
      });

      return await this.callAI(systemPrompt, userPrompt, userId);
    } finally {
      // Restore original value
      aiConfig.maxTokens = originalMaxTokens;
    }
  }

  /**
   * Calculate mock companion score based on proximity
   */
  private calculateMockCompanionScore(placements: any[], context: LayoutContext): number {
    const { companionRules } = context;

    if (companionRules.length === 0) return 100;

    let beneficialCount = 0;
    let harmfulCount = 0;

    // Check each companion rule
    for (const rule of companionRules) {
      const plantA = placements.find((p) => p.plantName === rule.plantAName);
      const plantB = placements.find((p) => p.plantName === rule.plantBName);

      if (plantA && plantB) {
        const distance = Math.sqrt(
          Math.pow(plantB.x - plantA.x, 2) + Math.pow(plantB.y - plantA.y, 2)
        );

        if (rule.relationship === 'beneficial' && distance < 3) {
          beneficialCount++;
        } else if (rule.relationship === 'harmful' && distance < 4) {
          harmfulCount++;
        }
      }
    }

    // Calculate score (start at 80, add for beneficial, subtract for harmful)
    return Math.max(0, Math.min(100, 80 + beneficialCount * 5 - harmfulCount * 10));
  }
}
