import { PlantCompanion, PlantProfile } from "../../models";
import { describe, it } from "mocha";
import { testHelper } from "../mocha.setup";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
use(chaiAsPromised);

describe("PlantCompanion Model", () => {
  let testProfile1: PlantProfile;
  let testProfile2: PlantProfile;

  before(async () => {
    await testHelper.createTestUser();

    testProfile1 = await PlantProfile.create({
      name: "Tomato",
      common_name: "Tomato",
      type: "vegetable",
      default_water_interval_days: 3,
      difficulty: "easy",
      indoor_outdoor: "outdoor",
    });

    testProfile2 = await PlantProfile.create({
      name: "Basil",
      common_name: "Basil",
      type: "herb",
      default_water_interval_days: 2,
      difficulty: "easy",
      indoor_outdoor: "both",
    });
  });

  describe("Creation", () => {
    it("should create a beneficial companion relationship", async () => {
      const companionData = {
        plant_a_id: testProfile1.id,
        plant_b_id: testProfile2.id,
        relationship: "beneficial" as const,
      };

      const companion = await PlantCompanion.create(companionData);

      expect(companion).to.exist;
      expect(companion.plant_a_id).to.equal(testProfile1.id);
      expect(companion.plant_b_id).to.equal(testProfile2.id);
      expect(companion.relationship).to.equal("beneficial");
      expect(companion.notes).to.be.null;
    });

    it("should create a harmful companion relationship", async () => {
      const profile3 = await PlantProfile.create({
        name: "Fennel",
        common_name: "Fennel",
        type: "herb",
        default_water_interval_days: 2,
        difficulty: "moderate",
        indoor_outdoor: "outdoor",
      });

      const companionData = {
        plant_a_id: testProfile1.id,
        plant_b_id: profile3.id,
        relationship: "harmful" as const,
      };

      const companion = await PlantCompanion.create(companionData);

      expect(companion).to.exist;
      expect(companion.relationship).to.equal("harmful");
    });

    it("should create a companion relationship with notes", async () => {
      const profile4 = await PlantProfile.create({
        name: "Marigold",
        common_name: "Marigold",
        type: "flower",
        default_water_interval_days: 2,
        difficulty: "easy",
        indoor_outdoor: "outdoor",
      });

      const companionData = {
        plant_a_id: testProfile1.id,
        plant_b_id: profile4.id,
        relationship: "beneficial" as const,
        notes: "Marigolds repel aphids and other pests from tomatoes",
      };

      const companion = await PlantCompanion.create(companionData);

      expect(companion).to.exist;
      expect(companion.notes).to.equal(companionData.notes);
    });
  });

  describe("Validation", () => {
    it("should require plant_a_id", async () => {
      const companionData = {
        plant_b_id: testProfile2.id,
        relationship: "beneficial" as const,
      };

      await expect(PlantCompanion.create(companionData)).rejected;
    });

    it("should require plant_b_id", async () => {
      const companionData = {
        plant_a_id: testProfile1.id,
        relationship: "beneficial" as const,
      };

      await expect(PlantCompanion.create(companionData)).rejected;
    });

    it("should require relationship", async () => {
      const profile5 = await PlantProfile.create({
        name: "Carrot",
        common_name: "Carrot",
        type: "vegetable",
        default_water_interval_days: 3,
        difficulty: "easy",
        indoor_outdoor: "outdoor",
      });

      const companionData = {
        plant_a_id: testProfile1.id,
        plant_b_id: profile5.id,
      };

      await expect(PlantCompanion.create(companionData)).rejected;
    });

    it("should validate relationship enum values", async () => {
      const profile6 = await PlantProfile.create({
        name: "Cucumber",
        common_name: "Cucumber",
        type: "vegetable",
        default_water_interval_days: 2,
        difficulty: "easy",
        indoor_outdoor: "outdoor",
      });

      const companionData = {
        plant_a_id: testProfile1.id,
        plant_b_id: profile6.id,
        relationship: "neutral" as any,
      };

      await expect(PlantCompanion.create(companionData)).rejected;
    });
  });

  describe("Associations", () => {
    it("should associate with plant_a profile", async () => {
      const profile7 = await PlantProfile.create({
        name: "Lettuce",
        common_name: "Lettuce",
        type: "vegetable",
        default_water_interval_days: 2,
        difficulty: "easy",
        indoor_outdoor: "outdoor",
      });

      const companion = await PlantCompanion.create({
        plant_a_id: testProfile1.id,
        plant_b_id: profile7.id,
        relationship: "beneficial" as const,
      });

      const companionWithPlantA = await PlantCompanion.findOne({
        where: { id: companion.id },
        include: [{ model: PlantProfile, as: "plantA" }],
      });

      expect(companionWithPlantA).to.exist;
      expect((companionWithPlantA as any)?.plantA).to.exist;
      expect((companionWithPlantA as any)?.plantA?.id).to.equal(
        testProfile1.id
      );
    });

    it("should associate with plant_b profile", async () => {
      const profile8 = await PlantProfile.create({
        name: "Pepper",
        common_name: "Pepper",
        type: "vegetable",
        default_water_interval_days: 3,
        difficulty: "moderate",
        indoor_outdoor: "outdoor",
      });

      const companion = await PlantCompanion.create({
        plant_a_id: testProfile1.id,
        plant_b_id: profile8.id,
        relationship: "beneficial" as const,
      });

      const companionWithPlantB = await PlantCompanion.findOne({
        where: { id: companion.id },
        include: [{ model: PlantProfile, as: "plantB" }],
      });

      expect(companionWithPlantB).to.exist;
      expect((companionWithPlantB as any)?.plantB).to.exist;
      expect((companionWithPlantB as any)?.plantB?.id).to.equal(profile8.id);
    });

    it("should not create companion with non-existent plant profile", async () => {
      const companionData = {
        plant_a_id: "00000000-0000-0000-0000-000000000000",
        plant_b_id: testProfile2.id,
        relationship: "beneficial" as const,
      };

      await expect(PlantCompanion.create(companionData)).rejected;
    });
  });

  describe("Updates", () => {
    it("should update companion relationship details", async () => {
      const profile9 = await PlantProfile.create({
        name: "Spinach",
        common_name: "Spinach",
        type: "vegetable",
        default_water_interval_days: 2,
        difficulty: "easy",
        indoor_outdoor: "outdoor",
      });

      const companion = await PlantCompanion.create({
        plant_a_id: testProfile1.id,
        plant_b_id: profile9.id,
        relationship: "beneficial" as const,
      });

      const updates = {
        relationship: "harmful" as const,
        notes: "Updated relationship based on new research",
      };

      await companion.update(updates);

      expect(companion.relationship).to.equal(updates.relationship);
      expect(companion.notes).to.equal(updates.notes);
    });
  });
});
