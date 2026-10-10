import { Plot, Garden, PlantProfile, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Plot Model', () => {
  let testUser: User;
  let testGarden: Garden;
  let testPlantProfile: PlantProfile;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testGarden = await Garden.create({
      user_id: testUser.id,
      name: 'Test Garden',
      width: 20,
      height: 15,
    });
    testPlantProfile = await PlantProfile.create({
      name: 'Tomato',
      common_name: 'Tomato',
      type: 'vegetable',
      default_water_interval_days: 3,
      difficulty: 'easy',
      indoor_outdoor: 'outdoor',
    });
  });

  describe('Creation', () => {
    it('should create a plot with required fields', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
      };

      const plot = await Plot.create(plotData);

      expect(plot).to.exist;
      expect(Number(plot.x)).to.equal(plotData.x);
      expect(Number(plot.y)).to.equal(plotData.y);
      expect(Number(plot.width)).to.equal(plotData.width);
      expect(Number(plot.height)).to.equal(plotData.height);
      expect(plot.garden_id).to.equal(testGarden.id);
      expect(plot.plant_profile_id).to.be.null;
    });

    it('should create a plot with all fields', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 5,
        y: 5,
        width: 3.5,
        height: 4.2,
        plant_profile_id: testPlantProfile.id,
        notes: 'Sunny corner plot',
      };

      const plot = await Plot.create(plotData);

      expect(plot).to.exist;
      expect(Number(plot.x)).to.equal(plotData.x);
      expect(Number(plot.y)).to.equal(plotData.y);
      expect(Number(plot.width)).to.equal(plotData.width);
      expect(Number(plot.height)).to.equal(plotData.height);
      expect(plot.plant_profile_id).to.equal(testPlantProfile.id);
      expect(plot.notes).to.equal(plotData.notes);
    });
  });

  describe('Validation', () => {
    it('should require x coordinate', async () => {
      const plotData = {
        garden_id: testGarden.id,
        y: 0,
        width: 2,
        height: 2,
      };

      await expect(Plot.create(plotData)).rejected;
    });

    it('should require y coordinate', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        width: 2,
        height: 2,
      };

      await expect(Plot.create(plotData)).rejected;
    });

    it('should validate x coordinate minimum (0)', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: -1,
        y: 0,
        width: 2,
        height: 2,
      };

      await expect(Plot.create(plotData)).rejected;
    });

    it('should validate y coordinate minimum (0)', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: -1,
        width: 2,
        height: 2,
      };

      await expect(Plot.create(plotData)).rejected;
    });

    it('should validate width minimum (0.1)', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 0,
        height: 2,
      };

      await expect(Plot.create(plotData)).rejected;
    });

    it('should validate width maximum (1000)', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 1001,
        height: 2,
      };

      await expect(Plot.create(plotData)).rejected;
    });

    it('should validate height minimum (0.1)', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 0,
      };

      await expect(Plot.create(plotData)).rejected;
    });

    it('should validate height maximum (1000)', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 1001,
      };

      await expect(Plot.create(plotData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a garden', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 10,
        y: 10,
        width: 2,
        height: 2,
      });

      const plotWithGarden = await Plot.findOne({
        where: { id: plot.id },
        include: [{ model: Garden, as: 'garden' }],
      });

      expect(plotWithGarden).to.exist;
      expect((plotWithGarden as any)?.garden).to.exist;
      expect((plotWithGarden as any)?.garden?.id).to.equal(testGarden.id);
    });

    it('should associate with a plant profile', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 12,
        y: 12,
        width: 2,
        height: 2,
        plant_profile_id: testPlantProfile.id,
      });

      const plotWithProfile = await Plot.findOne({
        where: { id: plot.id },
        include: [{ model: PlantProfile, as: 'plantProfile' }],
      });

      expect(plotWithProfile).to.exist;
      expect((plotWithProfile as any)?.plantProfile).to.exist;
      expect((plotWithProfile as any)?.plantProfile?.id).to.equal(testPlantProfile.id);
    });

    it('should not create plot with non-existent garden', async () => {
      const plotData = {
        garden_id: '00000000-0000-0000-0000-000000000000',
        x: 0,
        y: 0,
        width: 2,
        height: 2,
      };

      await expect(Plot.create(plotData)).rejected;
    });
  });

  describe('Compass Direction', () => {
    it('should create a plot with valid compass direction', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: 'N',
      };

      const plot = await Plot.create(plotData);

      expect(plot).to.exist;
      expect(plot.compass_direction).to.equal('N');
    });

    it('should create a plot without compass direction (null)', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
      };

      const plot = await Plot.create(plotData);

      expect(plot).to.exist;
      expect(plot.compass_direction).to.be.null;
    });

    it('should accept all 8 valid compass directions', async () => {
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

      for (const direction of directions) {
        const plot = await Plot.create({
          garden_id: testGarden.id,
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          compass_direction: direction,
        });

        expect(plot.compass_direction).to.equal(direction);
      }
    });

    it('should reject invalid compass direction values', async () => {
      const invalidDirections = ['North', 'NORTH', 'n', 'X', 'NNE', 'NorthEast'];

      for (const direction of invalidDirections) {
        const plotData = {
          garden_id: testGarden.id,
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          compass_direction: direction,
        };

        await expect(Plot.create(plotData)).rejected;
      }
    });

    it('should update plot compass direction', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: 'N',
      });

      await plot.update({ compass_direction: 'S' });

      expect(plot.compass_direction).to.equal('S');
    });

    it('should update compass direction to null', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: 'N',
      });

      await plot.update({ compass_direction: null });

      expect(plot.compass_direction).to.be.null;
    });
  });

  describe('Status Field', () => {
    it('should create plot with default status "planned"', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
      };

      const plot = await Plot.create(plotData);

      expect(plot).to.exist;
      expect(plot.status).to.equal('planned');
    });

    it('should allow valid status values (planned, planted, harvested, archived)', async () => {
      const statuses = ['planned', 'planted', 'harvested', 'archived'];

      for (const status of statuses) {
        const plot = await Plot.create({
          garden_id: testGarden.id,
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          status: status as any,
        });

        expect(plot.status).to.equal(status);
      }
    });

    it('should reject invalid status values', async () => {
      const invalidStatuses = ['growing', 'planting', 'invalid', 'PLANNED', 'Planned'];

      for (const status of invalidStatuses) {
        const plotData = {
          garden_id: testGarden.id,
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          status: status,
        };

        await expect(Plot.create(plotData)).rejected;
      }
    });

    it('should allow updating plot status', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        status: 'planned',
      });

      await plot.update({ status: 'planted' });
      expect(plot.status).to.equal('planted');

      await plot.update({ status: 'harvested' });
      expect(plot.status).to.equal('harvested');

      await plot.update({ status: 'archived' });
      expect(plot.status).to.equal('archived');
    });
  });

  describe('Updates', () => {
    it('should update plot details', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 1,
        y: 1,
        width: 2,
        height: 2,
      });

      const updates = {
        x: 3,
        y: 4,
        width: 5,
        height: 6,
        notes: 'Updated plot notes',
      };

      await plot.update(updates);

      expect(Number(plot.x)).to.equal(updates.x);
      expect(Number(plot.y)).to.equal(updates.y);
      expect(Number(plot.width)).to.equal(updates.width);
      expect(Number(plot.height)).to.equal(updates.height);
      expect(plot.notes).to.equal(updates.notes);
    });
  });

  describe('toJSON() conversion', () => {
    it('should convert DECIMAL string coordinates to numbers', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 10.5,
        y: 20.25,
        width: 3.75,
        height: 4.5,
      };

      const plot = await Plot.create(plotData);
      const json = plot.toJSON();

      // Verify all coordinate fields are JavaScript numbers
      expect(typeof json.x).to.equal('number');
      expect(typeof json.y).to.equal('number');
      expect(typeof json.width).to.equal('number');
      expect(typeof json.height).to.equal('number');

      // Verify values match expected
      expect(json.x).to.equal(10.5);
      expect(json.y).to.equal(20.25);
      expect(json.width).to.equal(3.75);
      expect(json.height).to.equal(4.5);
    });

    it('should handle all DECIMAL fields correctly with various values', async () => {
      const testCases = [
        { x: 0, y: 0, width: 0.1, height: 0.1 },
        { x: 0.5, y: 0.5, width: 1, height: 1 },
        { x: 10.25, y: 15.75, width: 5.5, height: 8.25 },
        { x: 999.99, y: 999.99, width: 1000, height: 1000 },
      ];

      for (const testCase of testCases) {
        const plot = await Plot.create({
          garden_id: testGarden.id,
          ...testCase,
        });

        const json = plot.toJSON();

        // Verify all values are numbers
        expect(typeof json.x).to.equal('number');
        expect(typeof json.y).to.equal('number');
        expect(typeof json.width).to.equal('number');
        expect(typeof json.height).to.equal('number');

        // Verify values are correct
        expect(json.x).to.equal(testCase.x);
        expect(json.y).to.equal(testCase.y);
        expect(json.width).to.equal(testCase.width);
        expect(json.height).to.equal(testCase.height);
      }
    });

    it('should preserve non-DECIMAL fields', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 5,
        y: 5,
        width: 3,
        height: 3,
        plant_profile_id: testPlantProfile.id,
        notes: 'Test plot notes',
        compass_direction: 'N',
      };

      const plot = await Plot.create(plotData);
      const json = plot.toJSON();

      // Verify non-DECIMAL fields are preserved
      expect(json.id).to.equal(plot.id);
      expect(json.garden_id).to.equal(testGarden.id);
      expect(json.plant_profile_id).to.equal(testPlantProfile.id);
      expect(json.notes).to.equal('Test plot notes');
      expect(json.compass_direction).to.equal('N');
      expect(json.created_at).to.exist;
      expect(json.updated_at).to.exist;
    });

    it('should handle null optional fields correctly', async () => {
      const plotData = {
        garden_id: testGarden.id,
        x: 5,
        y: 5,
        width: 3,
        height: 3,
        plant_profile_id: null,
        notes: null,
        compass_direction: null,
      };

      const plot = await Plot.create(plotData);
      const json = plot.toJSON();

      // Verify null fields are preserved
      expect(json.plant_profile_id).to.be.null;
      expect(json.notes).to.be.null;
      expect(json.compass_direction).to.be.null;

      // Verify coordinate fields are still numbers
      expect(typeof json.x).to.equal('number');
      expect(typeof json.y).to.equal('number');
      expect(typeof json.width).to.equal('number');
      expect(typeof json.height).to.equal('number');
    });

    it('should work correctly with JSON.stringify()', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 10.5,
        y: 20.25,
        width: 3.75,
        height: 4.5,
      });

      // JSON.stringify uses toJSON() internally
      const jsonString = JSON.stringify(plot);
      const parsed = JSON.parse(jsonString);

      // Verify parsed values are numbers
      expect(typeof parsed.x).to.equal('number');
      expect(typeof parsed.y).to.equal('number');
      expect(typeof parsed.width).to.equal('number');
      expect(typeof parsed.height).to.equal('number');

      expect(parsed.x).to.equal(10.5);
      expect(parsed.y).to.equal(20.25);
      expect(parsed.width).to.equal(3.75);
      expect(parsed.height).to.equal(4.5);
    });
  });
});
