import { Grow, GrowHarvest, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('GrowHarvest Model', () => {
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
    it('should create a harvest with required fields', async () => {
      const harvestData = {
        grow_id: testGrow.id,
        harvested_at: new Date(),
      };

      const harvest = await GrowHarvest.create(harvestData);

      expect(harvest).to.exist;
      expect(harvest.grow_id).to.equal(testGrow.id);
      expect(harvest.harvested_at).to.exist;
    });

    it('should create a harvest with all fields', async () => {
      const grow2 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 2',
        started_at: new Date(),
      });

      const harvestData = {
        grow_id: grow2.id,
        harvested_at: new Date(),
        wet_weight_grams: 500.5,
        dry_weight_grams: 125.5,
        trim_weight_grams: 50.5,
        thc_percent: 22.5,
        cbd_percent: 0.5,
        terpene_profile: { myrcene: 0.5, limonene: 0.3, caryophyllene: 0.2 },
        cure_days: 60,
        quality_rating: 9,
        smoke_report: 'Smooth, fruity flavor with relaxing effects',
      };

      const harvest = await GrowHarvest.create(harvestData);

      expect(harvest).to.exist;
      expect(Number(harvest.wet_weight_grams)).to.equal(harvestData.wet_weight_grams);
      expect(Number(harvest.dry_weight_grams)).to.equal(harvestData.dry_weight_grams);
      expect(Number(harvest.trim_weight_grams)).to.equal(harvestData.trim_weight_grams);
      expect(Number(harvest.thc_percent)).to.equal(harvestData.thc_percent);
      expect(Number(harvest.cbd_percent)).to.equal(harvestData.cbd_percent);
      expect(harvest.terpene_profile).to.deep.equal(harvestData.terpene_profile);
      expect(harvest.cure_days).to.equal(harvestData.cure_days);
      expect(harvest.quality_rating).to.equal(harvestData.quality_rating);
      expect(harvest.smoke_report).to.equal(harvestData.smoke_report);
    });
  });

  describe('Validation', () => {
    it('should require grow_id', async () => {
      const harvestData = {
        harvested_at: new Date(),
      };

      await expect(GrowHarvest.create(harvestData)).rejected;
    });

    it('should require harvested_at', async () => {
      const grow3 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 3',
        started_at: new Date(),
      });

      const harvestData = {
        grow_id: grow3.id,
      };

      await expect(GrowHarvest.create(harvestData)).rejected;
    });

    it('should enforce unique constraint on grow_id (one harvest per grow)', async () => {
      const grow4 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 4',
        started_at: new Date(),
      });

      await GrowHarvest.create({
        grow_id: grow4.id,
        harvested_at: new Date(),
      });

      // Try to create duplicate
      const duplicateData = {
        grow_id: grow4.id,
        harvested_at: new Date(),
      };

      await expect(GrowHarvest.create(duplicateData)).rejected;
    });

    it('should validate quality_rating range (1-10)', async () => {
      const grow5 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 5',
        started_at: new Date(),
      });

      const harvestDataLow = {
        grow_id: grow5.id,
        harvested_at: new Date(),
        quality_rating: 0,
      };
      await expect(GrowHarvest.create(harvestDataLow)).rejected;

      const grow6 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 6',
        started_at: new Date(),
      });

      const harvestDataHigh = {
        grow_id: grow6.id,
        harvested_at: new Date(),
        quality_rating: 11,
      };
      await expect(GrowHarvest.create(harvestDataHigh)).rejected;

      // Valid values
      const grow7 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 7',
        started_at: new Date(),
      });

      const validHarvest = await GrowHarvest.create({
        grow_id: grow7.id,
        harvested_at: new Date(),
        quality_rating: 5,
      });
      expect(validHarvest.quality_rating).to.equal(5);
    });

    it('should validate THC percentage range (0-100)', async () => {
      const grow8 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 8',
        started_at: new Date(),
      });

      const harvestDataLow = {
        grow_id: grow8.id,
        harvested_at: new Date(),
        thc_percent: -1,
      };
      await expect(GrowHarvest.create(harvestDataLow)).rejected;

      const grow9 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 9',
        started_at: new Date(),
      });

      const harvestDataHigh = {
        grow_id: grow9.id,
        harvested_at: new Date(),
        thc_percent: 101,
      };
      await expect(GrowHarvest.create(harvestDataHigh)).rejected;
    });

    it('should validate CBD percentage range (0-100)', async () => {
      const grow10 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 10',
        started_at: new Date(),
      });

      const harvestDataLow = {
        grow_id: grow10.id,
        harvested_at: new Date(),
        cbd_percent: -1,
      };
      await expect(GrowHarvest.create(harvestDataLow)).rejected;

      const grow11 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 11',
        started_at: new Date(),
      });

      const harvestDataHigh = {
        grow_id: grow11.id,
        harvested_at: new Date(),
        cbd_percent: 101,
      };
      await expect(GrowHarvest.create(harvestDataHigh)).rejected;
    });

    it('should validate weight minimums', async () => {
      const grow12 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 12',
        started_at: new Date(),
      });

      const harvestData = {
        grow_id: grow12.id,
        harvested_at: new Date(),
        wet_weight_grams: -1,
      };
      await expect(GrowHarvest.create(harvestData)).rejected;
    });

    it('should validate cure_days minimum', async () => {
      const grow13 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 13',
        started_at: new Date(),
      });

      const harvestData = {
        grow_id: grow13.id,
        harvested_at: new Date(),
        cure_days: -1,
      };
      await expect(GrowHarvest.create(harvestData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a grow', async () => {
      const grow14 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 14',
        started_at: new Date(),
      });

      const harvest = await GrowHarvest.create({
        grow_id: grow14.id,
        harvested_at: new Date(),
      });

      const harvestWithGrow = await GrowHarvest.findOne({
        where: { id: harvest.id },
        include: [{ model: Grow, as: 'grow' }],
      });

      expect(harvestWithGrow).to.exist;
      expect((harvestWithGrow as any)?.grow).to.exist;
      expect((harvestWithGrow as any)?.grow?.id).to.equal(grow14.id);
    });

    it('should not create harvest with non-existent grow', async () => {
      const harvestData = {
        grow_id: '00000000-0000-0000-0000-000000000000',
        harvested_at: new Date(),
      };

      await expect(GrowHarvest.create(harvestData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update harvest details', async () => {
      const grow15 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 15',
        started_at: new Date(),
      });

      const harvest = await GrowHarvest.create({
        grow_id: grow15.id,
        harvested_at: new Date(),
        wet_weight_grams: 400,
      });

      const updates = {
        dry_weight_grams: 100,
        thc_percent: 20,
        quality_rating: 8,
        smoke_report: 'Excellent quality',
      };

      await harvest.update(updates);

      expect(Number(harvest.dry_weight_grams)).to.equal(updates.dry_weight_grams);
      expect(Number(harvest.thc_percent)).to.equal(updates.thc_percent);
      expect(harvest.quality_rating).to.equal(updates.quality_rating);
      expect(harvest.smoke_report).to.equal(updates.smoke_report);
    });
  });

  describe('JSONB', () => {
    it('should store and retrieve terpene_profile as JSONB', async () => {
      const grow16 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 16',
        started_at: new Date(),
      });

      const terpenes = {
        myrcene: 0.6,
        limonene: 0.4,
        caryophyllene: 0.3,
        pinene: 0.2,
      };

      const harvest = await GrowHarvest.create({
        grow_id: grow16.id,
        harvested_at: new Date(),
        terpene_profile: terpenes,
      });

      expect(harvest.terpene_profile).to.deep.equal(terpenes);

      // Retrieve from database
      const retrieved = await GrowHarvest.findByPk(harvest.id);
      expect(retrieved?.terpene_profile).to.deep.equal(terpenes);
    });
  });

  describe('toJSON', () => {
    it('should convert DECIMAL fields to numbers', async () => {
      const grow17 = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain 17',
        started_at: new Date(),
      });

      const harvest = await GrowHarvest.create({
        grow_id: grow17.id,
        harvested_at: new Date(),
        wet_weight_grams: 500.5,
        dry_weight_grams: 125.5,
        trim_weight_grams: 50.5,
        thc_percent: 22.5,
        cbd_percent: 0.5,
      });

      const json = harvest.toJSON();

      expect(typeof json.wet_weight_grams).to.equal('number');
      expect(json.wet_weight_grams).to.equal(500.5);
      expect(typeof json.dry_weight_grams).to.equal('number');
      expect(json.dry_weight_grams).to.equal(125.5);
      expect(typeof json.trim_weight_grams).to.equal('number');
      expect(json.trim_weight_grams).to.equal(50.5);
      expect(typeof json.thc_percent).to.equal('number');
      expect(json.thc_percent).to.equal(22.5);
      expect(typeof json.cbd_percent).to.equal('number');
      expect(json.cbd_percent).to.equal(0.5);
    });
  });
});
