import { GrowEnvironment, User, Grow } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('GrowEnvironment Model', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe('Creation', () => {
    it('should create an environment with only required fields', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Main Tent',
        type: 'tent' as const,
      };

      const environment = await GrowEnvironment.create(envData);

      expect(environment).to.exist;
      expect(environment.name).to.equal(envData.name);
      expect(environment.type).to.equal(envData.type);
      expect(environment.user_id).to.equal(testUser.id);
      expect(environment.is_active).to.equal(true); // default value
      expect(environment.has_carbon_filter).to.equal(false); // default value
      expect(environment.has_humidifier).to.equal(false); // default value
      expect(environment.has_dehumidifier).to.equal(false); // default value
      expect(environment.has_ac).to.equal(false); // default value
      expect(environment.has_heater).to.equal(false); // default value
    });

    it('should create an environment with all fields', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Flower Room',
        type: 'room' as const,
        width_inches: 48,
        depth_inches: 96,
        height_inches: 80,
        light_type: 'led' as const,
        light_wattage: 1000,
        ventilation_cfm: 400,
        has_carbon_filter: true,
        has_humidifier: true,
        has_dehumidifier: false,
        has_ac: true,
        has_heater: false,
        max_plants: 12,
        notes: 'Dedicated flowering space with climate control',
        is_active: true,
      };

      const environment = await GrowEnvironment.create(envData);

      expect(environment).to.exist;
      expect(environment.name).to.equal(envData.name);
      expect(environment.type).to.equal(envData.type);
      expect(environment.width_inches).to.equal(envData.width_inches);
      expect(environment.depth_inches).to.equal(envData.depth_inches);
      expect(environment.height_inches).to.equal(envData.height_inches);
      expect(environment.light_type).to.equal(envData.light_type);
      expect(environment.light_wattage).to.equal(envData.light_wattage);
      expect(environment.ventilation_cfm).to.equal(envData.ventilation_cfm);
      expect(environment.has_carbon_filter).to.equal(envData.has_carbon_filter);
      expect(environment.has_humidifier).to.equal(envData.has_humidifier);
      expect(environment.has_dehumidifier).to.equal(envData.has_dehumidifier);
      expect(environment.has_ac).to.equal(envData.has_ac);
      expect(environment.has_heater).to.equal(envData.has_heater);
      expect(environment.max_plants).to.equal(envData.max_plants);
      expect(environment.notes).to.equal(envData.notes);
      expect(environment.is_active).to.equal(envData.is_active);
    });

    it('should create environments with different types', async () => {
      const types = ['tent', 'room', 'closet', 'outdoor', 'greenhouse'];

      for (const type of types) {
        const environment = await GrowEnvironment.create({
          user_id: testUser.id,
          name: `Test ${type}`,
          type: type as any,
        });
        expect(environment.type).to.equal(type);
      }
    });
  });

  describe('Validation', () => {
    it('should require name', async () => {
      const envData = {
        user_id: testUser.id,
        type: 'tent' as const,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });

    it('should require user_id', async () => {
      const envData = {
        name: 'Test Tent',
        type: 'tent' as const,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });

    it('should validate type enum', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Environment',
        type: 'invalid' as any,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });

    it('should validate light_type enum', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Environment',
        type: 'tent' as const,
        light_type: 'invalid' as any,
      };

      await expect(GrowEnvironment.create(envData)).rejected;

      // Valid values
      const validLights = ['led', 'hps', 'mh', 'cfl', 'sun', 'other'];
      for (const light of validLights) {
        const validEnv = await GrowEnvironment.create({
          user_id: testUser.id,
          name: `Test ${light}`,
          type: 'tent' as const,
          light_type: light as any,
        });
        expect(validEnv.light_type).to.equal(light);
      }
    });

    it('should validate name length', async () => {
      const tooLongName = 'a'.repeat(101);
      const envData = {
        user_id: testUser.id,
        name: tooLongName,
        type: 'tent' as const,
      };

      await expect(GrowEnvironment.create(envData)).rejected;

      // Valid 100-character name should work
      const validName = 'a'.repeat(100);
      const validEnv = await GrowEnvironment.create({
        user_id: testUser.id,
        name: validName,
        type: 'tent' as const,
      });
      expect(validEnv.name).to.equal(validName);
    });

    it('should validate width_inches is positive', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Tent',
        type: 'tent' as const,
        width_inches: 0,
      };

      await expect(GrowEnvironment.create(envData)).rejected;

      // Negative should also fail
      await expect(
        GrowEnvironment.create({
          ...envData,
          width_inches: -10,
        })
      ).rejected;
    });

    it('should validate depth_inches is positive', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Tent',
        type: 'tent' as const,
        depth_inches: 0,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });

    it('should validate height_inches is positive', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Tent',
        type: 'tent' as const,
        height_inches: 0,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });

    it('should validate light_wattage is positive', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Tent',
        type: 'tent' as const,
        light_wattage: 0,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });

    it('should validate ventilation_cfm is positive', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Tent',
        type: 'tent' as const,
        ventilation_cfm: 0,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });

    it('should validate max_plants is positive', async () => {
      const envData = {
        user_id: testUser.id,
        name: 'Test Tent',
        type: 'tent' as const,
        max_plants: 0,
      };

      await expect(GrowEnvironment.create(envData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should belong to a user', async () => {
      const environment = await GrowEnvironment.create({
        user_id: testUser.id,
        name: 'Association Test Tent',
        type: 'tent' as const,
      });

      const envWithUser = await GrowEnvironment.findByPk(environment.id, {
        include: [{ model: User, as: 'owner' }],
      });

      expect(envWithUser).to.exist;
      expect(envWithUser!.owner).to.exist;
      expect(envWithUser!.owner!.id).to.equal(testUser.id);
    });

    it('should have many grows', async () => {
      const environment = await GrowEnvironment.create({
        user_id: testUser.id,
        name: 'Multi-Grow Tent',
        type: 'tent' as const,
      });

      // Create multiple grows in this environment
      const grow1 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        started_at: new Date(),
        environment_id: environment.id,
      });

      const grow2 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 2',
        started_at: new Date(),
        environment_id: environment.id,
      });

      const envWithGrows = await GrowEnvironment.findByPk(environment.id, {
        include: [{ model: Grow, as: 'grows' }],
      });

      expect(envWithGrows).to.exist;
      expect(envWithGrows!.grows).to.exist;
      expect(envWithGrows!.grows!.length).to.equal(2);
      expect(envWithGrows!.grows!.map((g: any) => g.id)).to.include(grow1.id);
      expect(envWithGrows!.grows!.map((g: any) => g.id)).to.include(grow2.id);
    });

    it('should cascade delete when user is deleted', async () => {
      const tempUser = await testHelper.createTestUser();

      const environment = await GrowEnvironment.create({
        user_id: tempUser.id,
        name: 'Temp User Tent',
        type: 'tent' as const,
      });

      const envId = environment.id;

      // Delete the user
      await tempUser.destroy();

      // Environment should be deleted too
      const deletedEnv = await GrowEnvironment.findByPk(envId);
      expect(deletedEnv).to.be.null;
    });

    it('should set grows environment_id to null when environment is deleted', async () => {
      const environment = await GrowEnvironment.create({
        user_id: testUser.id,
        name: 'Deletable Tent',
        type: 'tent' as const,
      });

      const grow = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain',
        started_at: new Date(),
        environment_id: environment.id,
      });

      expect(grow.environment_id).to.equal(environment.id);

      // Delete the environment
      await environment.destroy();

      // Grow should still exist but with null environment_id
      const updatedGrow = await Grow.findByPk(grow.id);
      expect(updatedGrow).to.exist;
      expect(updatedGrow!.environment_id).to.be.null;
    });
  });

  describe('Updates', () => {
    it('should update environment fields', async () => {
      const environment = await GrowEnvironment.create({
        user_id: testUser.id,
        name: 'Original Name',
        type: 'tent' as const,
        width_inches: 24,
        depth_inches: 24,
      });

      await environment.update({
        name: 'Updated Name',
        width_inches: 48,
        depth_inches: 48,
        has_carbon_filter: true,
      });

      const updated = await GrowEnvironment.findByPk(environment.id);
      expect(updated!.name).to.equal('Updated Name');
      expect(updated!.width_inches).to.equal(48);
      expect(updated!.depth_inches).to.equal(48);
      expect(updated!.has_carbon_filter).to.equal(true);
    });

    it('should allow setting equipment flags', async () => {
      const environment = await GrowEnvironment.create({
        user_id: testUser.id,
        name: 'Equipment Test',
        type: 'room' as const,
      });

      await environment.update({
        has_carbon_filter: true,
        has_humidifier: true,
        has_dehumidifier: true,
        has_ac: true,
        has_heater: true,
      });

      const updated = await GrowEnvironment.findByPk(environment.id);
      expect(updated!.has_carbon_filter).to.equal(true);
      expect(updated!.has_humidifier).to.equal(true);
      expect(updated!.has_dehumidifier).to.equal(true);
      expect(updated!.has_ac).to.equal(true);
      expect(updated!.has_heater).to.equal(true);
    });

    it('should allow deactivating environment', async () => {
      const environment = await GrowEnvironment.create({
        user_id: testUser.id,
        name: 'Active Tent',
        type: 'tent' as const,
      });

      expect(environment.is_active).to.equal(true);

      await environment.update({ is_active: false });

      const updated = await GrowEnvironment.findByPk(environment.id);
      expect(updated!.is_active).to.equal(false);
    });
  });
});
