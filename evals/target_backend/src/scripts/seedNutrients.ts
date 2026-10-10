/**
 * Seed script to populate nutrients table with predefined cannabis nutrient products
 * Run with: npm run seed:nutrients
 */

import * as dotenv from 'dotenv';
dotenv.config(); // Load .env file

import { getSequelize } from '../config/sequelize';
import { initializeModels } from '../models';
import { Nutrient } from '../models';

interface NutrientSeedData {
  brand: string;
  product_name: string;
  type: 'base' | 'supplement' | 'additive' | 'ph_adjuster' | 'other';
  npk_ratio?: string;
  description?: string;
  is_organic: boolean;
}

const nutrients: NutrientSeedData[] = [
  // ===== Fox Farm (6 products) =====
  {
    brand: 'Fox Farm',
    product_name: 'Big Bloom',
    type: 'base',
    npk_ratio: '0-0.5-0.7',
    description: 'Organic liquid fertilizer for all stages of growth',
    is_organic: true,
  },
  {
    brand: 'Fox Farm',
    product_name: 'Grow Big',
    type: 'base',
    npk_ratio: '6-4-4',
    description: 'Vegetative growth formula with micronutrients',
    is_organic: false,
  },
  {
    brand: 'Fox Farm',
    product_name: 'Tiger Bloom',
    type: 'base',
    npk_ratio: '2-8-4',
    description: 'Flowering formula with phosphorus boost',
    is_organic: false,
  },
  {
    brand: 'Fox Farm',
    product_name: 'Open Sesame',
    type: 'supplement',
    npk_ratio: '5-45-19',
    description: 'Early flowering booster',
    is_organic: false,
  },
  {
    brand: 'Fox Farm',
    product_name: 'Beastie Bloomz',
    type: 'supplement',
    npk_ratio: '0-50-30',
    description: 'Mid-flowering phosphorus and potassium booster',
    is_organic: false,
  },
  {
    brand: 'Fox Farm',
    product_name: 'Cha Ching',
    type: 'supplement',
    npk_ratio: '9-50-10',
    description: 'Late-flowering finisher',
    is_organic: false,
  },

  // ===== General Hydroponics Flora Series (6 products) =====
  {
    brand: 'General Hydroponics',
    product_name: 'FloraGro',
    type: 'base',
    npk_ratio: '2-1-6',
    description: 'Vegetative growth component of Flora Series',
    is_organic: false,
  },
  {
    brand: 'General Hydroponics',
    product_name: 'FloraMicro',
    type: 'base',
    npk_ratio: '5-0-1',
    description: 'Micronutrient component of Flora Series',
    is_organic: false,
  },
  {
    brand: 'General Hydroponics',
    product_name: 'FloraBloom',
    type: 'base',
    npk_ratio: '0-5-4',
    description: 'Flowering component of Flora Series',
    is_organic: false,
  },
  {
    brand: 'General Hydroponics',
    product_name: 'Armor Si',
    type: 'supplement',
    npk_ratio: '0-0-4',
    description: 'Silica supplement for plant strength',
    is_organic: false,
  },
  {
    brand: 'General Hydroponics',
    product_name: 'CaliMagic',
    type: 'supplement',
    npk_ratio: '1-0-0',
    description: 'Calcium-magnesium supplement',
    is_organic: false,
  },
  {
    brand: 'General Hydroponics',
    product_name: 'Diamond Nectar',
    type: 'additive',
    description: 'Humic acid supplement for nutrient uptake',
    is_organic: false,
  },

  // ===== Advanced Nutrients (9 products) =====
  {
    brand: 'Advanced Nutrients',
    product_name: 'pH Perfect Grow',
    type: 'base',
    npk_ratio: '1-0-4',
    description: 'Vegetative base nutrient with pH Perfect technology',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'pH Perfect Micro',
    type: 'base',
    npk_ratio: '2-0-0',
    description: 'Micronutrient base with pH Perfect technology',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'pH Perfect Bloom',
    type: 'base',
    npk_ratio: '0-5-4',
    description: 'Flowering base nutrient with pH Perfect technology',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'Big Bud',
    type: 'supplement',
    npk_ratio: '0-1-3',
    description: 'Flowering booster for larger buds',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'Bud Candy',
    type: 'supplement',
    description: 'Carbohydrate supplement for enhanced flavor and aroma',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'Overdrive',
    type: 'supplement',
    npk_ratio: '1-5-4',
    description: 'Late-flowering finisher',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'B-52',
    type: 'additive',
    description: 'Vitamin supplement with B vitamins',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'Voodoo Juice',
    type: 'additive',
    description: 'Beneficial bacteria for root development',
    is_organic: false,
  },
  {
    brand: 'Advanced Nutrients',
    product_name: 'Sensizym',
    type: 'additive',
    description: 'Enzyme supplement for root zone health',
    is_organic: false,
  },

  // ===== Botanicare (5 products) =====
  {
    brand: 'Botanicare',
    product_name: 'Pure Blend Pro Grow',
    type: 'base',
    npk_ratio: '3-2-4',
    description: 'Organic vegetative growth formula',
    is_organic: true,
  },
  {
    brand: 'Botanicare',
    product_name: 'Pure Blend Pro Bloom',
    type: 'base',
    npk_ratio: '2-3-5',
    description: 'Organic flowering formula',
    is_organic: true,
  },
  {
    brand: 'Botanicare',
    product_name: 'Liquid Karma',
    type: 'additive',
    description: 'Organic metabolic enhancer with humic acid',
    is_organic: true,
  },
  {
    brand: 'Botanicare',
    product_name: 'Cal-Mag Plus',
    type: 'supplement',
    npk_ratio: '2-0-0',
    description: 'Calcium-magnesium supplement with iron',
    is_organic: false,
  },
  {
    brand: 'Botanicare',
    product_name: 'Hydroguard',
    type: 'additive',
    description: 'Beneficial bacteria for hydroponic systems',
    is_organic: false,
  },

  // ===== Canna (8 products) =====
  {
    brand: 'Canna',
    product_name: 'Coco A',
    type: 'base',
    npk_ratio: '5-4-3',
    description: 'Part A of Canna Coco nutrient system',
    is_organic: false,
  },
  {
    brand: 'Canna',
    product_name: 'Coco B',
    type: 'base',
    npk_ratio: '0-4-2',
    description: 'Part B of Canna Coco nutrient system',
    is_organic: false,
  },
  {
    brand: 'Canna',
    product_name: 'Hydro Vega A',
    type: 'base',
    npk_ratio: '5-2-4',
    description: 'Part A of Canna Hydro vegetative nutrient',
    is_organic: false,
  },
  {
    brand: 'Canna',
    product_name: 'Hydro Vega B',
    type: 'base',
    npk_ratio: '0-4-2',
    description: 'Part B of Canna Hydro vegetative nutrient',
    is_organic: false,
  },
  {
    brand: 'Canna',
    product_name: 'Cannazym',
    type: 'additive',
    description: 'Enzyme supplement for root zone health',
    is_organic: false,
  },
  {
    brand: 'Canna',
    product_name: 'Rhizotonic',
    type: 'additive',
    description: 'Root stimulator and stress reducer',
    is_organic: false,
  },
  {
    brand: 'Canna',
    product_name: 'Boost',
    type: 'supplement',
    description: 'Flowering booster for enhanced metabolism',
    is_organic: false,
  },
  {
    brand: 'Canna',
    product_name: 'PK 13/14',
    type: 'supplement',
    npk_ratio: '0-13-14',
    description: 'Phosphorus-potassium booster for mid-flowering',
    is_organic: false,
  },

  // ===== pH Adjusters (4 products) =====
  {
    brand: 'General Hydroponics',
    product_name: 'pH Up',
    type: 'ph_adjuster',
    description: 'Potassium hydroxide solution for raising pH',
    is_organic: false,
  },
  {
    brand: 'General Hydroponics',
    product_name: 'pH Down',
    type: 'ph_adjuster',
    description: 'Phosphoric acid solution for lowering pH',
    is_organic: false,
  },
  {
    brand: 'Generic',
    product_name: 'pH Up',
    type: 'ph_adjuster',
    description: 'General purpose pH raising solution',
    is_organic: false,
  },
  {
    brand: 'Generic',
    product_name: 'pH Down',
    type: 'ph_adjuster',
    description: 'General purpose pH lowering solution',
    is_organic: false,
  },

  // ===== Generic Supplements & Additives (10 products) =====
  {
    brand: 'Generic',
    product_name: 'Cal-Mag',
    type: 'supplement',
    npk_ratio: '1-0-0',
    description: 'Calcium-magnesium supplement',
    is_organic: false,
  },
  {
    brand: 'Generic',
    product_name: 'Silica Supplement',
    type: 'supplement',
    npk_ratio: '0-0-3',
    description: 'Silicon supplement for plant strength',
    is_organic: false,
  },
  {
    brand: 'Generic',
    product_name: 'Molasses',
    type: 'additive',
    description: 'Organic carbohydrate supplement for soil microbes',
    is_organic: true,
  },
  {
    brand: 'Generic',
    product_name: 'Kelp Extract',
    type: 'additive',
    description: 'Organic seaweed extract for plant health',
    is_organic: true,
  },
  {
    brand: 'Great White',
    product_name: 'Mycorrhizae',
    type: 'additive',
    description: 'Beneficial fungi and bacteria inoculant',
    is_organic: false,
  },
  {
    brand: 'Recharge',
    product_name: 'Microbial Inoculant',
    type: 'additive',
    description: 'Beneficial bacteria, fungi, and kelp blend',
    is_organic: false,
  },
  {
    brand: 'Dyna-Gro',
    product_name: 'Foliage-Pro',
    type: 'base',
    npk_ratio: '9-3-6',
    description: 'Complete vegetative growth formula',
    is_organic: false,
  },
  {
    brand: 'Dyna-Gro',
    product_name: 'Bloom',
    type: 'base',
    npk_ratio: '3-12-6',
    description: 'Complete flowering formula',
    is_organic: false,
  },
  {
    brand: 'Nectar for the Gods',
    product_name: 'Medusas Magic',
    type: 'supplement',
    npk_ratio: '1-4-3',
    description: 'Calcium-magnesium supplement with micronutrients',
    is_organic: false,
  },
  {
    brand: 'Nectar for the Gods',
    product_name: 'Herculean Harvest',
    type: 'additive',
    description: 'Organic enzymatic digester and nutrient catalyst',
    is_organic: true,
  },
];

async function seedNutrients() {
  try {
    console.log('Connecting to database...');
    const sequelize = await getSequelize();
    await initializeModels(sequelize);

    console.log('Starting nutrient seed...');

    // Optional: Clear existing system nutrients
    // CRITICAL: Only delete system nutrients (user_id = null), never user-created nutrients
    console.log('Clearing existing system nutrients...');
    const deletedCount = await Nutrient.destroy({ where: { user_id: null } });
    console.log(`Deleted ${deletedCount} existing system nutrients`);

    let created = 0;
    let skipped = 0;

    console.log(`\nProcessing ${nutrients.length} nutrient products...\n`);

    // Loop through nutrients array and create each one
    for (const nutrientData of nutrients) {
      try {
        await Nutrient.create({
          user_id: null, // CRITICAL: null = system nutrient accessible to all users
          brand: nutrientData.brand,
          product_name: nutrientData.product_name,
          type: nutrientData.type,
          npk_ratio: nutrientData.npk_ratio,
          description: nutrientData.description,
          is_organic: nutrientData.is_organic,
        });

        created++;
        console.log(
          `✓ Created ${nutrientData.type}: ${nutrientData.brand} - ${nutrientData.product_name}${
            nutrientData.npk_ratio ? ` (${nutrientData.npk_ratio})` : ''
          }`
        );
      } catch (error: any) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          skipped++;
          console.log(
            `- Already exists: ${nutrientData.brand} - ${nutrientData.product_name}`
          );
        } else {
          console.error(
            `✗ Error creating ${nutrientData.brand} - ${nutrientData.product_name}:`,
            error.message
          );
        }
      }
    }

    console.log('\n✅ Seeding complete!');
    console.log(`   Created: ${created} nutrients`);
    console.log(`   Skipped: ${skipped} nutrients`);
    console.log(`   Total: ${nutrients.length} nutrients processed`);

    await sequelize.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('❌ Error seeding nutrients:', error);
    process.exit(1);
  }
}

// Run the seed function
seedNutrients();
