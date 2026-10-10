import { Garden, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Garden Model', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe('Creation', () => {
    it('should create a garden with required fields', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'My Vegetable Garden',
        width: 10,
        height: 8,
      };

      const garden = await Garden.create(gardenData);

      expect(garden).to.exist;
      expect(garden.name).to.equal(gardenData.name);
      expect(Number(garden.width)).to.equal(gardenData.width);
      expect(Number(garden.height)).to.equal(gardenData.height);
      expect(garden.user_id).to.equal(testUser.id);
      expect(garden.zone).to.be.null;
    });

    it('should create a garden with all fields', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'Herb Garden',
        width: 5.5,
        height: 4.2,
        zone: '7b',
        notes: 'Sunny spot in backyard',
      };

      const garden = await Garden.create(gardenData);

      expect(garden).to.exist;
      expect(garden.name).to.equal(gardenData.name);
      expect(Number(garden.width)).to.equal(gardenData.width);
      expect(Number(garden.height)).to.equal(gardenData.height);
      expect(garden.zone).to.equal(gardenData.zone);
      expect(garden.notes).to.equal(gardenData.notes);
    });
  });

  describe('Validation', () => {
    it('should require a name', async () => {
      const gardenData = {
        user_id: testUser.id,
        width: 10,
        height: 10,
      };

      await expect(Garden.create(gardenData)).rejected;
    });

    it('should validate name length (max 100 characters)', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'a'.repeat(101),
        width: 10,
        height: 10,
      };

      await expect(Garden.create(gardenData)).rejected;
    });

    it('should validate width minimum (0.1)', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'Test Garden',
        width: 0,
        height: 10,
      };

      await expect(Garden.create(gardenData)).rejected;
    });

    it('should validate width maximum (10000)', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'Test Garden',
        width: 10001,
        height: 10,
      };

      await expect(Garden.create(gardenData)).rejected;
    });

    it('should validate height minimum (0.1)', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'Test Garden',
        width: 10,
        height: 0,
      };

      await expect(Garden.create(gardenData)).rejected;
    });

    it('should validate height maximum (10000)', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'Test Garden',
        width: 10,
        height: 10001,
      };

      await expect(Garden.create(gardenData)).rejected;
    });

    it('should validate zone format (valid USDA zones)', async () => {
      const gardenData = {
        user_id: testUser.id,
        name: 'Test Garden',
        width: 10,
        height: 10,
        zone: 'invalid',
      };

      await expect(Garden.create(gardenData)).rejected;

      // Valid zone formats
      gardenData.zone = '5a';
      const garden1 = await Garden.create(gardenData);
      expect(garden1).to.exist;

      gardenData.zone = '10b';
      gardenData.name = 'Test Garden 2';
      const garden2 = await Garden.create(gardenData);
      expect(garden2).to.exist;

      gardenData.zone = '7';
      gardenData.name = 'Test Garden 3';
      const garden3 = await Garden.create(gardenData);
      expect(garden3).to.exist;
    });
  });

  describe('Associations', () => {
    it('should associate with a user', async () => {
      const garden = await Garden.create({
        user_id: testUser.id,
        name: 'Test Garden',
        width: 10,
        height: 10,
      });

      const gardenWithUser = await Garden.findOne({
        where: { id: garden.id },
        include: [{ model: User, as: 'owner' }],
      });

      expect(gardenWithUser).to.exist;
      expect((gardenWithUser as any)?.owner).to.exist;
      expect((gardenWithUser as any)?.owner?.id).to.equal(testUser.id);
    });

    it('should not create garden with non-existent user', async () => {
      const gardenData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Garden',
        width: 10,
        height: 10,
      };

      await expect(Garden.create(gardenData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update garden details', async () => {
      const garden = await Garden.create({
        user_id: testUser.id,
        name: 'Original Garden',
        width: 10,
        height: 10,
        zone: '5a',
      });

      const updates = {
        name: 'Updated Garden',
        width: 15,
        height: 12,
        zone: '7b',
        notes: 'Now with notes',
      };

      await garden.update(updates);

      expect(garden.name).to.equal(updates.name);
      expect(Number(garden.width)).to.equal(updates.width);
      expect(Number(garden.height)).to.equal(updates.height);
      expect(garden.zone).to.equal(updates.zone);
      expect(garden.notes).to.equal(updates.notes);
    });
  });
});
