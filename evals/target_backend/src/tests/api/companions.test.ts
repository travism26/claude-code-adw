import { testHelper } from "../mocha.setup";
import { PlantCompanion, PlantProfile } from "../../models";
import { expect } from "chai";
import { v4 as uuidv4 } from "uuid";

let authToken: string;
let testUser: any;
let testProfile1: PlantProfile;
let testProfile2: PlantProfile;
let testProfile3: PlantProfile;

beforeEach(async () => {
  testHelper.clearTestUser();
  const uniqueEmail = `test-user-${Date.now()}@example.com`;
  testUser = await testHelper.createTestUser({ email: uniqueEmail });
  const loginResponse = await testHelper.executeRequest({
    httpMethod: "POST",
    path: "/api/auth/login",
    body: { email: testUser.email, password: "test-password" },
    headers: {},
  });
  authToken = loginResponse.body.accessToken;

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

  testProfile3 = await PlantProfile.create({
    name: "Fennel",
    common_name: "Fennel",
    type: "herb",
    default_water_interval_days: 3,
    difficulty: "moderate",
    indoor_outdoor: "outdoor",
  });
});

describe("Get All Companions API", () => {
  beforeEach(async () => {
    await PlantCompanion.create({
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
      notes: "Basil repels pests from tomatoes",
    });
    await PlantCompanion.create({
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile3.id,
      relationship: "harmful",
      notes: "Fennel inhibits tomato growth",
    });
  });

  it("should get all companions", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/companions",
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an("array");
    expect(response.body.length).to.be.gte(2);
  });
});

describe("Get Companions for Plant Profile", () => {
  beforeEach(async () => {
    await PlantCompanion.create({
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
      notes: "Basil repels pests",
    });
    await PlantCompanion.create({
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile3.id,
      relationship: "harmful",
      notes: "Fennel inhibits growth",
    });
  });

  it("should get companions for specific plant", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/companions/${testProfile1.id}`,
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property("plant");
    expect(response.body).to.have.property("beneficial");
    expect(response.body).to.have.property("harmful");
    expect(response.body.plant.id).to.equal(testProfile1.id);
  });

  it("should separate beneficial and harmful companions", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/companions/${testProfile1.id}`,
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.beneficial).to.be.an("array");
    expect(response.body.harmful).to.be.an("array");
    expect(response.body.beneficial.length).to.equal(1);
    expect(response.body.harmful.length).to.equal(1);
  });

  it("should return 404 for non-existent plant profile", async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/companions/${uuid}`,
      headers: {},
    });

    expect(response.statusCode).to.equal(404);
  });

  it("should work with plant as either plant_a or plant_b", async () => {
    // Create a companion where testProfile2 is plant_a
    const profile4 = await PlantProfile.create({
      name: "Carrot",
      common_name: "Carrot",
      type: "vegetable",
      default_water_interval_days: 2,
      difficulty: "easy",
      indoor_outdoor: "outdoor",
    });

    await PlantCompanion.create({
      plant_a_id: profile4.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
    });

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/companions/${testProfile2.id}`,
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.beneficial.length).to.be.gte(1);
  });
});

describe("Create Companion API", () => {
  it("should create a companion relationship", async () => {
    const companionData = {
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
      notes: "Great combination",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property("id");
    expect(response.body.relationship).to.equal("beneficial");
  });

  it("should create harmful relationship", async () => {
    const companionData = {
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile3.id,
      relationship: "harmful",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.relationship).to.equal("harmful");
  });

  it("should fail with invalid plant IDs", async () => {
    const companionData = {
      plant_a_id: uuidv4(),
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it("should prevent duplicate relationships", async () => {
    const companionData = {
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
    };

    // Create first
    await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Try to create duplicate
    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body.error).to.include("already exists");
  });

  it("should prevent duplicate in reverse order", async () => {
    const companionData = {
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
    };

    // Create first
    await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Try to create in reverse order
    const reverseData = {
      plant_a_id: testProfile2.id,
      plant_b_id: testProfile1.id,
      relationship: "beneficial",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: reverseData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it("should fail with invalid relationship type", async () => {
    const companionData = {
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "neutral",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it("should require authentication", async () => {
    const companionData = {
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/companions",
      body: companionData,
      headers: { Authorization: "test-token" },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe("Delete Companion API", () => {
  let testCompanion: PlantCompanion;

  beforeEach(async () => {
    testCompanion = await PlantCompanion.create({
      plant_a_id: testProfile1.id,
      plant_b_id: testProfile2.id,
      relationship: "beneficial",
    });
  });

  it("should delete a companion relationship", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "DELETE",
      path: `/api/companions/${testCompanion.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
  });

  it("should fail to delete non-existent companion", async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: "DELETE",
      path: `/api/companions/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it("should require authentication", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "DELETE",
      path: `/api/companions/${testCompanion.id}`,
      headers: { Authorization: "test-token" },
    });

    expect(response.statusCode).to.equal(401);
  });
});
