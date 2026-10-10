import { Recommendation, Plant, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Recommendation Model', () => {
  let testUser: User;
  let testPlant: Plant;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testPlant = await Plant.create({
      user_id: testUser.id,
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
    });
  });

  describe('Creation', () => {
    it('should create a recommendation with required fields', async () => {
      const recData = {
        user_id: testUser.id,
        type: 'water' as const,
        message: 'Time to water your plant!',
      };

      const recommendation = await Recommendation.create(recData);

      expect(recommendation).to.exist;
      expect(recommendation.type).to.equal(recData.type);
      expect(recommendation.message).to.equal(recData.message);
      expect(recommendation.user_id).to.equal(testUser.id);
      expect(recommendation.severity).to.equal('medium');
      expect(recommendation.plant_id).to.be.null;
    });

    it('should create a recommendation with all fields', async () => {
      const recData = {
        user_id: testUser.id,
        plant_id: testPlant.id,
        type: 'fertilize' as const,
        message: 'Your tomato needs fertilizing',
        severity: 'high' as const,
      };

      const recommendation = await Recommendation.create(recData);

      expect(recommendation).to.exist;
      expect(recommendation.type).to.equal(recData.type);
      expect(recommendation.message).to.equal(recData.message);
      expect(recommendation.severity).to.equal(recData.severity);
      expect(recommendation.plant_id).to.equal(testPlant.id);
    });
  });

  describe('Validation', () => {
    it('should require a message', async () => {
      const recData = {
        user_id: testUser.id,
        type: 'water' as const,
      };

      await expect(Recommendation.create(recData)).rejected;
    });

    it('should require a type', async () => {
      const recData = {
        user_id: testUser.id,
        message: 'Test message',
      };

      await expect(Recommendation.create(recData)).rejected;
    });

    it('should validate type enum values', async () => {
      const recData = {
        user_id: testUser.id,
        type: 'invalid' as any,
        message: 'Test message',
      };

      await expect(Recommendation.create(recData)).rejected;

      // Valid type values
      const validTypes = ['water', 'fertilize', 'prune', 'pest_check', 'harvest', 'general'];
      for (const type of validTypes) {
        const rec = await Recommendation.create({
          user_id: testUser.id,
          type: type as any,
          message: `Test ${type} message`,
        });
        expect(rec).to.exist;
        expect(rec.type).to.equal(type);
      }
    });

    it('should validate severity enum values', async () => {
      const recData = {
        user_id: testUser.id,
        type: 'water' as const,
        message: 'Test message',
        severity: 'invalid' as any,
      };

      await expect(Recommendation.create(recData)).rejected;

      // Valid severity values
      const validSeverities = ['low', 'medium', 'high'];
      for (const severity of validSeverities) {
        const rec = await Recommendation.create({
          user_id: testUser.id,
          type: 'general' as const,
          message: `Test ${severity} severity`,
          severity: severity as any,
        });
        expect(rec).to.exist;
        expect(rec.severity).to.equal(severity);
      }
    });

    it('should not allow empty message', async () => {
      const recData = {
        user_id: testUser.id,
        type: 'water' as const,
        message: '',
      };

      await expect(Recommendation.create(recData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a user', async () => {
      const recommendation = await Recommendation.create({
        user_id: testUser.id,
        type: 'water' as const,
        message: 'Test recommendation',
      });

      const recWithUser = await Recommendation.findOne({
        where: { id: recommendation.id },
        include: [{ model: User, as: 'user' }],
      });

      expect(recWithUser).to.exist;
      expect((recWithUser as any)?.user).to.exist;
      expect((recWithUser as any)?.user?.id).to.equal(testUser.id);
    });

    it('should associate with a plant', async () => {
      const recommendation = await Recommendation.create({
        user_id: testUser.id,
        plant_id: testPlant.id,
        type: 'water' as const,
        message: 'Water your plant',
      });

      const recWithPlant = await Recommendation.findOne({
        where: { id: recommendation.id },
        include: [{ model: Plant, as: 'plant' }],
      });

      expect(recWithPlant).to.exist;
      expect((recWithPlant as any)?.plant).to.exist;
      expect((recWithPlant as any)?.plant?.id).to.equal(testPlant.id);
    });

    it('should not create recommendation with non-existent user', async () => {
      const recData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        type: 'water' as const,
        message: 'Test message',
      };

      await expect(Recommendation.create(recData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update recommendation details', async () => {
      const recommendation = await Recommendation.create({
        user_id: testUser.id,
        type: 'water' as const,
        message: 'Original message',
        severity: 'low' as const,
      });

      const updates = {
        message: 'Updated message with more urgency',
        severity: 'high' as const,
      };

      await recommendation.update(updates);

      expect(recommendation.message).to.equal(updates.message);
      expect(recommendation.severity).to.equal(updates.severity);
    });
  });
});
