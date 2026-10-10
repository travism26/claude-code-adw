import { Grow, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Grow Model', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe('Creation', () => {
    it('should create a grow with required fields', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Blue Dream',
        started_at: new Date(),
      };

      const grow = await Grow.create(growData);

      expect(grow).to.exist;
      expect(grow.strain_name).to.equal(growData.strain_name);
      expect(grow.user_id).to.equal(testUser.id);
      expect(grow.plant_count).to.equal(1); // default value
      expect(grow.phase).to.equal('germination'); // default value
      expect(grow.is_public).to.equal(false); // default value
      expect(grow.started_at).to.exist;
    });

    it('should create a grow with all fields', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'OG Kush',
        strain_type: 'indica' as const,
        grow_method: 'hydro' as const,
        grow_medium: 'Rockwool cubes',
        light_type: 'led' as const,
        light_wattage: 600,
        grow_space_sqft: 16.5,
        pot_size_gallons: 5.0,
        plant_count: 4,
        phase: 'vegetative' as const,
        phase_started_at: new Date(),
        started_at: new Date('2024-01-01'),
        notes: 'First indoor grow',
        is_public: true,
      };

      const grow = await Grow.create(growData);

      expect(grow).to.exist;
      expect(grow.strain_name).to.equal(growData.strain_name);
      expect(grow.strain_type).to.equal(growData.strain_type);
      expect(grow.grow_method).to.equal(growData.grow_method);
      expect(grow.grow_medium).to.equal(growData.grow_medium);
      expect(grow.light_type).to.equal(growData.light_type);
      expect(grow.light_wattage).to.equal(growData.light_wattage);
      expect(Number(grow.grow_space_sqft)).to.equal(growData.grow_space_sqft);
      expect(Number(grow.pot_size_gallons)).to.equal(growData.pot_size_gallons);
      expect(grow.plant_count).to.equal(growData.plant_count);
      expect(grow.phase).to.equal(growData.phase);
      expect(grow.notes).to.equal(growData.notes);
      expect(grow.is_public).to.equal(growData.is_public);
    });
  });

  describe('Validation', () => {
    it('should require strain_name', async () => {
      const growData = {
        user_id: testUser.id,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;
    });

    it('should require started_at', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
      };

      await expect(Grow.create(growData)).rejected;
    });

    it('should validate strain_type enum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        strain_type: 'invalid' as any,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;

      // Valid values
      const validTypes = ['indica', 'sativa', 'hybrid', 'ruderalis'];
      for (const type of validTypes) {
        const validGrow = await Grow.create({
          user_id: testUser.id,
          strain_name: `Test Strain ${type}`,
          strain_type: type as any,
          started_at: new Date(),
        });
        expect(validGrow.strain_type).to.equal(type);
      }
    });

    it('should validate grow_method enum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        grow_method: 'invalid' as any,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;

      // Valid values
      const validMethods = ['soil', 'coco', 'hydro', 'dwc', 'aero', 'other'];
      for (const method of validMethods) {
        const validGrow = await Grow.create({
          user_id: testUser.id,
          strain_name: `Test Strain ${method}`,
          grow_method: method as any,
          started_at: new Date(),
        });
        expect(validGrow.grow_method).to.equal(method);
      }
    });

    it('should validate light_type enum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        light_type: 'invalid' as any,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;

      // Valid values
      const validLights = ['led', 'hps', 'mh', 'cfl', 'sun', 'other'];
      for (const light of validLights) {
        const validGrow = await Grow.create({
          user_id: testUser.id,
          strain_name: `Test Strain ${light}`,
          light_type: light as any,
          started_at: new Date(),
        });
        expect(validGrow.light_type).to.equal(light);
      }
    });

    it('should validate phase enum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        phase: 'invalid' as any,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;

      // Valid values
      const validPhases = ['germination', 'vegetative', 'flowering', 'harvest', 'archived'];
      for (const phase of validPhases) {
        const validGrow = await Grow.create({
          user_id: testUser.id,
          strain_name: `Test Strain ${phase}`,
          phase: phase as any,
          started_at: new Date(),
        });
        expect(validGrow.phase).to.equal(phase);
      }
    });

    it('should validate plant_count minimum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        plant_count: 0,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;
    });

    it('should validate light_wattage minimum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        light_wattage: 0,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;
    });

    it('should validate grow_space_sqft minimum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        grow_space_sqft: 0,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;
    });

    it('should validate pot_size_gallons minimum', async () => {
      const growData = {
        user_id: testUser.id,
        strain_name: 'Test Strain',
        pot_size_gallons: 0,
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a user', async () => {
      const grow = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain',
        started_at: new Date(),
      });

      const growWithUser = await Grow.findOne({
        where: { id: grow.id },
        include: [{ model: User, as: 'owner' }],
      });

      expect(growWithUser).to.exist;
      expect((growWithUser as any)?.owner).to.exist;
      expect((growWithUser as any)?.owner?.id).to.equal(testUser.id);
    });

    it('should not create grow with non-existent user', async () => {
      const growData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        strain_name: 'Test Strain',
        started_at: new Date(),
      };

      await expect(Grow.create(growData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update grow details', async () => {
      const grow = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Original Strain',
        phase: 'germination',
        started_at: new Date(),
      });

      const updates = {
        strain_name: 'Updated Strain',
        phase: 'vegetative' as const,
        phase_started_at: new Date(),
        plant_count: 3,
        notes: 'Looking good!',
      };

      await grow.update(updates);

      expect(grow.strain_name).to.equal(updates.strain_name);
      expect(grow.phase).to.equal(updates.phase);
      expect(grow.plant_count).to.equal(updates.plant_count);
      expect(grow.notes).to.equal(updates.notes);
      expect(grow.phase_started_at).to.exist;
    });
  });

  describe('toJSON', () => {
    it('should convert DECIMAL fields to numbers', async () => {
      const grow = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain',
        grow_space_sqft: 10.5,
        pot_size_gallons: 3.5,
        started_at: new Date(),
      });

      const json = grow.toJSON();

      expect(typeof json.grow_space_sqft).to.equal('number');
      expect(json.grow_space_sqft).to.equal(10.5);
      expect(typeof json.pot_size_gallons).to.equal('number');
      expect(json.pot_size_gallons).to.equal(3.5);
    });
  });
});
