import { Grow, GrowLog, GrowLogEnvironment, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('GrowLogEnvironment Model', () => {
  let testUser: User;
  let testGrow: Grow;
  let testGrowLog: GrowLog;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
    testGrowLog = await GrowLog.create({
      grow_id: testGrow.id,
      logged_at: new Date(),
    });
  });

  describe('Creation', () => {
    it('should create environment data with required fields', async () => {
      const envData = {
        grow_log_id: testGrowLog.id,
      };

      const env = await GrowLogEnvironment.create(envData);

      expect(env).to.exist;
      expect(env.grow_log_id).to.equal(testGrowLog.id);
    });

    it('should create environment data with all fields', async () => {
      const envData = {
        grow_log_id: testGrowLog.id,
        temperature_f: 75.5,
        humidity_percent: 65.0,
        ph: 6.5,
        ec: 1.8,
        ppm: 900,
        co2_ppm: 1200,
        light_hours: 18,
        light_distance_inches: 24.0,
        vpd: 1.2,
      };

      const env = await GrowLogEnvironment.create(envData);

      expect(env).to.exist;
      expect(Number(env.temperature_f)).to.equal(envData.temperature_f);
      expect(Number(env.humidity_percent)).to.equal(envData.humidity_percent);
      expect(Number(env.ph)).to.equal(envData.ph);
      expect(Number(env.ec)).to.equal(envData.ec);
      expect(env.ppm).to.equal(envData.ppm);
      expect(env.co2_ppm).to.equal(envData.co2_ppm);
      expect(env.light_hours).to.equal(envData.light_hours);
      expect(Number(env.light_distance_inches)).to.equal(envData.light_distance_inches);
      expect(Number(env.vpd)).to.equal(envData.vpd);
    });
  });

  describe('Validation', () => {
    it('should require grow_log_id', async () => {
      const envData = {
        temperature_f: 75.0,
      };

      await expect(GrowLogEnvironment.create(envData)).rejected;
    });

    it('should validate humidity_percent range (0-100)', async () => {
      const envDataLow = {
        grow_log_id: testGrowLog.id,
        humidity_percent: -1,
      };
      await expect(GrowLogEnvironment.create(envDataLow)).rejected;

      const envDataHigh = {
        grow_log_id: testGrowLog.id,
        humidity_percent: 101,
      };
      await expect(GrowLogEnvironment.create(envDataHigh)).rejected;

      // Valid values
      const validEnv = await GrowLogEnvironment.create({
        grow_log_id: testGrowLog.id,
        humidity_percent: 50,
      });
      expect(Number(validEnv.humidity_percent)).to.equal(50);
    });

    it('should validate pH range (0-14)', async () => {
      const envDataLow = {
        grow_log_id: testGrowLog.id,
        ph: -1,
      };
      await expect(GrowLogEnvironment.create(envDataLow)).rejected;

      const envDataHigh = {
        grow_log_id: testGrowLog.id,
        ph: 15,
      };
      await expect(GrowLogEnvironment.create(envDataHigh)).rejected;

      // Valid values
      const validEnv = await GrowLogEnvironment.create({
        grow_log_id: testGrowLog.id,
        ph: 7.0,
      });
      expect(Number(validEnv.ph)).to.equal(7.0);
    });

    it('should validate light_hours range (0-24)', async () => {
      const envDataLow = {
        grow_log_id: testGrowLog.id,
        light_hours: -1,
      };
      await expect(GrowLogEnvironment.create(envDataLow)).rejected;

      const envDataHigh = {
        grow_log_id: testGrowLog.id,
        light_hours: 25,
      };
      await expect(GrowLogEnvironment.create(envDataHigh)).rejected;

      // Valid values
      const validEnv = await GrowLogEnvironment.create({
        grow_log_id: testGrowLog.id,
        light_hours: 18,
      });
      expect(validEnv.light_hours).to.equal(18);
    });

    it('should validate temperature_f range', async () => {
      const envDataLow = {
        grow_log_id: testGrowLog.id,
        temperature_f: -51,
      };
      await expect(GrowLogEnvironment.create(envDataLow)).rejected;

      const envDataHigh = {
        grow_log_id: testGrowLog.id,
        temperature_f: 151,
      };
      await expect(GrowLogEnvironment.create(envDataHigh)).rejected;

      // Valid values
      const validEnv = await GrowLogEnvironment.create({
        grow_log_id: testGrowLog.id,
        temperature_f: 75,
      });
      expect(Number(validEnv.temperature_f)).to.equal(75);
    });

    it('should validate EC minimum', async () => {
      const envData = {
        grow_log_id: testGrowLog.id,
        ec: -1,
      };
      await expect(GrowLogEnvironment.create(envData)).rejected;
    });

    it('should validate PPM minimum', async () => {
      const envData = {
        grow_log_id: testGrowLog.id,
        ppm: -1,
      };
      await expect(GrowLogEnvironment.create(envData)).rejected;
    });

    it('should validate CO2 PPM minimum', async () => {
      const envData = {
        grow_log_id: testGrowLog.id,
        co2_ppm: -1,
      };
      await expect(GrowLogEnvironment.create(envData)).rejected;
    });

    it('should validate VPD minimum', async () => {
      const envData = {
        grow_log_id: testGrowLog.id,
        vpd: -1,
      };
      await expect(GrowLogEnvironment.create(envData)).rejected;
    });

    it('should validate light_distance_inches minimum', async () => {
      const envData = {
        grow_log_id: testGrowLog.id,
        light_distance_inches: -1,
      };
      await expect(GrowLogEnvironment.create(envData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a grow log', async () => {
      const env = await GrowLogEnvironment.create({
        grow_log_id: testGrowLog.id,
        temperature_f: 75,
      });

      const envWithLog = await GrowLogEnvironment.findOne({
        where: { id: env.id },
        include: [{ model: GrowLog, as: 'growLog' }],
      });

      expect(envWithLog).to.exist;
      expect((envWithLog as any)?.growLog).to.exist;
      expect((envWithLog as any)?.growLog?.id).to.equal(testGrowLog.id);
    });

    it('should not create environment with non-existent grow log', async () => {
      const envData = {
        grow_log_id: '00000000-0000-0000-0000-000000000000',
        temperature_f: 75,
      };

      await expect(GrowLogEnvironment.create(envData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update environment details', async () => {
      const env = await GrowLogEnvironment.create({
        grow_log_id: testGrowLog.id,
        temperature_f: 70,
        humidity_percent: 60,
      });

      const updates = {
        temperature_f: 75,
        humidity_percent: 65,
        ph: 6.0,
        ec: 2.0,
        ppm: 1000,
      };

      await env.update(updates);

      expect(Number(env.temperature_f)).to.equal(updates.temperature_f);
      expect(Number(env.humidity_percent)).to.equal(updates.humidity_percent);
      expect(Number(env.ph)).to.equal(updates.ph);
      expect(Number(env.ec)).to.equal(updates.ec);
      expect(env.ppm).to.equal(updates.ppm);
    });
  });

  describe('toJSON', () => {
    it('should convert DECIMAL fields to numbers', async () => {
      const env = await GrowLogEnvironment.create({
        grow_log_id: testGrowLog.id,
        temperature_f: 75.5,
        humidity_percent: 65.5,
        ph: 6.5,
        ec: 1.8,
        light_distance_inches: 24.5,
        vpd: 1.25,
      });

      const json = env.toJSON();

      expect(typeof json.temperature_f).to.equal('number');
      expect(json.temperature_f).to.equal(75.5);
      expect(typeof json.humidity_percent).to.equal('number');
      expect(json.humidity_percent).to.equal(65.5);
      expect(typeof json.ph).to.equal('number');
      expect(json.ph).to.equal(6.5);
      expect(typeof json.ec).to.equal('number');
      expect(json.ec).to.equal(1.8);
      expect(typeof json.light_distance_inches).to.equal('number');
      expect(json.light_distance_inches).to.equal(24.5);
      expect(typeof json.vpd).to.equal('number');
      expect(json.vpd).to.equal(1.25);
    });
  });
});
