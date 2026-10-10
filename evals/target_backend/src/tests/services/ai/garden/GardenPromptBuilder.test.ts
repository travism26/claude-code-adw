/**
 * GardenPromptBuilder Tests
 *
 * Tests the prompt generation logic for garden analysis:
 * - System prompt structure
 * - User prompt formatting
 * - Context section building
 * - Prompt content validation
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { GardenPromptBuilder } from '../../../../services/ai/garden/GardenPromptBuilder';
import { GardenContext } from '../../../../services/ai/garden/types';
import { getStatusLabel, getStatusPromptGuidance } from '../../../../services/ai/garden/prompts';
import { v4 as uuidv4 } from 'uuid';

describe('GardenPromptBuilder', () => {
  const gardenId = uuidv4();
  const plotId1 = uuidv4();
  const profileId1 = uuidv4();

  describe('build()', () => {
    it('should return systemPrompt and userPrompt', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test Garden',
          dimensions: { width: 10, height: 8 },
          zone: '5a',
        },
        user: { zone: '5a', timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const prompts = GardenPromptBuilder.build(context);

      expect(prompts).to.have.property('systemPrompt');
      expect(prompts).to.have.property('userPrompt');
      expect(prompts.systemPrompt).to.be.a('string');
      expect(prompts.userPrompt).to.be.a('string');
      expect(prompts.systemPrompt.length).to.be.greaterThan(0);
      expect(prompts.userPrompt.length).to.be.greaterThan(0);
    });
  });

  describe('systemPrompt', () => {
    const minimalContext: GardenContext = {
      garden: {
        id: gardenId,
        name: 'Test',
        dimensions: { width: 10, height: 10 },
        zone: null,
      },
      user: { zone: null, timezone: 'UTC' },
      plots: [],
      companionRules: [],
      seasonalTips: [],
      metrics: {
        totalPlots: 0,
        occupiedPlots: 0,
        uniquePlants: 0,
        averageSpacing: null,
        zoneCompatibilityIssues: 0,
        companionConflicts: 0,
        plannedPlots: 0,
        plantedPlots: 0,
        harvestedPlots: 0,
      },
    };

    it('should contain JSON format specification', () => {
      const { systemPrompt } = GardenPromptBuilder.build(minimalContext);
      expect(systemPrompt).to.include('JSON');
      expect(systemPrompt).to.include('suggestions');
      expect(systemPrompt).to.include('overallScore');
      expect(systemPrompt).to.include('summary');
    });

    it('should specify suggestion fields', () => {
      const { systemPrompt } = GardenPromptBuilder.build(minimalContext);
      expect(systemPrompt).to.include('type');
      expect(systemPrompt).to.include('category');
      expect(systemPrompt).to.include('title');
      expect(systemPrompt).to.include('description');
      expect(systemPrompt).to.include('affectedIds');
      expect(systemPrompt).to.include('priority');
      expect(systemPrompt).to.include('actionable');
    });

    it('should specify suggestion types', () => {
      const { systemPrompt } = GardenPromptBuilder.build(minimalContext);
      expect(systemPrompt).to.include('improvement');
      expect(systemPrompt).to.include('warning');
      expect(systemPrompt).to.include('optimization');
    });

    it('should specify suggestion categories', () => {
      const { systemPrompt } = GardenPromptBuilder.build(minimalContext);
      expect(systemPrompt).to.include('spacing');
      expect(systemPrompt).to.include('companion_planting');
      expect(systemPrompt).to.include('sunlight');
      expect(systemPrompt).to.include('zone_compatibility');
    });

    it('should specify priority levels', () => {
      const { systemPrompt } = GardenPromptBuilder.build(minimalContext);
      expect(systemPrompt).to.include('high');
      expect(systemPrompt).to.include('medium');
      expect(systemPrompt).to.include('low');
    });

    it('should mention GrowBuddy AI role', () => {
      const { systemPrompt } = GardenPromptBuilder.build(minimalContext);
      expect(systemPrompt).to.include('GrowBuddy');
    });

    it('should provide analysis guidelines', () => {
      const { systemPrompt } = GardenPromptBuilder.build(minimalContext);
      expect(systemPrompt).to.include('actionable');
      expect(systemPrompt).to.include('specific');
    });
  });

  describe('userPrompt - overview section', () => {
    it('should include garden overview section', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Victory Garden',
          dimensions: { width: 12, height: 10 },
          zone: '6b',
        },
        user: { zone: '6a', timezone: 'America/New_York' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 5,
          occupiedPlots: 3,
          uniquePlants: 2,
          averageSpacing: 4.5,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('GARDEN OVERVIEW');
      expect(userPrompt).to.include('Victory Garden');
      expect(userPrompt).to.include('12ft x 10ft');
      expect(userPrompt).to.include('6b');
      expect(userPrompt).to.include('Total Plots: 5');
      expect(userPrompt).to.include('Occupied Plots: 3');
      expect(userPrompt).to.include('Unique Plants: 2');
    });

    it('should use user zone when garden zone is null', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: '7a', timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('Zone: 7a');
    });

    it('should show "Not specified" when both zones are null', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('Zone: Not specified');
    });
  });

  describe('userPrompt - plot details section', () => {
    it('should include plot details for occupied plot', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: '5a',
        },
        user: { zone: '5a', timezone: 'UTC' },
        plots: [
          {
            id: plotId1,
            position: { x: 2, y: 3 },
            dimensions: { width: 2.5, height: 2 },
            compassDirection: 'SE',
            status: 'planned',
            notes: 'Gets afternoon shade',
            plant: {
              profileId: profileId1,
              name: 'Cherry Tomato',
              species: 'Solanum lycopersicum var. cerasiforme',
              type: 'vegetable',
              sunlightRequirements: 'full_sun',
              spacingInches: 24,
              plantFamily: 'Solanaceae',
              zoneMin: 3,
              zoneMax: 9,
              difficulty: 'easy',
            },
          },
        ],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 1,
          occupiedPlots: 1,
          uniquePlants: 1,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('PLOT DETAILS');
      expect(userPrompt).to.include('Plot 1');
      expect(userPrompt).to.include(plotId1);
      expect(userPrompt).to.include('(2, 3)');
      expect(userPrompt).to.include('2.5ft x 2ft');
      expect(userPrompt).to.include('SE');
      expect(userPrompt).to.include('Gets afternoon shade');
      expect(userPrompt).to.include('Cherry Tomato');
      expect(userPrompt).to.include('full_sun');
      expect(userPrompt).to.include('24 inches');
      expect(userPrompt).to.include('3 - 9');
      expect(userPrompt).to.include('Solanaceae');
    });

    it('should show empty plot correctly', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: '5a',
        },
        user: { zone: '5a', timezone: 'UTC' },
        plots: [
          {
            id: plotId1,
            position: { x: 0, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: null,
            status: 'planned',
            notes: null,
            plant: null,
          },
        ],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 1,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('Empty plot');
      expect(userPrompt).to.include('not specified');
    });

    it('should not include plot details section when no plots', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.not.include('PLOT DETAILS');
    });
  });

  describe('userPrompt - companion rules section', () => {
    it('should include beneficial companion rules', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [
          {
            plantAName: 'Tomato',
            plantBName: 'Basil',
            relationship: 'beneficial',
            notes: 'Basil repels pests and improves flavor',
          },
          {
            plantAName: 'Carrot',
            plantBName: 'Onion',
            relationship: 'beneficial',
            notes: null,
          },
        ],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('COMPANION PLANTING RULES');
      expect(userPrompt).to.include('Beneficial Companions');
      expect(userPrompt).to.include('Tomato + Basil');
      expect(userPrompt).to.include('Basil repels pests and improves flavor');
      expect(userPrompt).to.include('Carrot + Onion');
    });

    it('should include harmful companion rules', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [
          {
            plantAName: 'Tomato',
            plantBName: 'Cabbage',
            relationship: 'harmful',
            notes: 'Compete for nutrients',
          },
        ],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('Harmful Combinations (AVOID)');
      expect(userPrompt).to.include('Tomato + Cabbage');
      expect(userPrompt).to.include('Compete for nutrients');
    });

    it('should not include companion section when no rules', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.not.include('COMPANION PLANTING RULES');
    });
  });

  describe('userPrompt - seasonal tips section', () => {
    it('should include seasonal tips grouped by plant', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [
          {
            plantName: 'Tomato',
            season: 'spring',
            tip: 'Start seeds indoors',
            timing: 6,
          },
          {
            plantName: 'Tomato',
            season: 'summer',
            tip: 'Prune suckers regularly',
            timing: null,
          },
          {
            plantName: 'Basil',
            season: 'spring',
            tip: 'Plant after last frost',
            timing: 2,
          },
        ],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('SEASONAL TIPS');
      expect(userPrompt).to.include('Tomato:');
      expect(userPrompt).to.include('[spring, week 6]');
      expect(userPrompt).to.include('Start seeds indoors');
      expect(userPrompt).to.include('[summer]');
      expect(userPrompt).to.include('Prune suckers regularly');
      expect(userPrompt).to.include('Basil:');
      expect(userPrompt).to.include('[spring, week 2]');
      expect(userPrompt).to.include('Plant after last frost');
    });

    it('should not include seasonal tips section when no tips', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.not.include('SEASONAL TIPS');
    });
  });

  describe('userPrompt - metrics section', () => {
    it('should include all metrics', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 5,
          occupiedPlots: 3,
          uniquePlants: 2,
          averageSpacing: 4.567,
          zoneCompatibilityIssues: 1,
          companionConflicts: 2,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('CALCULATED METRICS');
      expect(userPrompt).to.include('Average Plot Spacing: 4.57 feet');
      expect(userPrompt).to.include('Zone Compatibility Issues: 1');
      expect(userPrompt).to.include('Companion Conflicts Detected: 2');
    });

    it('should show N/A for null averageSpacing', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('Average Plot Spacing: N/A');
    });
  });

  describe('userPrompt - analysis request section', () => {
    it('should include analysis request with specific asks', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: null,
        },
        user: { zone: null, timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt } = GardenPromptBuilder.build(context);

      expect(userPrompt).to.include('ANALYSIS REQUEST');
      expect(userPrompt).to.include('harmful companion plant pairings');
      expect(userPrompt).to.include('plant spacing');
      expect(userPrompt).to.include('Zone compatibility');
      expect(userPrompt).to.include('Sunlight optimization');
      expect(userPrompt).to.include('Seasonal timing');
      expect(userPrompt).to.include('actionable recommendations');
    });
  });

  describe('prompt structure and consistency', () => {
    it('should produce consistent prompts for same context', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test',
          dimensions: { width: 10, height: 10 },
          zone: '5a',
        },
        user: { zone: '5a', timezone: 'UTC' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const prompts1 = GardenPromptBuilder.build(context);
      const prompts2 = GardenPromptBuilder.build(context);

      expect(prompts1.systemPrompt).to.equal(prompts2.systemPrompt);
      expect(prompts1.userPrompt).to.equal(prompts2.userPrompt);
    });

    it('should not leak sensitive data in prompts', () => {
      const context: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Test Garden',
          dimensions: { width: 10, height: 10 },
          zone: '5a',
        },
        user: { zone: '5a', timezone: 'America/New_York' },
        plots: [],
        companionRules: [],
        seasonalTips: [],
        metrics: {
          totalPlots: 0,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: null,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      const { userPrompt, systemPrompt } = GardenPromptBuilder.build(context);

      // Should not include sensitive data
      expect(userPrompt).to.not.include('email');
      expect(userPrompt).to.not.include('password');
      expect(userPrompt).to.not.include('token');
      expect(systemPrompt).to.not.include('email');
      expect(systemPrompt).to.not.include('password');
    });
  });

  describe('status-related prompt helpers', () => {
    describe('getStatusLabel()', () => {
      it('should return correct label for planned status', () => {
        expect(getStatusLabel('planned')).to.equal('PLANNED (not yet planted)');
      });

      it('should return correct label for planted status', () => {
        expect(getStatusLabel('planted')).to.equal('PLANTED (in ground)');
      });

      it('should return correct label for harvested status', () => {
        expect(getStatusLabel('harvested')).to.equal('HARVESTED (completed)');
      });

      it('should return correct label for archived status', () => {
        expect(getStatusLabel('archived')).to.equal('ARCHIVED (inactive)');
      });
    });

    describe('getStatusPromptGuidance()', () => {
      it('should return guidance for all status types', () => {
        const guidance = getStatusPromptGuidance();

        expect(guidance).to.include('IMPORTANT - Plot Status Awareness');
        expect(guidance).to.include('planned');
        expect(guidance).to.include('planted');
        expect(guidance).to.include('harvested');
        expect(guidance).to.include('archived');
      });

      it('should include specific guidance for planned plots', () => {
        const guidance = getStatusPromptGuidance();

        expect(guidance).to.include('not yet physically planted');
        expect(guidance).to.include('optimal plant selection');
        expect(guidance).to.include('companion planting arrangements');
        expect(guidance).to.include('nothing is in the ground');
      });

      it('should include specific guidance for planted plots', () => {
        const guidance = getStatusPromptGuidance();

        expect(guidance).to.include('plants are in the ground');
        expect(guidance).to.include('care improvements');
        expect(guidance).to.include('Avoid suggesting relocation');
      });

      it('should include specific guidance for harvested plots', () => {
        const guidance = getStatusPromptGuidance();

        expect(guidance).to.include('have been harvested');
        expect(guidance).to.include('crop rotation');
        expect(guidance).to.include('what to plant next');
      });

      it('should include specific guidance for archived plots', () => {
        const guidance = getStatusPromptGuidance();

        expect(guidance).to.include('no longer active');
        expect(guidance).to.include('minimal suggestions');
      });
    });

    describe('system prompt includes status guidance', () => {
      it('should include status guidance in system prompt', () => {
        const context: GardenContext = {
          garden: {
            id: gardenId,
            name: 'Test',
            dimensions: { width: 10, height: 10 },
            zone: null,
          },
          user: { zone: null, timezone: 'UTC' },
          plots: [],
          companionRules: [],
          seasonalTips: [],
          metrics: {
            totalPlots: 0,
            occupiedPlots: 0,
            uniquePlants: 0,
            averageSpacing: null,
            zoneCompatibilityIssues: 0,
            companionConflicts: 0,
            plannedPlots: 0,
            plantedPlots: 0,
            harvestedPlots: 0,
          },
        };

        const { systemPrompt } = GardenPromptBuilder.build(context);

        expect(systemPrompt).to.include('IMPORTANT - Plot Status Awareness');
        expect(systemPrompt).to.include('planned');
        expect(systemPrompt).to.include('planted');
        expect(systemPrompt).to.include('harvested');
        expect(systemPrompt).to.include('archived');
      });
    });

    describe('plot details use status labels', () => {
      it('should show status labels for planned plots', () => {
        const context: GardenContext = {
          garden: {
            id: gardenId,
            name: 'Test',
            dimensions: { width: 10, height: 10 },
            zone: null,
          },
          user: { zone: null, timezone: 'UTC' },
          plots: [
            {
              id: plotId1,
              position: { x: 0, y: 0 },
              dimensions: { width: 2, height: 2 },
              compassDirection: null,
              status: 'planned',
              notes: null,
              plant: null,
            },
          ],
          companionRules: [],
          seasonalTips: [],
          metrics: {
            totalPlots: 1,
            occupiedPlots: 0,
            uniquePlants: 0,
            averageSpacing: null,
            zoneCompatibilityIssues: 0,
            companionConflicts: 0,
            plannedPlots: 1,
            plantedPlots: 0,
            harvestedPlots: 0,
          },
        };

        const { userPrompt } = GardenPromptBuilder.build(context);

        expect(userPrompt).to.include('Status: PLANNED (not yet planted)');
      });

      it('should show status labels for planted plots', () => {
        const context: GardenContext = {
          garden: {
            id: gardenId,
            name: 'Test',
            dimensions: { width: 10, height: 10 },
            zone: null,
          },
          user: { zone: null, timezone: 'UTC' },
          plots: [
            {
              id: plotId1,
              position: { x: 0, y: 0 },
              dimensions: { width: 2, height: 2 },
              compassDirection: null,
              status: 'planted',
              notes: null,
              plant: null,
            },
          ],
          companionRules: [],
          seasonalTips: [],
          metrics: {
            totalPlots: 1,
            occupiedPlots: 0,
            uniquePlants: 0,
            averageSpacing: null,
            zoneCompatibilityIssues: 0,
            companionConflicts: 0,
            plannedPlots: 0,
            plantedPlots: 1,
            harvestedPlots: 0,
          },
        };

        const { userPrompt } = GardenPromptBuilder.build(context);

        expect(userPrompt).to.include('Status: PLANTED (in ground)');
      });

      it('should show status labels for harvested plots', () => {
        const context: GardenContext = {
          garden: {
            id: gardenId,
            name: 'Test',
            dimensions: { width: 10, height: 10 },
            zone: null,
          },
          user: { zone: null, timezone: 'UTC' },
          plots: [
            {
              id: plotId1,
              position: { x: 0, y: 0 },
              dimensions: { width: 2, height: 2 },
              compassDirection: null,
              status: 'harvested',
              notes: null,
              plant: null,
            },
          ],
          companionRules: [],
          seasonalTips: [],
          metrics: {
            totalPlots: 1,
            occupiedPlots: 0,
            uniquePlants: 0,
            averageSpacing: null,
            zoneCompatibilityIssues: 0,
            companionConflicts: 0,
            plannedPlots: 0,
            plantedPlots: 0,
            harvestedPlots: 1,
          },
        };

        const { userPrompt } = GardenPromptBuilder.build(context);

        expect(userPrompt).to.include('Status: HARVESTED (completed)');
      });

      it('should show status labels for archived plots', () => {
        const context: GardenContext = {
          garden: {
            id: gardenId,
            name: 'Test',
            dimensions: { width: 10, height: 10 },
            zone: null,
          },
          user: { zone: null, timezone: 'UTC' },
          plots: [
            {
              id: plotId1,
              position: { x: 0, y: 0 },
              dimensions: { width: 2, height: 2 },
              compassDirection: null,
              status: 'archived',
              notes: null,
              plant: null,
            },
          ],
          companionRules: [],
          seasonalTips: [],
          metrics: {
            totalPlots: 1,
            occupiedPlots: 0,
            uniquePlants: 0,
            averageSpacing: null,
            zoneCompatibilityIssues: 0,
            companionConflicts: 0,
            plannedPlots: 0,
            plantedPlots: 0,
            harvestedPlots: 0,
          },
        };

        const { userPrompt } = GardenPromptBuilder.build(context);

        expect(userPrompt).to.include('Status: ARCHIVED (inactive)');
      });
    });
  });
});
