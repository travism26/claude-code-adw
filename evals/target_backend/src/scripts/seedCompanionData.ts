import { getSequelize } from '../config/sequelize';
import { PlantCompanion, PlantProfile } from '../models';
import { initializeModels } from '../models';

/**
 * Seeds the database with companion planting relationships
 * Run with: npx ts-node src/scripts/seedCompanionData.ts
 */

interface CompanionData {
  plantA: string; // common_name
  plantB: string; // common_name
  relationship: 'beneficial' | 'harmful';
  notes: string;
}

const companionRelationships: CompanionData[] = [
  // Beneficial relationships
  {
    plantA: 'Tomato',
    plantB: 'Basil',
    relationship: 'beneficial',
    notes: 'Basil repels pests and may improve tomato flavor',
  },
  {
    plantA: 'Tomato',
    plantB: 'Marigold',
    relationship: 'beneficial',
    notes: 'Marigolds deter nematodes and whiteflies',
  },
  {
    plantA: 'Carrot',
    plantB: 'Onion',
    relationship: 'beneficial',
    notes: 'Onions repel carrot flies',
  },
  {
    plantA: 'Lettuce',
    plantB: 'Radish',
    relationship: 'beneficial',
    notes: 'Radishes help break up soil and mark lettuce rows',
  },
  {
    plantA: 'Cucumber',
    plantB: 'Nasturtium',
    relationship: 'beneficial',
    notes: 'Nasturtiums repel cucumber beetles and aphids',
  },
  {
    plantA: 'Bean',
    plantB: 'Corn',
    relationship: 'beneficial',
    notes: 'Beans fix nitrogen for corn, corn provides support for beans',
  },
  {
    plantA: 'Squash',
    plantB: 'Corn',
    relationship: 'beneficial',
    notes: 'Part of Three Sisters - squash shades soil and prevents weeds',
  },
  {
    plantA: 'Pepper',
    plantB: 'Basil',
    relationship: 'beneficial',
    notes: 'Basil repels aphids, spider mites, and mosquitoes',
  },
  {
    plantA: 'Cabbage',
    plantB: 'Dill',
    relationship: 'beneficial',
    notes: 'Dill attracts beneficial insects that prey on cabbage pests',
  },
  {
    plantA: 'Rose',
    plantB: 'Garlic',
    relationship: 'beneficial',
    notes: 'Garlic deters aphids and may prevent black spot',
  },
  {
    plantA: 'Strawberry',
    plantB: 'Borage',
    relationship: 'beneficial',
    notes: 'Borage attracts pollinators and may improve strawberry flavor',
  },
  {
    plantA: 'Spinach',
    plantB: 'Radish',
    relationship: 'beneficial',
    notes: 'Radishes can help deter leaf miners',
  },
  {
    plantA: 'Potato',
    plantB: 'Marigold',
    relationship: 'beneficial',
    notes: 'Marigolds repel potato beetles',
  },
  {
    plantA: 'Broccoli',
    plantB: 'Nasturtium',
    relationship: 'beneficial',
    notes: 'Nasturtiums act as trap crop for aphids',
  },
  {
    plantA: 'Pea',
    plantB: 'Carrot',
    relationship: 'beneficial',
    notes: 'Peas provide nitrogen, carrots benefit from loose soil',
  },

  // Harmful relationships
  {
    plantA: 'Tomato',
    plantB: 'Cabbage',
    relationship: 'harmful',
    notes: 'Both are heavy feeders and compete for nutrients',
  },
  {
    plantA: 'Tomato',
    plantB: 'Potato',
    relationship: 'harmful',
    notes: 'Both susceptible to same diseases (late blight)',
  },
  {
    plantA: 'Bean',
    plantB: 'Onion',
    relationship: 'harmful',
    notes: 'Onions inhibit bean growth',
  },
  {
    plantA: 'Bean',
    plantB: 'Garlic',
    relationship: 'harmful',
    notes: 'Garlic inhibits bean growth',
  },
  {
    plantA: 'Carrot',
    plantB: 'Dill',
    relationship: 'harmful',
    notes: 'Dill can stunt carrot growth',
  },
  {
    plantA: 'Cucumber',
    plantB: 'Sage',
    relationship: 'harmful',
    notes: 'Sage inhibits cucumber growth',
  },
  {
    plantA: 'Pepper',
    plantB: 'Bean',
    relationship: 'harmful',
    notes: 'Beans can spread fungal diseases to peppers',
  },
  {
    plantA: 'Cabbage',
    plantB: 'Strawberry',
    relationship: 'harmful',
    notes: 'Strawberries inhibit cabbage growth',
  },
  {
    plantA: 'Potato',
    plantB: 'Sunflower',
    relationship: 'harmful',
    notes: 'Sunflowers inhibit potato growth',
  },
  {
    plantA: 'Broccoli',
    plantB: 'Tomato',
    relationship: 'harmful',
    notes: 'Both are heavy feeders and compete for nutrients',
  },
];

async function seedCompanionData() {
  try {
    console.log('Connecting to database...');
    const sequelize = await getSequelize();
    await initializeModels(sequelize);

    console.log('Fetching plant profiles...');
    const allProfiles = await PlantProfile.findAll();

    if (allProfiles.length === 0) {
      console.error('No plant profiles found. Please seed plant profiles first.');
      process.exit(1);
    }

    console.log(`Found ${allProfiles.length} plant profiles`);

    // Create a map for quick lookup
    const profileMap: Map<string, string> = new Map();
    allProfiles.forEach((profile) => {
      if (profile.common_name) {
        profileMap.set(profile.common_name.toLowerCase(), profile.id);
      }
    });

    let created = 0;
    let skipped = 0;

    for (const companion of companionRelationships) {
      const plantAId = profileMap.get(companion.plantA.toLowerCase());
      const plantBId = profileMap.get(companion.plantB.toLowerCase());

      if (!plantAId || !plantBId) {
        console.warn(
          `Skipping: ${companion.plantA} <-> ${companion.plantB} (one or both plants not found)`
        );
        skipped++;
        continue;
      }

      try {
        await PlantCompanion.create({
          plant_a_id: plantAId,
          plant_b_id: plantBId,
          relationship: companion.relationship,
          notes: companion.notes,
        });

        console.log(
          `✓ Created ${companion.relationship} relationship: ${companion.plantA} <-> ${companion.plantB}`
        );
        created++;
      } catch (error: any) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          console.log(
            `- Already exists: ${companion.plantA} <-> ${companion.plantB}`
          );
          skipped++;
        } else {
          console.error(
            `Error creating relationship ${companion.plantA} <-> ${companion.plantB}:`,
            error.message
          );
        }
      }
    }

    console.log('\n=== Companion Data Seeding Complete ===');
    console.log(`Created: ${created} relationships`);
    console.log(`Skipped: ${skipped} relationships`);
    console.log(`Total: ${companionRelationships.length} relationships processed`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding companion data:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedCompanionData();
