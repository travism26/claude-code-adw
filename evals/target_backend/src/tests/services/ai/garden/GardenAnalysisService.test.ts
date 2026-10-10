/**
 * GardenAnalysisService Tests
 *
 * Tests the garden analysis orchestration service:
 * - Service orchestration flow
 * - Feature flag behavior (mock vs AI responses)
 * - Mock response generation
 * - Error handling
 * - Integration with context and prompt builders
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { GardenAnalysisService } from '../../../../services/ai/garden/GardenAnalysisService';
import { GardenContextBuilder } from '../../../../services/ai/garden/GardenContextBuilder';
import { GardenPromptBuilder } from '../../../../services/ai/garden/GardenPromptBuilder';
import { GardenContext } from '../../../../services/ai/garden/types';
import { v4 as uuidv4 } from 'uuid';

describe('GardenAnalysisService', () => {
  let service: GardenAnalysisService;
  let contextBuilderStub: sinon.SinonStub;
  let promptBuilderStub: sinon.SinonStub;

  const userId = uuidv4();
  const gardenId = uuidv4();
  const plotId1 = uuidv4();
  const plotId2 = uuidv4();

  const mockContext: GardenContext = {
    garden: {
      id: gardenId,
      name: 'Test Garden',
      dimensions: { width: 10, height: 8 },
      zone: '5a',
    },
    user: { zone: '5a', timezone: 'UTC' },
    plots: [
      {
        id: plotId1,
        position: { x: 0, y: 0 },
        dimensions: { width: 2, height: 2 },
        compassDirection: 'N',
        notes: null,
        status: 'planned',
        plant: {
          profileId: uuidv4(),
          name: 'Tomato',
          species: null,
          type: 'vegetable',
          sunlightRequirements: 'full_sun',
          spacingInches: 24,
          plantFamily: 'Solanaceae',
          zoneMin: 3,
          zoneMax: 9,
          difficulty: 'medium',
        },
      },
      {
        id: plotId2,
        position: { x: 3, y: 0 },
        dimensions: { width: 2, height: 2 },
        compassDirection: 'N',
        notes: null,
        status: 'planned',
        plant: null,
      },
    ],
    companionRules: [],
    seasonalTips: [],
    metrics: {
      totalPlots: 2,
      occupiedPlots: 1,
      uniquePlants: 1,
      averageSpacing: 3.0,
      zoneCompatibilityIssues: 0,
      companionConflicts: 0,
      plannedPlots: 0,
      plantedPlots: 0,
      harvestedPlots: 0,
    },
  };

  beforeEach(() => {
    service = new GardenAnalysisService();

    // Stub the context builder's build method
    contextBuilderStub = sinon.stub(GardenContextBuilder.prototype, 'build');
    contextBuilderStub.resolves(mockContext);

    // Stub the prompt builder's static build method
    promptBuilderStub = sinon.stub(GardenPromptBuilder, 'build');
    promptBuilderStub.returns({
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt',
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('analyzeGarden() - with feature flag disabled (mock mode)', () => {
    it('should return valid analysis response structure', async () => {
      const result = await service.analyzeGarden(gardenId, userId);

      expect(result).to.have.property('gardenId');
      expect(result).to.have.property('analyzedAt');
      expect(result).to.have.property('context');
      expect(result).to.have.property('suggestions');
      expect(result).to.have.property('overallScore');
      expect(result).to.have.property('summary');

      expect(result.gardenId).to.equal(gardenId);
      expect(result.analyzedAt).to.be.instanceOf(Date);
      expect(result.context).to.deep.equal(mockContext);
      expect(result.suggestions).to.be.an('array');
      expect(result.overallScore).to.be.a('number');
      expect(result.summary).to.be.a('string');
    });

    it('should delegate to context builder with correct parameters', async () => {
      await service.analyzeGarden(gardenId, userId);

      expect(contextBuilderStub.calledOnce).to.be.true;
      expect(contextBuilderStub.calledWith(gardenId, userId)).to.be.true;
    });

    it('should delegate to prompt builder with context', async () => {
      await service.analyzeGarden(gardenId, userId);

      expect(promptBuilderStub.calledOnce).to.be.true;
      expect(promptBuilderStub.calledWith(mockContext)).to.be.true;
    });

    it('should generate mock companion conflict warning when conflicts exist', async () => {
      const contextWithConflicts: GardenContext = {
        ...mockContext,
        companionRules: [
          {
            plantAName: 'Tomato',
            plantBName: 'Cabbage',
            relationship: 'harmful',
            notes: null,
          },
        ],
        metrics: {
          ...mockContext.metrics,
          companionConflicts: 1,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(contextWithConflicts);

      const result = await service.analyzeGarden(gardenId, userId);

      const conflictWarning = result.suggestions.find(
        (s) => s.category === 'companion_planting'
      );
      expect(conflictWarning).to.exist;
      expect(conflictWarning?.type).to.equal('warning');
      expect(conflictWarning?.priority).to.equal('high');
      expect(conflictWarning?.description).to.include('harmful companion');
    });

    it('should generate mock zone compatibility warning when issues exist', async () => {
      const contextWithZoneIssues: GardenContext = {
        ...mockContext,
        metrics: {
          ...mockContext.metrics,
          zoneCompatibilityIssues: 2,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(contextWithZoneIssues);

      const result = await service.analyzeGarden(gardenId, userId);

      const zoneWarning = result.suggestions.find(
        (s) => s.category === 'zone_compatibility'
      );
      expect(zoneWarning).to.exist;
      expect(zoneWarning?.type).to.equal('warning');
      expect(zoneWarning?.priority).to.equal('medium');
      expect(zoneWarning?.description).to.include('not be well-suited');
    });

    it('should generate mock spacing optimization for gardens with multiple plots', async () => {
      const result = await service.analyzeGarden(gardenId, userId);

      const spacingOptimization = result.suggestions.find(
        (s) => s.category === 'spacing'
      );
      expect(spacingOptimization).to.exist;
      expect(spacingOptimization?.type).to.equal('optimization');
      expect(spacingOptimization?.priority).to.equal('low');
    });

    it('should calculate mock score based on issues', async () => {
      const contextWithIssues: GardenContext = {
        ...mockContext,
        metrics: {
          ...mockContext.metrics,
          companionConflicts: 2, // -30 points
          zoneCompatibilityIssues: 3, // -15 points
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(contextWithIssues);

      const result = await service.analyzeGarden(gardenId, userId);

      // Score should be 100 - (2 * 15) - (3 * 5) = 55
      expect(result.overallScore).to.equal(55);
    });

    it('should include context metrics in mock summary', async () => {
      const result = await service.analyzeGarden(gardenId, userId);

      expect(result.summary).to.include('Mock analysis');
      expect(result.summary).to.include(
        mockContext.metrics.occupiedPlots.toString()
      );
      expect(result.summary).to.include(
        mockContext.metrics.uniquePlants.toString()
      );
      expect(result.summary).to.include('test data');
    });
  });

  describe('analyzeGarden() - empty garden scenarios', () => {
    it('should handle empty garden with no plots', async () => {
      const emptyContext: GardenContext = {
        garden: {
          id: gardenId,
          name: 'Empty Garden',
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

      contextBuilderStub.resolves(emptyContext);

      const result = await service.analyzeGarden(gardenId, userId);

      expect(result.suggestions).to.be.an('array');
      expect(result.overallScore).to.equal(100); // No issues = perfect score
      expect(result.summary).to.include('0 occupied plots');
    });

    it('should handle garden with only empty plots', async () => {
      const emptyPlotsContext: GardenContext = {
        ...mockContext,
        plots: [
          {
            id: plotId1,
            position: { x: 0, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: null,
            notes: null,
            status: 'planned',
            plant: null,
          },
          {
            id: plotId2,
            position: { x: 3, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: null,
            notes: null,
            status: 'planned',
            plant: null,
          },
        ],
        metrics: {
          totalPlots: 2,
          occupiedPlots: 0,
          uniquePlants: 0,
          averageSpacing: 4.0,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(emptyPlotsContext);

      const result = await service.analyzeGarden(gardenId, userId);

      expect(result.overallScore).to.equal(100);
      // Should still generate spacing optimization since plots > 1
      const spacingOptimization = result.suggestions.find(
        (s) => s.category === 'spacing'
      );
      expect(spacingOptimization).to.exist;
    });

    it('should not generate spacing optimization for single plot', async () => {
      const singlePlotContext: GardenContext = {
        ...mockContext,
        plots: [mockContext.plots[0]],
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

      contextBuilderStub.resolves(singlePlotContext);

      const result = await service.analyzeGarden(gardenId, userId);

      const spacingOptimization = result.suggestions.find(
        (s) => s.category === 'spacing'
      );
      expect(spacingOptimization).to.not.exist;
    });
  });

  describe('analyzeGarden() - error handling', () => {
    it('should propagate error when context building fails', async () => {
      const error = new Error('Garden not found');
      contextBuilderStub.rejects(error);

      try {
        await service.analyzeGarden(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).to.equal('Garden not found');
      }
    });

    it('should propagate error when prompt building fails', async () => {
      const error = new Error('Prompt builder error');
      promptBuilderStub.throws(error);

      try {
        await service.analyzeGarden(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).to.equal('Prompt builder error');
      }
    });
  });

  describe('analyzeGarden() - different garden configurations', () => {
    it('should handle garden with optimal setup (no issues)', async () => {
      const optimalContext: GardenContext = {
        ...mockContext,
        plots: [
          {
            id: plotId1,
            position: { x: 0, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: 'N',
            notes: null,
            status: 'planned',
            plant: {
              profileId: uuidv4(),
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlightRequirements: 'full_sun',
              spacingInches: 24,
              plantFamily: 'Solanaceae',
              zoneMin: 3,
              zoneMax: 9,
              difficulty: 'medium',
            },
          },
          {
            id: plotId2,
            position: { x: 4, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: 'N',
            notes: null,
            status: 'planned',
            plant: {
              profileId: uuidv4(),
              name: 'Basil',
              species: null,
              type: 'herb',
              sunlightRequirements: 'full_sun',
              spacingInches: 12,
              plantFamily: 'Lamiaceae',
              zoneMin: 4,
              zoneMax: 10,
              difficulty: 'easy',
            },
          },
        ],
        companionRules: [
          {
            plantAName: 'Tomato',
            plantBName: 'Basil',
            relationship: 'beneficial',
            notes: 'Great companions',
          },
        ],
        metrics: {
          totalPlots: 2,
          occupiedPlots: 2,
          uniquePlants: 2,
          averageSpacing: 4.0,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(optimalContext);

      const result = await service.analyzeGarden(gardenId, userId);

      expect(result.overallScore).to.equal(100);
      // Should only have low-priority spacing optimization
      const highPrioritySuggestions = result.suggestions.filter(
        (s) => s.priority === 'high'
      );
      expect(highPrioritySuggestions).to.have.length(0);
    });

    it('should handle garden with zone issues', async () => {
      const zoneIssueContext: GardenContext = {
        ...mockContext,
        garden: {
          ...mockContext.garden,
          zone: '3a', // Cold zone
        },
        plots: [
          {
            id: plotId1,
            position: { x: 0, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: 'N',
            notes: null,
            status: 'planned',
            plant: {
              profileId: uuidv4(),
              name: 'Lemon Tree',
              species: null,
              type: 'fruit',
              sunlightRequirements: 'full_sun',
              spacingInches: 120,
              plantFamily: 'Rutaceae',
              zoneMin: 9, // Needs zone 9+, but garden is 3a
              zoneMax: 11,
              difficulty: 'hard',
            },
          },
        ],
        metrics: {
          totalPlots: 1,
          occupiedPlots: 1,
          uniquePlants: 1,
          averageSpacing: null,
          zoneCompatibilityIssues: 1,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(zoneIssueContext);

      const result = await service.analyzeGarden(gardenId, userId);

      const zoneWarning = result.suggestions.find(
        (s) => s.category === 'zone_compatibility'
      );
      expect(zoneWarning).to.exist;
      expect(zoneWarning?.priority).to.equal('medium');
      expect(result.overallScore).to.equal(95); // 100 - (1 * 5)
    });

    it('should handle garden with companion conflicts', async () => {
      const conflictContext: GardenContext = {
        ...mockContext,
        plots: [
          {
            id: plotId1,
            position: { x: 0, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: 'N',
            notes: null,
            status: 'planned',
            plant: {
              profileId: uuidv4(),
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlightRequirements: 'full_sun',
              spacingInches: 24,
              plantFamily: 'Solanaceae',
              zoneMin: 3,
              zoneMax: 9,
              difficulty: 'medium',
            },
          },
          {
            id: plotId2,
            position: { x: 2, y: 0 },
            dimensions: { width: 2, height: 2 },
            compassDirection: 'N',
            notes: null,
            status: 'planned',
            plant: {
              profileId: uuidv4(),
              name: 'Cabbage',
              species: null,
              type: 'vegetable',
              sunlightRequirements: 'full_sun',
              spacingInches: 18,
              plantFamily: 'Brassicaceae',
              zoneMin: 1,
              zoneMax: 10,
              difficulty: 'medium',
            },
          },
        ],
        companionRules: [
          {
            plantAName: 'Tomato',
            plantBName: 'Cabbage',
            relationship: 'harmful',
            notes: 'Compete for nutrients',
          },
        ],
        metrics: {
          totalPlots: 2,
          occupiedPlots: 2,
          uniquePlants: 2,
          averageSpacing: 2.0,
          zoneCompatibilityIssues: 0,
          companionConflicts: 1,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(conflictContext);

      const result = await service.analyzeGarden(gardenId, userId);

      const conflictWarning = result.suggestions.find(
        (s) => s.category === 'companion_planting'
      );
      expect(conflictWarning).to.exist;
      expect(conflictWarning?.type).to.equal('warning');
      expect(conflictWarning?.priority).to.equal('high');
      expect(result.overallScore).to.equal(85); // 100 - (1 * 15)
    });

    it('should handle garden with multiple types of issues', async () => {
      const multiIssueContext: GardenContext = {
        ...mockContext,
        metrics: {
          totalPlots: 5,
          occupiedPlots: 4,
          uniquePlants: 3,
          averageSpacing: 2.5,
          zoneCompatibilityIssues: 2,
          companionConflicts: 3,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(multiIssueContext);

      const result = await service.analyzeGarden(gardenId, userId);

      // Should have multiple suggestions
      expect(result.suggestions.length).to.be.greaterThan(2);

      // Should have both companion and zone warnings
      const companionWarnings = result.suggestions.filter(
        (s) => s.category === 'companion_planting'
      );
      const zoneWarnings = result.suggestions.filter(
        (s) => s.category === 'zone_compatibility'
      );
      expect(companionWarnings).to.have.length(1);
      expect(zoneWarnings).to.have.length(1);

      // Score: 100 - (3 * 15) - (2 * 5) = 45
      expect(result.overallScore).to.equal(45);
    });
  });

  describe('mock response affectedIds', () => {
    it('should include affected plot IDs in suggestions', async () => {
      const contextWithConflicts: GardenContext = {
        ...mockContext,
        metrics: {
          ...mockContext.metrics,
          companionConflicts: 1,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(contextWithConflicts);

      const result = await service.analyzeGarden(gardenId, userId);

      const conflictWarning = result.suggestions.find(
        (s) => s.category === 'companion_planting'
      );
      expect(conflictWarning?.affectedIds).to.be.an('array');
      expect(conflictWarning?.affectedIds.length).to.be.greaterThan(0);
    });

    it('should limit affected IDs appropriately', async () => {
      const contextWithManyPlots: GardenContext = {
        ...mockContext,
        plots: Array(10)
          .fill(null)
          .map((_, i) => ({
            id: uuidv4(),
            position: { x: i, y: 0 },
            dimensions: { width: 1, height: 1 },
            compassDirection: 'N',
            notes: null,
            status: 'planned',
            plant: {
              profileId: uuidv4(),
              name: `Plant ${i}`,
              species: null,
              type: 'vegetable',
              sunlightRequirements: 'full_sun',
              spacingInches: 12,
              plantFamily: 'Test',
              zoneMin: 3,
              zoneMax: 9,
              difficulty: 'easy',
            },
          })),
        metrics: {
          totalPlots: 10,
          occupiedPlots: 10,
          uniquePlants: 10,
          averageSpacing: 1.0,
          zoneCompatibilityIssues: 0,
          companionConflicts: 0,
          plannedPlots: 0,
          plantedPlots: 0,
          harvestedPlots: 0,
        },
      };

      contextBuilderStub.resolves(contextWithManyPlots);

      const result = await service.analyzeGarden(gardenId, userId);

      const spacingOptimization = result.suggestions.find(
        (s) => s.category === 'spacing'
      );
      // Should limit to first 3 plots
      expect(spacingOptimization?.affectedIds.length).to.equal(3);
    });
  });
});
