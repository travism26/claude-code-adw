import { testHelper } from '../mocha.setup';
import { Grow, GrowLog, GrowHarvest, Nutrient } from '../../models';
import { expect } from 'chai';

let authToken: string;
let testUser: any;
let testGrow: Grow;
let testNutrient: Nutrient;
let nutrientWasCreated: boolean;

beforeEach(async () => {
  testHelper.clearTestUser();
  const uniqueEmail = `test-user-${Date.now()}@example.com`;
  testUser = await testHelper.createTestUser({ email: uniqueEmail });
  const loginResponse = await testHelper.executeRequest({
    httpMethod: 'POST',
    path: '/api/auth/login',
    body: { email: testUser.email, password: 'test-password' },
    headers: {},
  });
  authToken = loginResponse.body.accessToken;

  // Find or create test nutrient (system nutrient)
  const [nutrient, created] = await Nutrient.findOrCreate({
    where: {
      user_id: null,
      brand: 'General Hydroponics',
      product_name: 'FloraGro',
    },
    defaults: {
      type: 'base',
      npk_ratio: '2-1-6',
      is_organic: false,
    },
  });
  testNutrient = nutrient;
  nutrientWasCreated = created;
});

afterEach(async () => {
  // Clean up test nutrient only if we created it (not seeded data)
  if (testNutrient && nutrientWasCreated) {
    await testNutrient.destroy({ force: true });
  }
});

describe('Create Grow API', () => {
  it('should create a grow with required fields only', async () => {
    const growData = {
      strain_name: 'Blue Dream',
      started_at: new Date().toISOString(),
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/grows',
      body: growData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property('id');
    expect(response.body.strain_name).to.equal(growData.strain_name);
    expect(response.body.phase).to.equal('germination');
    expect(response.body.plant_count).to.equal(1);
  });

  it('should create a grow with all fields', async () => {
    const growData = {
      strain_name: 'Northern Lights',
      started_at: new Date().toISOString(),
      strain_type: 'indica',
      grow_method: 'hydro',
      grow_medium: 'Coco Coir',
      light_type: 'led',
      light_wattage: 600,
      grow_space_sqft: 16,
      pot_size_gallons: 5,
      plant_count: 4,
      notes: 'First hydro grow',
      is_public: false,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/grows',
      body: growData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.strain_name).to.equal(growData.strain_name);
    expect(response.body.strain_type).to.equal(growData.strain_type);
    expect(response.body.grow_method).to.equal(growData.grow_method);
    expect(response.body.light_wattage).to.equal(growData.light_wattage);
    expect(response.body.plant_count).to.equal(growData.plant_count);
  });

  it('should fail without required fields', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/grows',
      body: { strain_name: 'Test Strain' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/grows',
      body: { strain_name: 'Test', started_at: new Date().toISOString() },
      headers: { Authorization: 'invalid-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Get Grows', () => {
  beforeEach(async () => {
    await Grow.create({
      user_id: testUser.id,
      strain_name: 'OG Kush',
      started_at: new Date('2024-01-01'),
      phase: 'vegetative',
    });
    await Grow.create({
      user_id: testUser.id,
      strain_name: 'Sour Diesel',
      started_at: new Date('2024-02-01'),
      phase: 'flowering',
    });
  });

  it('should get all grows for user', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/grows',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('grows');
    expect(response.body).to.have.property('total');
    expect(response.body.grows).to.be.an('array');
    expect(response.body.grows.length).to.equal(2);
    expect(response.body.total).to.equal(2);
  });

  it('should filter grows by phase', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/grows?phase=vegetative',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('grows');
    expect(response.body).to.have.property('total');
    expect(response.body.grows).to.be.an('array');
    expect(response.body.grows.length).to.equal(1);
    expect(response.body.total).to.equal(1);
    expect(response.body.grows[0].phase).to.equal('vegetative');
  });

  it('should filter grows by strain name', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/grows?strain_name=Sour',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('grows');
    expect(response.body).to.have.property('total');
    expect(response.body.grows).to.be.an('array');
    expect(response.body.grows.length).to.equal(1);
    expect(response.body.total).to.equal(1);
    expect(response.body.grows[0].strain_name).to.equal('Sour Diesel');
  });
});

describe('Get Single Grow', () => {
  beforeEach(async () => {
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
  });

  it('should get a single grow with associations', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${testGrow.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.id).to.equal(testGrow.id);
    expect(response.body).to.have.property('logs');
    expect(response.body).to.have.property('nutrients');
  });

  it('should return 404 for non-existent grow', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${fakeId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Update Grow', () => {
  beforeEach(async () => {
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Original Strain',
      started_at: new Date(),
    });
  });

  it('should update grow fields', async () => {
    const updateData = {
      strain_name: 'Updated Strain',
      notes: 'Added some notes',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${testGrow.id}`,
      body: updateData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.strain_name).to.equal(updateData.strain_name);
    expect(response.body.notes).to.equal(updateData.notes);
  });

  it('should return 404 for non-existent grow', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${fakeId}`,
      body: { notes: 'test' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Delete Grow', () => {
  beforeEach(async () => {
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
  });

  it('should delete a grow', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grows/${testGrow.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    const deletedGrow = await Grow.findByPk(testGrow.id);
    expect(deletedGrow).to.be.null;
  });

  it('should cascade delete logs when grow is deleted', async () => {
    const log = await GrowLog.create({
      grow_id: testGrow.id,
      logged_at: new Date(),
    });

    await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grows/${testGrow.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const deletedLog = await GrowLog.findByPk(log.id);
    expect(deletedLog).to.be.null;
  });
});

describe('Update Grow Phase', () => {
  beforeEach(async () => {
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
      phase: 'germination',
    });
  });

  it('should update grow phase', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${testGrow.id}/phase`,
      body: { phase: 'vegetative' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.phase).to.equal('vegetative');
    expect(response.body.phase_started_at).to.exist;
  });

  it('should fail with invalid phase', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${testGrow.id}/phase`,
      body: { phase: 'invalid' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });
});

describe('Grow Logs', () => {
  beforeEach(async () => {
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
  });

  it('should create a log for grow', async () => {
    const logData = {
      logged_at: new Date().toISOString(),
      day_number: 15,
      phase: 'vegetative',
      height_inches: 12.5,
      notes: 'Looking healthy',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/logs`,
      body: logData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.day_number).to.equal(logData.day_number);
    expect(response.body.height_inches).to.equal(logData.height_inches);
  });

  it('should create log with environment data', async () => {
    const logData = {
      logged_at: new Date().toISOString(),
      notes: 'With environment',
      environment: {
        temperature_f: 75.5,
        humidity_percent: 60,
        ph: 6.5,
      },
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/logs`,
      body: logData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.environment).to.exist;
    expect(Number(response.body.environment.temperature_f)).to.equal(75.5);
    expect(Number(response.body.environment.humidity_percent)).to.equal(60);
    expect(Number(response.body.environment.ph)).to.equal(6.5);
  });

  it('should get logs for grow', async () => {
    await GrowLog.create({
      grow_id: testGrow.id,
      logged_at: new Date(),
      day_number: 1,
    });
    await GrowLog.create({
      grow_id: testGrow.id,
      logged_at: new Date(),
      day_number: 2,
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${testGrow.id}/logs`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    // GET /grows/:id/logs is paginated/enveloped: { logs, total, ... } (BUG-010).
    expect(response.body.logs).to.be.an('array');
    expect(response.body.logs.length).to.equal(2);
  });
});

describe('Grow Nutrients', () => {
  beforeEach(async () => {
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
  });

  it('should add nutrient to grow', async () => {
    const nutrientData = {
      nutrient_id: testNutrient.id,
      dosage_ml_per_gallon: 5,
      frequency: 'weekly',
      phase_used: 'vegetative',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/nutrients`,
      body: nutrientData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.dosage_ml_per_gallon).to.equal(5);
    expect(response.body.frequency).to.equal('weekly');
    expect(response.body.nutrient).to.exist;
  });

  it('should reject duplicate nutrient', async () => {
    await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/nutrients`,
      body: { nutrient_id: testNutrient.id },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/nutrients`,
      body: { nutrient_id: testNutrient.id },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(409);
  });

  it('should get nutrients for grow', async () => {
    await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/nutrients`,
      body: { nutrient_id: testNutrient.id },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${testGrow.id}/nutrients`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.equal(1);
  });
});

describe('Grow Harvest', () => {
  beforeEach(async () => {
    testGrow = await Grow.create({
      user_id: testUser.id,
      strain_name: 'Test Strain',
      started_at: new Date(),
    });
  });

  it('should create harvest for grow', async () => {
    const harvestData = {
      harvested_at: new Date().toISOString(),
      wet_weight_grams: 500,
      dry_weight_grams: 120,
      thc_percent: 18.5,
      quality_rating: 8,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/harvest`,
      body: harvestData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    // Harvest responses are enveloped as { harvest } (PR #15).
    expect(response.body.harvest.wet_weight_grams).to.equal(500);
    expect(response.body.harvest.dry_weight_grams).to.equal(120);
    expect(response.body.harvest.thc_percent).to.equal(18.5);
  });

  it('should reject second harvest for same grow', async () => {
    await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/harvest`,
      body: { harvested_at: new Date().toISOString() },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/harvest`,
      body: { harvested_at: new Date().toISOString() },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(409);
  });

  it('should get harvest for grow', async () => {
    await GrowHarvest.create({
      grow_id: testGrow.id,
      harvested_at: new Date(),
      dry_weight_grams: 100,
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${testGrow.id}/harvest`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.harvest.dry_weight_grams).to.equal(100);
  });

  it('should update harvest', async () => {
    await GrowHarvest.create({
      grow_id: testGrow.id,
      harvested_at: new Date(),
    });

    const updateData = {
      dry_weight_grams: 150,
      thc_percent: 20,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${testGrow.id}/harvest`,
      body: updateData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.harvest.dry_weight_grams).to.equal(150);
    expect(response.body.harvest.thc_percent).to.equal(20);
  });
});
