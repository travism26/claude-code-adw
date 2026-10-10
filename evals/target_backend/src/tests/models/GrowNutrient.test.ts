import { Grow, GrowNutrient, Nutrient, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('GrowNutrient Model', () => {
  let testUser: User;
  let testGrow: Grow;
  let testNutrient: Nutrient;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
    testNutrient = await Nutrient.create({
      user_id: testUser.id,
      brand: 'Test Brand',
      product_name: 'Test Nutrient',
    });
  });

  describe('Creation', () => {
    it('should create a grow nutrient with required fields', async () => {
      const growNutrientData = {
        grow_id: testGrow.id,
        nutrient_id: testNutrient.id,
      };

      const growNutrient = await GrowNutrient.create(growNutrientData);

      expect(growNutrient).to.exist;
      expect(growNutrient.grow_id).to.equal(testGrow.id);
      expect(growNutrient.nutrient_id).to.equal(testNutrient.id);
    });

    it('should create a grow nutrient with all fields', async () => {
      const nutrient2 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 2',
        product_name: 'Test Nutrient 2',
      });

      const growNutrientData = {
        grow_id: testGrow.id,
        nutrient_id: nutrient2.id,
        dosage_ml_per_gallon: 5.5,
        frequency: 'weekly' as const,
        phase_used: 'vegetative' as const,
        notes: 'Use during veg phase only',
      };

      const growNutrient = await GrowNutrient.create(growNutrientData);

      expect(growNutrient).to.exist;
      expect(Number(growNutrient.dosage_ml_per_gallon)).to.equal(growNutrientData.dosage_ml_per_gallon);
      expect(growNutrient.frequency).to.equal(growNutrientData.frequency);
      expect(growNutrient.phase_used).to.equal(growNutrientData.phase_used);
      expect(growNutrient.notes).to.equal(growNutrientData.notes);
    });
  });

  describe('Validation', () => {
    it('should require grow_id', async () => {
      const growNutrientData = {
        nutrient_id: testNutrient.id,
      };

      await expect(GrowNutrient.create(growNutrientData)).rejected;
    });

    it('should require nutrient_id', async () => {
      const growNutrientData = {
        grow_id: testGrow.id,
      };

      await expect(GrowNutrient.create(growNutrientData)).rejected;
    });

    it('should enforce unique constraint on grow_id + nutrient_id', async () => {
      const nutrient3 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 3',
        product_name: 'Test Nutrient 3',
      });

      await GrowNutrient.create({
        grow_id: testGrow.id,
        nutrient_id: nutrient3.id,
      });

      // Try to create duplicate
      const duplicateData = {
        grow_id: testGrow.id,
        nutrient_id: nutrient3.id,
      };

      await expect(GrowNutrient.create(duplicateData)).rejected;
    });

    it('should validate frequency enum', async () => {
      const nutrient4 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 4',
        product_name: 'Test Nutrient 4',
      });

      const growNutrientData = {
        grow_id: testGrow.id,
        nutrient_id: nutrient4.id,
        frequency: 'invalid' as any,
      };

      await expect(GrowNutrient.create(growNutrientData)).rejected;

      // Valid frequencies
      const validFrequencies = ['every_watering', 'weekly', 'biweekly', 'as_needed'];
      for (const freq of validFrequencies) {
        const nutrient = await Nutrient.create({
          user_id: testUser.id,
          brand: 'Test Brand',
          product_name: `Test Nutrient ${freq}`,
        });
        const validGrowNutrient = await GrowNutrient.create({
          grow_id: testGrow.id,
          nutrient_id: nutrient.id,
          frequency: freq as any,
        });
        expect(validGrowNutrient.frequency).to.equal(freq);
      }
    });

    it('should validate phase_used enum', async () => {
      const nutrient5 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 5',
        product_name: 'Test Nutrient 5',
      });

      const growNutrientData = {
        grow_id: testGrow.id,
        nutrient_id: nutrient5.id,
        phase_used: 'invalid' as any,
      };

      await expect(GrowNutrient.create(growNutrientData)).rejected;

      // Valid phases
      const validPhases = ['all', 'vegetative', 'flowering', 'late_flowering'];
      for (const phase of validPhases) {
        const nutrient = await Nutrient.create({
          user_id: testUser.id,
          brand: 'Test Brand',
          product_name: `Test Nutrient phase ${phase}`,
        });
        const validGrowNutrient = await GrowNutrient.create({
          grow_id: testGrow.id,
          nutrient_id: nutrient.id,
          phase_used: phase as any,
        });
        expect(validGrowNutrient.phase_used).to.equal(phase);
      }
    });

    it('should validate dosage_ml_per_gallon minimum', async () => {
      const nutrient6 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 6',
        product_name: 'Test Nutrient 6',
      });

      const growNutrientData = {
        grow_id: testGrow.id,
        nutrient_id: nutrient6.id,
        dosage_ml_per_gallon: -1,
      };

      await expect(GrowNutrient.create(growNutrientData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a grow', async () => {
      const nutrient7 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 7',
        product_name: 'Test Nutrient 7',
      });

      const growNutrient = await GrowNutrient.create({
        grow_id: testGrow.id,
        nutrient_id: nutrient7.id,
      });

      const growNutrientWithGrow = await GrowNutrient.findOne({
        where: { id: growNutrient.id },
        include: [{ model: Grow, as: 'grow' }],
      });

      expect(growNutrientWithGrow).to.exist;
      expect((growNutrientWithGrow as any)?.grow).to.exist;
      expect((growNutrientWithGrow as any)?.grow?.id).to.equal(testGrow.id);
    });

    it('should associate with a nutrient', async () => {
      const nutrient8 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 8',
        product_name: 'Test Nutrient 8',
      });

      const growNutrient = await GrowNutrient.create({
        grow_id: testGrow.id,
        nutrient_id: nutrient8.id,
      });

      const growNutrientWithNutrient = await GrowNutrient.findOne({
        where: { id: growNutrient.id },
        include: [{ model: Nutrient, as: 'nutrient' }],
      });

      expect(growNutrientWithNutrient).to.exist;
      expect((growNutrientWithNutrient as any)?.nutrient).to.exist;
      expect((growNutrientWithNutrient as any)?.nutrient?.id).to.equal(nutrient8.id);
    });

    it('should not create grow nutrient with non-existent grow', async () => {
      const growNutrientData = {
        grow_id: '00000000-0000-0000-0000-000000000000',
        nutrient_id: testNutrient.id,
      };

      await expect(GrowNutrient.create(growNutrientData)).rejected;
    });

    it('should not create grow nutrient with non-existent nutrient', async () => {
      const growNutrientData = {
        grow_id: testGrow.id,
        nutrient_id: '00000000-0000-0000-0000-000000000000',
      };

      await expect(GrowNutrient.create(growNutrientData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update grow nutrient details', async () => {
      const nutrient9 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 9',
        product_name: 'Test Nutrient 9',
      });

      const growNutrient = await GrowNutrient.create({
        grow_id: testGrow.id,
        nutrient_id: nutrient9.id,
        dosage_ml_per_gallon: 5.0,
      });

      const updates = {
        dosage_ml_per_gallon: 7.5,
        frequency: 'every_watering' as const,
        phase_used: 'flowering' as const,
        notes: 'Increased dosage for flowering',
      };

      await growNutrient.update(updates);

      expect(Number(growNutrient.dosage_ml_per_gallon)).to.equal(updates.dosage_ml_per_gallon);
      expect(growNutrient.frequency).to.equal(updates.frequency);
      expect(growNutrient.phase_used).to.equal(updates.phase_used);
      expect(growNutrient.notes).to.equal(updates.notes);
    });
  });

  describe('toJSON', () => {
    it('should convert DECIMAL dosage_ml_per_gallon to number', async () => {
      const nutrient10 = await Nutrient.create({
        user_id: testUser.id,
        brand: 'Test Brand 10',
        product_name: 'Test Nutrient 10',
      });

      const growNutrient = await GrowNutrient.create({
        grow_id: testGrow.id,
        nutrient_id: nutrient10.id,
        dosage_ml_per_gallon: 10.5,
      });

      const json = growNutrient.toJSON();

      expect(typeof json.dosage_ml_per_gallon).to.equal('number');
      expect(json.dosage_ml_per_gallon).to.equal(10.5);
    });
  });
});
