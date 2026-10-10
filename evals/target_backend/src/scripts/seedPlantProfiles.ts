/**
 * Seed script to populate plant_profiles and seasonal_tips tables
 * Run with: npx ts-node src/scripts/seedPlantProfiles.ts
 */

import * as dotenv from 'dotenv';
dotenv.config(); // Load .env file

import { getSequelize } from '../config/sequelize';
import { initializeModels } from '../models';
import { PlantProfile, SeasonalTip } from '../models';
import { plantProfiles } from '../utils/plantDatabase';

async function seedPlantProfiles() {
  try {
    console.log('Connecting to database...');
    const sequelize = await getSequelize();
    await initializeModels(sequelize);

    console.log('Starting plant profiles seed...');

    // Clear existing data (optional - comment out to keep existing data)
    console.log('Clearing existing plant profiles and seasonal tips...');
    await SeasonalTip.destroy({ where: {}, truncate: true, cascade: true });
    await PlantProfile.destroy({ where: {}, truncate: true, cascade: true });

    let profileCount = 0;
    let tipCount = 0;

    for (const profileData of plantProfiles) {
      const { tips, ...plantProfileData } = profileData;

      // Create plant profile
      const profile = await PlantProfile.create(plantProfileData);
      profileCount++;
      console.log(`Created plant profile: ${profile.name}`);

      // Create seasonal tips for this profile
      for (const tip of tips) {
        await SeasonalTip.create({
          plant_profile_id: profile.id,
          ...tip,
        });
        tipCount++;
      }
    }

    console.log('\n✅ Seeding complete!');
    console.log(`   Created ${profileCount} plant profiles`);
    console.log(`   Created ${tipCount} seasonal tips`);

    await sequelize.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error seeding plant profiles:', error);
    process.exit(1);
  }
}

// Run the seed function
seedPlantProfiles();
