import { Grow, GrowLog, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('GrowLog Model', () => {
  let testUser: User;
  let testGrow: Grow;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
  });

  describe('Creation', () => {
    it('should create a grow log with required fields', async () => {
      const logData = {
        grow_id: testGrow.id,
        logged_at: new Date(),
      };

      const log = await GrowLog.create(logData);

      expect(log).to.exist;
      expect(log.grow_id).to.equal(testGrow.id);
      expect(log.logged_at).to.exist;
    });

    it('should create a grow log with all fields', async () => {
      const logData = {
        grow_id: testGrow.id,
        logged_at: new Date(),
        day_number: 14,
        phase: 'vegetative' as const,
        height_inches: 8.5,
        notes: 'Plants looking healthy',
      };

      const log = await GrowLog.create(logData);

      expect(log).to.exist;
      expect(log.grow_id).to.equal(testGrow.id);
      expect(log.day_number).to.equal(logData.day_number);
      expect(log.phase).to.equal(logData.phase);
      expect(Number(log.height_inches)).to.equal(logData.height_inches);
      expect(log.notes).to.equal(logData.notes);
    });
  });

  describe('Validation', () => {
    it('should require grow_id', async () => {
      const logData = {
        logged_at: new Date(),
      };

      await expect(GrowLog.create(logData)).rejected;
    });

    it('should require logged_at', async () => {
      const logData = {
        grow_id: testGrow.id,
      };

      await expect(GrowLog.create(logData)).rejected;
    });

    it('should validate phase enum', async () => {
      const logData = {
        grow_id: testGrow.id,
        logged_at: new Date(),
        phase: 'invalid' as any,
      };

      await expect(GrowLog.create(logData)).rejected;

      // Valid phases
      const validPhases = ['germination', 'vegetative', 'flowering', 'harvest'];
      for (const phase of validPhases) {
        const validLog = await GrowLog.create({
          grow_id: testGrow.id,
          logged_at: new Date(),
          phase: phase as any,
        });
        expect(validLog.phase).to.equal(phase);
      }
    });

    it('should validate day_number minimum', async () => {
      const logData = {
        grow_id: testGrow.id,
        logged_at: new Date(),
        day_number: -1,
      };

      await expect(GrowLog.create(logData)).rejected;
    });

    it('should validate height_inches minimum', async () => {
      const logData = {
        grow_id: testGrow.id,
        logged_at: new Date(),
        height_inches: -1,
      };

      await expect(GrowLog.create(logData)).rejected;
    });

    it('should allow zero for day_number', async () => {
      const log = await GrowLog.create({
        grow_id: testGrow.id,
        logged_at: new Date(),
        day_number: 0,
      });

      expect(log.day_number).to.equal(0);
    });

    it('should allow zero for height_inches', async () => {
      const log = await GrowLog.create({
        grow_id: testGrow.id,
        logged_at: new Date(),
        height_inches: 0,
      });

      expect(Number(log.height_inches)).to.equal(0);
    });
  });

  describe('Associations', () => {
    it('should associate with a grow', async () => {
      const log = await GrowLog.create({
        grow_id: testGrow.id,
        logged_at: new Date(),
      });

      const logWithGrow = await GrowLog.findOne({
        where: { id: log.id },
        include: [{ model: Grow, as: 'grow' }],
      });

      expect(logWithGrow).to.exist;
      expect((logWithGrow as any)?.grow).to.exist;
      expect((logWithGrow as any)?.grow?.id).to.equal(testGrow.id);
    });

    it('should not create log with non-existent grow', async () => {
      const logData = {
        grow_id: '00000000-0000-0000-0000-000000000000',
        logged_at: new Date(),
      };

      await expect(GrowLog.create(logData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update grow log details', async () => {
      const log = await GrowLog.create({
        grow_id: testGrow.id,
        logged_at: new Date(),
        day_number: 1,
      });

      const updates = {
        day_number: 7,
        phase: 'vegetative' as const,
        height_inches: 5.0,
        notes: 'First week complete',
      };

      await log.update(updates);

      expect(log.day_number).to.equal(updates.day_number);
      expect(log.phase).to.equal(updates.phase);
      expect(Number(log.height_inches)).to.equal(updates.height_inches);
      expect(log.notes).to.equal(updates.notes);
    });
  });

  describe('toJSON', () => {
    it('should convert DECIMAL height_inches to number', async () => {
      const log = await GrowLog.create({
        grow_id: testGrow.id,
        logged_at: new Date(),
        height_inches: 12.5,
      });

      const json = log.toJSON();

      expect(typeof json.height_inches).to.equal('number');
      expect(json.height_inches).to.equal(12.5);
    });
  });
});
