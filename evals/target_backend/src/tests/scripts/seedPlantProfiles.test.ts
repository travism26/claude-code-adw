import { expect } from 'chai';
import { PlantProfile, SeasonalTip } from '../../models';
import { plantProfiles } from '../../utils/plantDatabase';

describe('Plant Profiles Seed Script', () => {

  // Run seed logic inline for testing
  async function seedPlantProfilesForTest() {
    // Clear existing data
    await SeasonalTip.destroy({ where: {}, truncate: true, cascade: true });
    await PlantProfile.destroy({ where: {}, truncate: true, cascade: true });

    let profileCount = 0;
    let tipCount = 0;

    for (const profileData of plantProfiles) {
      const { tips, ...plantProfileData } = profileData;

      // Create plant profile
      const profile = await PlantProfile.create(plantProfileData);
      profileCount++;

      // Create seasonal tips for this profile
      for (const tip of tips) {
        await SeasonalTip.create({
          plant_profile_id: profile.id,
          ...tip,
        });
        tipCount++;
      }
    }

    return { profileCount, tipCount };
  }

  describe('Seed Script Execution', () => {
    it('should successfully seed all plant profiles without errors', async () => {
      const result = await seedPlantProfilesForTest();
      expect(result.profileCount).to.be.greaterThan(0);
      expect(result.tipCount).to.be.greaterThan(0);
    });

    it('should create correct number of plant profiles', async () => {
      const result = await seedPlantProfilesForTest();
      expect(result.profileCount).to.equal(plantProfiles.length);

      const dbCount = await PlantProfile.count();
      expect(dbCount).to.equal(plantProfiles.length);
    });

    it('should associate seasonal tips with plant profiles', async () => {
      await seedPlantProfilesForTest();

      const profiles = await PlantProfile.findAll({
        include: [{ model: SeasonalTip, as: 'tips' }],
      });

      // Count total tips in database
      const totalTipsInDb = await SeasonalTip.count();
      expect(totalTipsInDb).to.be.greaterThan(0);

      // Verify at least some profiles have tips
      const profilesWithTips = profiles.filter(
        (p: any) => p.tips && p.tips.length > 0
      );
      expect(profilesWithTips.length).to.be.greaterThan(0);
    });

    it('should maintain data integrity and validation rules', async () => {
      await seedPlantProfilesForTest();

      const profiles = await PlantProfile.findAll();

      // Check each profile has required fields
      profiles.forEach((profile) => {
        expect(profile.name).to.exist;
        expect(profile.type).to.exist;
        expect(profile.default_water_interval_days).to.exist;
        expect(profile.difficulty).to.exist;
        expect(profile.indoor_outdoor).to.exist;

        // Validate enum values
        expect(['vegetable', 'herb', 'flower', 'houseplant', 'fruit', 'tree', 'succulent', 'vine']).to.include(profile.type);
        expect(['easy', 'moderate', 'challenging']).to.include(profile.difficulty);
        expect(['indoor', 'outdoor', 'both']).to.include(profile.indoor_outdoor);

        // Validate zone ranges if present
        if (profile.zone_min !== null) {
          expect(profile.zone_min).to.be.at.least(1);
          expect(profile.zone_min).to.be.at.most(13);
        }
        if (profile.zone_max !== null) {
          expect(profile.zone_max).to.be.at.least(1);
          expect(profile.zone_max).to.be.at.most(13);
        }

        // Validate spacing if present
        if (profile.spacing_inches !== null) {
          expect(profile.spacing_inches).to.be.at.least(0);
        }
      });
    });

    it('should allow running seed script multiple times (idempotent)', async () => {
      // Run seed first time
      const result1 = await seedPlantProfilesForTest();

      // Run seed second time
      const result2 = await seedPlantProfilesForTest();

      // Should have same counts both times
      expect(result1.profileCount).to.equal(result2.profileCount);

      // Database should only have one set of profiles
      const dbCount = await PlantProfile.count();
      expect(dbCount).to.equal(plantProfiles.length);
    });
  });

  describe('Plant Database Data Quality', () => {
    before(async () => {
      await seedPlantProfilesForTest();
    });

    it('should have spacing_inches for all outdoor plants', async () => {
      const outdoorProfiles = await PlantProfile.findAll({
        where: {
          indoor_outdoor: ['outdoor', 'both'],
          type: ['vegetable', 'herb', 'flower', 'fruit'],
        },
      });

      const withoutSpacing = outdoorProfiles.filter(
        (p) => p.spacing_inches === null
      );

      // Allow some outdoor plants to not have spacing (e.g., some herbs/flowers)
      // But most should have it
      const percentageWithSpacing =
        ((outdoorProfiles.length - withoutSpacing.length) / outdoorProfiles.length) * 100;
      expect(percentageWithSpacing).to.be.at.least(80);
    });

    it('should have zone compatibility information for most plants', async () => {
      const profiles = await PlantProfile.findAll();

      const withZones = profiles.filter(
        (p) => p.zone_min !== null && p.zone_max !== null
      );

      // Most plants should have zone information
      const percentageWithZones = (withZones.length / profiles.length) * 100;
      expect(percentageWithZones).to.be.at.least(70);
    });

    it('should have sunlight requirements for most plants', async () => {
      const profiles = await PlantProfile.findAll();

      const withSunlight = profiles.filter(
        (p) => p.sunlight_requirements !== null
      );

      // Most plants should have sunlight requirements
      const percentageWithSunlight = (withSunlight.length / profiles.length) * 100;
      expect(percentageWithSunlight).to.be.at.least(80);
    });

    it('should have at least 3 seasonal tips per plant on average', async () => {
      const profileCount = await PlantProfile.count();
      const tipCount = await SeasonalTip.count();

      const averageTipsPerPlant = tipCount / profileCount;
      expect(averageTipsPerPlant).to.be.at.least(3);
    });

    it('should have diverse plant types', async () => {
      const vegetableCount = await PlantProfile.count({ where: { type: 'vegetable' } });
      const herbCount = await PlantProfile.count({ where: { type: 'herb' } });
      const flowerCount = await PlantProfile.count({ where: { type: 'flower' } });
      const fruitCount = await PlantProfile.count({ where: { type: 'fruit' } });

      // Should have at least some of each major type
      expect(vegetableCount).to.be.at.least(15);
      expect(herbCount).to.be.at.least(8);
      expect(flowerCount).to.be.at.least(5);
      expect(fruitCount).to.be.at.least(3);
    });

    it('should have valid zone ranges', async () => {
      const profiles = await PlantProfile.findAll();

      profiles.forEach((profile) => {
        if (profile.zone_min !== null && profile.zone_max !== null) {
          expect(profile.zone_min).to.be.at.most(profile.zone_max);
        }
      });
    });

    it('should have realistic difficulty distribution', async () => {
      const easyCount = await PlantProfile.count({ where: { difficulty: 'easy' } });
      const moderateCount = await PlantProfile.count({ where: { difficulty: 'moderate' } });

      // Should have some of each difficulty level
      expect(easyCount).to.be.greaterThan(0);
      expect(moderateCount).to.be.greaterThan(0);

      // Most plants should be easy or moderate
      const totalProfiles = await PlantProfile.count();
      const easyAndModerate = easyCount + moderateCount;
      expect(easyAndModerate / totalProfiles).to.be.at.least(0.7);
    });
  });
});
