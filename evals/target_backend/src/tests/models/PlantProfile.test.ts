import { expect } from "chai";
import { PlantProfile } from "../../models/PlantProfile";
import { SeasonalTip } from "../../models/SeasonalTip";

describe("PlantProfile Model", () => {
  afterEach(async () => {
    // Clean up test data after each test
    // Delete SeasonalTips first due to foreign key constraint
    const profiles = await PlantProfile.findAll({
      where: { name: "Test Plant Profile" },
    });
    for (const profile of profiles) {
      await SeasonalTip.destroy({ where: { plant_profile_id: profile.id } });
    }
    await PlantProfile.destroy({ where: { name: "Test Plant Profile" } });
  });

  it("should create a plant profile with valid data", async () => {
    const profile = await PlantProfile.create({
      name: "Test Plant Profile",
      common_name: "Test Plant",
      species: "Testus plantus",
      type: "vegetable",
      difficulty: "easy",
      default_water_interval_days: 7,
      default_fert_interval_days: 14,
      sunlight_requirements: "full_sun",
      soil_type: "loamy",
      zone_min: 3,
      zone_max: 9,
      indoor_outdoor: "outdoor",
    });

    expect(profile).to.exist;
    expect(profile.name).to.equal("Test Plant Profile");
    expect(profile.species).to.equal("Testus plantus");
    expect(profile.type).to.equal("vegetable");
    expect(profile.difficulty).to.equal("easy");
  });

  it("should require name", async () => {
    try {
      await PlantProfile.create({
        species: "Testus plantus",
        type: "vegetable",
        default_water_interval_days: 7,
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.name).to.equal("SequelizeValidationError");
    }
  });

  it("should require type", async () => {
    try {
      await PlantProfile.create({
        name: "Test Plant Profile",
        species: "Testus plantus",
        default_water_interval_days: 7,
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.name).to.equal("SequelizeValidationError");
    }
  });

  it("should validate type values", async () => {
    try {
      await PlantProfile.create({
        name: "Test Plant Profile",
        type: "invalid-type",
        default_water_interval_days: 7,
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.name).to.equal("SequelizeValidationError");
    }
  });

  it("should validate difficulty values", async () => {
    try {
      await PlantProfile.create({
        name: "Test Plant Profile",
        type: "vegetable",
        difficulty: "invalid-level",
        default_water_interval_days: 7,
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.name).to.equal("SequelizeValidationError");
    }
  });

  it("should validate sunlight_requirements values", async () => {
    try {
      await PlantProfile.create({
        name: "Test Plant Profile",
        type: "vegetable",
        sunlight_requirements: "invalid-sunlight",
        default_water_interval_days: 7,
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.name).to.equal("SequelizeValidationError");
    }
  });

  it("should validate zone_min range", async () => {
    try {
      await PlantProfile.create({
        name: "Test Plant Profile",
        type: "vegetable",
        default_water_interval_days: 7,
        zone_min: 0, // Invalid: must be >= 1
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.name).to.equal("SequelizeValidationError");
    }
  });

  it("should validate zone_max range", async () => {
    try {
      await PlantProfile.create({
        name: "Test Plant Profile",
        type: "vegetable",
        default_water_interval_days: 7,
        zone_max: 14, // Invalid: must be <= 13
      } as any);
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.name).to.equal("SequelizeValidationError");
    }
  });

  it("should have association with SeasonalTip", async () => {
    const profile = await PlantProfile.create({
      name: "Test Plant Profile",
      type: "vegetable",
      default_water_interval_days: 7,
      zone_min: 3,
      zone_max: 9,
    });

    await SeasonalTip.create({
      plant_profile_id: profile.id,
      season: "spring",
      tip_text: "Test seasonal tip",
      zone_min: 5,
      zone_max: 7,
    });

    const profileWithTips = await PlantProfile.findByPk(profile.id, {
      include: [{ model: SeasonalTip, as: "tips" }],
    });

    expect(profileWithTips).to.exist;
    // Note: association name might be different, checking both possibilities
    const tips =
      (profileWithTips as any).tips || (profileWithTips as any).SeasonalTips;
    expect(tips).to.exist;
    expect(tips.length).to.equal(1);
    expect(tips[0].tip_text).to.equal("Test seasonal tip");
  });

  describe("icon_url validation", () => {
    it("should accept valid icon_url with .svg extension", async () => {
      const profile = await PlantProfile.create({
        name: "Test Plant Profile",
        type: "vegetable",
        default_water_interval_days: 7,
        indoor_outdoor: "outdoor",
        icon_url: "/plant-icons/vegetable/tomato.svg",
      });

      expect(profile).to.exist;
      expect(profile.icon_url).to.equal("/plant-icons/vegetable/tomato.svg");
    });

    it("should accept valid icon_url with .png extension", async () => {
      const profile = await PlantProfile.create({
        name: "Test Plant Profile",
        type: "herb",
        default_water_interval_days: 7,
        indoor_outdoor: "both",
        icon_url: "/plant-icons/herb/basil.png",
      });

      expect(profile).to.exist;
      expect(profile.icon_url).to.equal("/plant-icons/herb/basil.png");
    });

    it("should accept null icon_url", async () => {
      const profile = await PlantProfile.create({
        name: "Test Plant Profile",
        type: "flower",
        default_water_interval_days: 7,
        indoor_outdoor: "outdoor",
        icon_url: null,
      });

      expect(profile).to.exist;
      expect(profile.icon_url).to.be.null;
    });

    it("should reject icon_url with path traversal (..)", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/plant-icons/../../../etc/passwd",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("path traversal");
      }
    });

    it("should reject icon_url with double slashes", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/plant-icons//vegetable/tomato.svg",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("path traversal");
      }
    });

    it("should reject icon_url with backslashes", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/plant-icons\\vegetable\\tomato.svg",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("path traversal");
      }
    });

    it("should reject icon_url with system paths (/etc/)", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/etc/passwd",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("system directories");
      }
    });

    it("should reject icon_url with system paths (/var/)", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/var/log/secrets.txt",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("system directories");
      }
    });

    it("should reject icon_url without /plant-icons/ prefix", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/images/vegetable/tomato.svg",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("pattern");
      }
    });

    it("should reject icon_url with uppercase letters", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/plant-icons/vegetable/Tomato.svg",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("pattern");
      }
    });

    it("should reject icon_url with special characters in filename", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/plant-icons/vegetable/tom@to.svg",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("pattern");
      }
    });

    it("should reject icon_url with invalid plant type", async () => {
      try {
        await PlantProfile.create({
          name: "Test Plant Profile",
          type: "vegetable",
          default_water_interval_days: 7,
          indoor_outdoor: "outdoor",
          icon_url: "/plant-icons/invalid-type/tomato.svg",
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).to.equal("SequelizeValidationError");
        expect(error.message).to.include("pattern");
      }
    });
  });
});
