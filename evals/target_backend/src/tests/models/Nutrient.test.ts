import { Nutrient, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Nutrient Model', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe('Creation', () => {
    it('should create a user-owned nutrient with required fields', async () => {
      const nutrientData = {
        user_id: testUser.id,
        brand: 'Custom Brand',
        product_name: 'My Special Mix',
      };

      const nutrient = await Nutrient.create(nutrientData);

      expect(nutrient).to.exist;
      expect(nutrient.brand).to.equal(nutrientData.brand);
      expect(nutrient.product_name).to.equal(nutrientData.product_name);
      expect(nutrient.user_id).to.equal(testUser.id);
      expect(nutrient.type).to.equal('base'); // default value
      expect(nutrient.is_organic).to.equal(false); // default value
    });

    it('should create a system nutrient (user_id null)', async () => {
      const uniqueSuffix = Date.now();
      const nutrientData = {
        user_id: null,
        brand: `Test System Brand ${uniqueSuffix}`,
        product_name: `Test System Product ${uniqueSuffix}`,
        type: 'base' as const,
        npk_ratio: '2-1-6',
        is_organic: false,
      };

      const nutrient = await Nutrient.create(nutrientData);

      expect(nutrient).to.exist;
      expect(nutrient.user_id).to.be.null;
      expect(nutrient.brand).to.equal(nutrientData.brand);
      expect(nutrient.product_name).to.equal(nutrientData.product_name);
      expect(nutrient.npk_ratio).to.equal(nutrientData.npk_ratio);
    });

    it('should create a nutrient with all fields', async () => {
      const nutrientData = {
        user_id: testUser.id,
        brand: 'Fox Farm',
        product_name: 'Tiger Bloom',
        type: 'supplement' as const,
        npk_ratio: '2-8-4',
        description: 'Flowering booster',
        is_organic: true,
      };

      const nutrient = await Nutrient.create(nutrientData);

      expect(nutrient).to.exist;
      expect(nutrient.brand).to.equal(nutrientData.brand);
      expect(nutrient.product_name).to.equal(nutrientData.product_name);
      expect(nutrient.type).to.equal(nutrientData.type);
      expect(nutrient.npk_ratio).to.equal(nutrientData.npk_ratio);
      expect(nutrient.description).to.equal(nutrientData.description);
      expect(nutrient.is_organic).to.equal(nutrientData.is_organic);
    });
  });

  describe('Validation', () => {
    it('should require brand', async () => {
      const nutrientData = {
        user_id: testUser.id,
        product_name: 'Test Product',
      };

      await expect(Nutrient.create(nutrientData)).rejected;
    });

    it('should require product_name', async () => {
      const nutrientData = {
        user_id: testUser.id,
        brand: 'Test Brand',
      };

      await expect(Nutrient.create(nutrientData)).rejected;
    });

    it('should validate type enum', async () => {
      const nutrientData = {
        user_id: testUser.id,
        brand: 'Test Brand',
        product_name: 'Test Product',
        type: 'invalid' as any,
      };

      await expect(Nutrient.create(nutrientData)).rejected;

      // Valid types
      const validTypes = ['base', 'supplement', 'additive', 'ph_adjuster', 'other'];
      for (const type of validTypes) {
        const validNutrient = await Nutrient.create({
          user_id: testUser.id,
          brand: 'Test Brand',
          product_name: `Test Product ${type}`,
          type: type as any,
        });
        expect(validNutrient.type).to.equal(type);
      }
    });

    it('should not allow empty brand', async () => {
      const nutrientData = {
        user_id: testUser.id,
        brand: '',
        product_name: 'Test Product',
      };

      await expect(Nutrient.create(nutrientData)).rejected;
    });

    it('should not allow empty product_name', async () => {
      const nutrientData = {
        user_id: testUser.id,
        brand: 'Test Brand',
        product_name: '',
      };

      await expect(Nutrient.create(nutrientData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a user', async () => {
      const nutrient = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand',
        product_name: 'Test Product',
      });

      const nutrientWithUser = await Nutrient.findOne({
        where: { id: nutrient.id },
        include: [{ model: User, as: 'owner' }],
      });

      expect(nutrientWithUser).to.exist;
      expect((nutrientWithUser as any)?.owner).to.exist;
      expect((nutrientWithUser as any)?.owner?.id).to.equal(testUser.id);
    });

    it('should allow null user_id for system nutrients', async () => {
      const uniqueSuffix = Date.now();
      const nutrient = await Nutrient.create({
        user_id: null,
        brand: `System Brand ${uniqueSuffix}`,
        product_name: `System Product ${uniqueSuffix}`,
      });

      expect(nutrient).to.exist;
      expect(nutrient.user_id).to.be.null;
    });

    it('should not create nutrient with non-existent user', async () => {
      const nutrientData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        brand: 'Test Brand',
        product_name: 'Test Product',
      };

      await expect(Nutrient.create(nutrientData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update nutrient details', async () => {
      const nutrient = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Original Brand',
        product_name: 'Original Product',
        type: 'base',
      });

      const updates = {
        brand: 'Updated Brand',
        product_name: 'Updated Product',
        type: 'supplement' as const,
        npk_ratio: '1-2-3',
        description: 'New description',
        is_organic: true,
      };

      await nutrient.update(updates);

      expect(nutrient.brand).to.equal(updates.brand);
      expect(nutrient.product_name).to.equal(updates.product_name);
      expect(nutrient.type).to.equal(updates.type);
      expect(nutrient.npk_ratio).to.equal(updates.npk_ratio);
      expect(nutrient.description).to.equal(updates.description);
      expect(nutrient.is_organic).to.equal(updates.is_organic);
    });
  });
});
