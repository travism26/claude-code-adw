import { Plant, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Plant Model', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe('Creation', () => {
    it('should create a plant with required fields', async () => {
      const user = await User.create({
        email: `test1-${Date.now()}@example.com`,
        password_hash: 'password123',
        tz: 'UTC',
      });

      const plantData = {
        user_id: user.id,
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 7,
      };

      const plant = await Plant.create(plantData);

      expect(plant).to.exist;
      expect(plant.name).to.equal(plantData.name);
      expect(plant.type).to.equal(plantData.type);
      expect(plant.water_interval_days).to.equal(plantData.water_interval_days);
      expect(plant.user_id).to.equal(user.id);
    });

    it('should create a plant with all fields', async () => {
      const plantData = {
        user_id: testUser.id,
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 7,
        fert_interval_days: 30,
        species: 'Test Species',
        photo_url: 'https://example.com/photo.jpg',
        last_watered: new Date(),
        last_fertilized: new Date(),
      };

      const plant = await Plant.create(plantData);

      expect(plant).to.exist;
      expect(plant.name).to.equal(plantData.name);
      expect(plant.type).to.equal(plantData.type);
      expect(plant.water_interval_days).to.equal(plantData.water_interval_days);
      expect(plant.fert_interval_days).to.equal(plantData.fert_interval_days);
      expect(plant.species).to.equal(plantData.species);
      expect(plant.photo_url).to.equal(plantData.photo_url);
      expect(plant.last_watered?.getTime()).to.equal(
        plantData.last_watered.getTime()
      );
      expect(plant.last_fertilized?.getTime()).to.equal(
        plantData.last_fertilized.getTime()
      );
    });
  });

  describe('Validation', () => {
    it('should require a name', async () => {
      const plantData = {
        user_id: testUser.id,
        type: 'indoor',
        water_interval_days: 7,
      };

      await expect(Plant.create(plantData)).rejected;
    });

    it('should validate plant type', async () => {
      const plantData = {
        user_id: testUser.id,
        name: 'Test Plant',
        type: 'invalid',
        water_interval_days: 7,
      };

      await expect(Plant.create(plantData)).rejected;
    });

    it('should validate water interval range', async () => {
      const plantData = {
        user_id: testUser.id,
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 0,
      };

      await expect(Plant.create(plantData)).rejected;

      plantData.water_interval_days = 366;
      await expect(Plant.create(plantData)).rejected;
    });

    it('should validate fertilizer interval range if provided', async () => {
      const plantData = {
        user_id: testUser.id,
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 7,
        fert_interval_days: 0,
      };

      await expect(Plant.create(plantData)).rejected;

      plantData.fert_interval_days = 366;
      await expect(Plant.create(plantData)).rejected;
    });

    it('should validate photo URL format if provided', async () => {
      const plantData = {
        user_id: testUser.id,
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 7,
        photo_url: 'invalid-url',
      };

      await expect(Plant.create(plantData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a user', async () => {
      const plant = await Plant.create({
        user_id: testUser.id,
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 7,
      });

      const plantWithUser = await Plant.findOne({
        where: { id: plant.id },
        include: [{ model: User, as: 'owner' }],
      });

      expect(plantWithUser).to.exist;
      expect(plantWithUser?.owner).to.exist;
      expect(plantWithUser?.owner?.id).to.equal(testUser.id);
    });

    it('should not create plant with non-existent user', async () => {
      const plantData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 7,
      };

      await expect(Plant.create(plantData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update plant details', async () => {
      const plant = await Plant.create({
        user_id: testUser.id,
        name: 'Test Plant',
        type: 'indoor',
        water_interval_days: 7,
      });

      const updates = {
        name: 'Updated Plant',
        water_interval_days: 14,
        last_watered: new Date(),
      };

      await plant.update(updates);

      expect(plant.name).to.equal(updates.name);
      expect(plant.water_interval_days).to.equal(updates.water_interval_days);
      expect(plant.last_watered?.getTime()).to.equal(
        updates.last_watered.getTime()
      );
    });
  });
});
