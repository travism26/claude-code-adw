/**
 * GardenContextBuilder Tests
 *
 * Tests the data gathering logic for garden analysis context building:
 * - Garden fetching with access control
 * - Plot context building
 * - Plant context building
 * - Companion rules fetching
 * - Seasonal tips fetching
 * - Metrics calculation
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { GardenContextBuilder } from '../../../../services/ai/garden/GardenContextBuilder';
import { Garden } from '../../../../models/Garden';
import { PlantCompanion } from '../../../../models/PlantCompanion';
import { SeasonalTip } from '../../../../models/SeasonalTip';
import { User } from '../../../../models/User';
import { v4 as uuidv4 } from 'uuid';

describe('GardenContextBuilder', () => {
  let builder: GardenContextBuilder;
  let gardenFindOneStub: sinon.SinonStub;
  let userFindStub: sinon.SinonStub;
  let companionFindAllStub: sinon.SinonStub;
  let tipsFindAllStub: sinon.SinonStub;

  const userId = uuidv4();
  const gardenId = uuidv4();
  const plotId1 = uuidv4();
  const plotId2 = uuidv4();
  const profileId1 = uuidv4();
  const profileId2 = uuidv4();

  beforeEach(() => {
    builder = new GardenContextBuilder();
    gardenFindOneStub = sinon.stub(Garden, 'findOne');
    userFindStub = sinon.stub(User, 'findByPk');
    companionFindAllStub = sinon.stub(PlantCompanion, 'findAll');
    tipsFindAllStub = sinon.stub(SeasonalTip, 'findAll');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('build() - successful context building', () => {
    it('should build complete context with all required fields', async () => {
      const mockUser = {
        id: userId,
        growing_zone: '5a',
        tz: 'America/New_York',
      };

      const mockGarden = {
        id: gardenId,
        name: 'Test Garden',
        width: 10,
        height: 8,
        zone: '5b',
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: 'North facing plot',
            plantProfile: {
              id: profileId1,
              name: 'Tomato',
              species: 'Solanum lycopersicum',
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'easy',
            },
          },
          {
            id: plotId2,
            x: 3,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'S',
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context).to.have.property('garden');
      expect(context).to.have.property('user');
      expect(context).to.have.property('plots');
      expect(context).to.have.property('companionRules');
      expect(context).to.have.property('seasonalTips');
      expect(context).to.have.property('metrics');

      expect(context.garden.id).to.equal(gardenId);
      expect(context.garden.name).to.equal('Test Garden');
      expect(context.garden.dimensions).to.deep.equal({ width: 10, height: 8 });
      expect(context.garden.zone).to.equal('5b');

      expect(context.user.zone).to.equal('5a');
      expect(context.user.timezone).to.equal('America/New_York');

      expect(context.plots).to.have.length(2);
    });

    it('should correctly build plot context with plant', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 5,
            y: 3,
            width: 2.5,
            height: 1.5,
            compass_direction: 'SE',
            status: 'planned',
            notes: 'Corner plot',
            plantProfile: {
              id: profileId1,
              name: 'Basil',
              species: 'Ocimum basilicum',
              type: 'herb',
              sunlight_requirements: 'full_sun',
              spacing_inches: 12,
              plant_family: 'Lamiaceae',
              zone_min: 4,
              zone_max: 10,
              difficulty: 'easy',
            },
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      const plot = context.plots[0];
      expect(plot.id).to.equal(plotId1);
      expect(plot.position).to.deep.equal({ x: 5, y: 3 });
      expect(plot.dimensions).to.deep.equal({ width: 2.5, height: 1.5 });
      expect(plot.compassDirection).to.equal('SE');
      expect(plot.notes).to.equal('Corner plot');

      expect(plot.plant).to.not.be.null;
      expect(plot.plant!.profileId).to.equal(profileId1);
      expect(plot.plant!.name).to.equal('Basil');
      expect(plot.plant!.species).to.equal('Ocimum basilicum');
      expect(plot.plant!.type).to.equal('herb');
      expect(plot.plant!.sunlightRequirements).to.equal('full_sun');
      expect(plot.plant!.spacingInches).to.equal(12);
      expect(plot.plant!.plantFamily).to.equal('Lamiaceae');
      expect(plot.plant!.zoneMin).to.equal(4);
      expect(plot.plant!.zoneMax).to.equal(10);
      expect(plot.plant!.difficulty).to.equal('easy');
    });

    it('should correctly build plot context without plant', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: null,
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      const plot = context.plots[0];
      expect(plot.plant).to.be.null;
      expect(plot.compassDirection).to.be.null;
      expect(plot.notes).to.be.null;
    });

    it('should fetch companion rules for plants in garden', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: {
              id: profileId1,
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'medium',
            },
          },
          {
            id: plotId2,
            x: 3,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: {
              id: profileId2,
              name: 'Basil',
              species: null,
              type: 'herb',
              sunlight_requirements: 'full_sun',
              spacing_inches: 12,
              plant_family: 'Lamiaceae',
              zone_min: 4,
              zone_max: 10,
              difficulty: 'easy',
            },
          },
        ],
      };

      const mockCompanions = [
        {
          plantA: { name: 'Tomato' },
          plantB: { name: 'Basil' },
          relationship: 'beneficial',
          notes: 'Basil repels tomato pests',
        },
      ];

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves(mockCompanions);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.companionRules).to.have.length(1);
      expect(context.companionRules[0]).to.deep.equal({
        plantAName: 'Tomato',
        plantBName: 'Basil',
        relationship: 'beneficial',
        notes: 'Basil repels tomato pests',
      });

      // Verify the companion query was called with correct plant IDs
      expect(companionFindAllStub.calledOnce).to.be.true;
    });

    it('should fetch seasonal tips filtered by zone', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: '5b',
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: {
              id: profileId1,
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'medium',
            },
          },
        ],
      };

      const mockTips = [
        {
          plantProfile: { name: 'Tomato' },
          season: 'spring',
          tip_text: 'Start seeds indoors 6 weeks before last frost',
          timing_weeks: 6,
          priority: 1,
        },
        {
          plantProfile: { name: 'Tomato' },
          season: 'summer',
          tip_text: 'Water deeply once a week',
          timing_weeks: null,
          priority: 2,
        },
      ];

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves(mockTips);

      const context = await builder.build(gardenId, userId);

      expect(context.seasonalTips).to.have.length(2);
      expect(context.seasonalTips[0]).to.deep.equal({
        plantName: 'Tomato',
        season: 'spring',
        tip: 'Start seeds indoors 6 weeks before last frost',
        timing: 6,
      });
      expect(context.seasonalTips[1]).to.deep.equal({
        plantName: 'Tomato',
        season: 'summer',
        tip: 'Water deeply once a week',
        timing: null,
      });
    });

    it('should calculate metrics correctly', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: '5a',
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: {
              id: profileId1,
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'medium',
            },
          },
          {
            id: plotId2,
            x: 4,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: {
              id: profileId2,
              name: 'Pepper',
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 18,
              plant_family: 'Solanaceae',
              zone_min: 6, // Zone min is 6, but garden is 5a - compatibility issue
              zone_max: 10,
              difficulty: 'medium',
            },
          },
          {
            id: uuidv4(),
            x: 8,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: null, // Empty plot
          },
        ],
      };

      const mockCompanions = [
        {
          plantA: { name: 'Tomato' },
          plantB: { name: 'Pepper' },
          relationship: 'harmful',
          notes: 'Both attract same pests',
        },
      ];

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves(mockCompanions);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.metrics.totalPlots).to.equal(3);
      expect(context.metrics.occupiedPlots).to.equal(2);
      expect(context.metrics.uniquePlants).to.equal(2); // Tomato and Pepper
      expect(context.metrics.averageSpacing).to.be.greaterThan(0);
      expect(context.metrics.zoneCompatibilityIssues).to.equal(1); // Pepper
      expect(context.metrics.companionConflicts).to.equal(1); // Tomato-Pepper
    });

    it('should handle empty garden (no plots)', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Empty Garden',
        width: 10,
        height: 10,
        zone: null,
        plots: [],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.plots).to.have.length(0);
      expect(context.companionRules).to.have.length(0);
      expect(context.seasonalTips).to.have.length(0);
      expect(context.metrics.totalPlots).to.equal(0);
      expect(context.metrics.occupiedPlots).to.equal(0);
      expect(context.metrics.uniquePlants).to.equal(0);
      expect(context.metrics.averageSpacing).to.be.null;
      expect(context.metrics.zoneCompatibilityIssues).to.equal(0);
      expect(context.metrics.companionConflicts).to.equal(0);
    });

    it('should handle garden with only empty plots', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: null,
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
          {
            id: plotId2,
            x: 3,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: null,
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.plots).to.have.length(2);
      expect(context.companionRules).to.have.length(0);
      expect(context.seasonalTips).to.have.length(0);
      expect(context.metrics.totalPlots).to.equal(2);
      expect(context.metrics.occupiedPlots).to.equal(0);
      expect(context.metrics.uniquePlants).to.equal(0);
    });
  });

  describe('build() - error handling', () => {
    it('should throw error when garden not found', async () => {
      gardenFindOneStub.resolves(null);
      userFindStub.resolves({ id: userId, growing_zone: '5a', tz: 'UTC' });

      try {
        await builder.build(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('Garden not found or access denied');
      }
    });

    it('should throw error when garden belongs to different user', async () => {
      const wrongUserId = uuidv4();
      gardenFindOneStub.resolves(null); // findOne with userId mismatch returns null

      try {
        await builder.build(gardenId, wrongUserId);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('Garden not found or access denied');
      }
    });

    it('should throw error when user not found', async () => {
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [],
      };

      gardenFindOneStub.resolves(mockGarden);
      userFindStub.resolves(null);

      try {
        await builder.build(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('User not found');
      }
    });
  });

  describe('metrics calculation edge cases', () => {
    it('should calculate averageSpacing as null for single plot', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      // With only 1 plot, there are no pairs to calculate spacing
      expect(context.metrics.averageSpacing).to.be.null;
    });

    it('should handle zone compatibility when garden zone is null', async () => {
      const mockUser = { id: userId, growing_zone: null, tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: {
              id: profileId1,
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'medium',
            },
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      // No zone compatibility issues when zone is not set
      expect(context.metrics.zoneCompatibilityIssues).to.equal(0);
    });

    it('should count duplicate plant names correctly in uniquePlants', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: {
              id: profileId1,
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'medium',
            },
          },
          {
            id: plotId2,
            x: 3,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planted',
            notes: null,
            plantProfile: {
              id: profileId1, // Same profile ID
              name: 'Tomato', // Same name
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'medium',
            },
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      // Two tomato plants, but uniquePlants should be 1
      expect(context.metrics.uniquePlants).to.equal(1);
    });
  });

  describe('status field handling', () => {
    it('should include status field in plot context', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planted',
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.plots[0].status).to.equal('planted');
    });

    it('should calculate status metrics correctly (planned/planted/harvested counts)', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
          {
            id: plotId2,
            x: 3,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planted',
            notes: null,
            plantProfile: null,
          },
          {
            id: uuidv4(),
            x: 6,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'harvested',
            notes: null,
            plantProfile: null,
          },
          {
            id: uuidv4(),
            x: 9,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.metrics.plannedPlots).to.equal(2);
      expect(context.metrics.plantedPlots).to.equal(1);
      expect(context.metrics.harvestedPlots).to.equal(1);
    });

    it('should handle mixed status plots', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planted',
            notes: null,
            plantProfile: {
              id: profileId1,
              name: 'Tomato',
              species: null,
              type: 'vegetable',
              sunlight_requirements: 'full_sun',
              spacing_inches: 24,
              plant_family: 'Solanaceae',
              zone_min: 3,
              zone_max: 9,
              difficulty: 'medium',
            },
          },
          {
            id: plotId2,
            x: 3,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            status: 'planned',
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.plots[0].status).to.equal('planted');
      expect(context.plots[1].status).to.equal('planned');
      expect(context.metrics.plantedPlots).to.equal(1);
      expect(context.metrics.plannedPlots).to.equal(1);
      expect(context.metrics.harvestedPlots).to.equal(0);
    });

    it('should default status to "planned" when status field is missing', async () => {
      const mockUser = { id: userId, growing_zone: '5a', tz: 'UTC' };
      const mockGarden = {
        id: gardenId,
        name: 'Test',
        width: 10,
        height: 10,
        zone: null,
        plots: [
          {
            id: plotId1,
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            compass_direction: 'N',
            // status field missing
            notes: null,
            plantProfile: null,
          },
        ],
      };

      userFindStub.resolves(mockUser);
      gardenFindOneStub.resolves(mockGarden);
      companionFindAllStub.resolves([]);
      tipsFindAllStub.resolves([]);

      const context = await builder.build(gardenId, userId);

      expect(context.plots[0].status).to.equal('planned');
    });
  });
});
