import { testHelper } from '../mocha.setup';
import { Plant } from '../../models/Plant';
import { CareHistory } from '../../models/CareHistory';
import { expect } from 'chai';

let authToken: string;
let testUser: any;
let testPlant: any;

beforeEach(async function () {
  this.timeout(10000); // Increase timeout for API operations

  // Clear any existing test user
  testHelper.clearTestUser();

  // Create a test user with a unique email for each test
  const uniqueEmail = `test-user-${Date.now()}@example.com`;
  testUser = await testHelper.createTestUser({ email: uniqueEmail });
  const loginResponse = await testHelper.executeRequest({
    httpMethod: 'POST',
    path: '/api/auth/login',
    body: { email: testUser.email, password: 'test-password' },
    headers: {}, // Explicitly pass empty headers to avoid auto-auth
  });
  authToken = loginResponse.body.accessToken;

  // Create a test plant
  testPlant = await Plant.create({
    name: 'Test Plant',
    type: 'indoor',
    water_interval_days: 7,
    species: 'Test Species',
    photo_url: 'https://example.com/plant.jpg',
    user_id: testUser.id,
  });
});

describe('Log Care Action API', () => {
  it('should log a water action', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'water',
        notes: 'Watered the plant today',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property('id');
    expect(response.body).to.have.property('action_type', 'water');
    expect(response.body).to.have.property('notes', 'Watered the plant today');
  });

  it('should log a fertilize action', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'fertilize',
        notes: 'Applied organic fertilizer',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    expect(response.body.action_type).to.equal('fertilize');
  });

  it('should log a prune action', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'prune',
        notes: 'Removed dead leaves',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    expect(response.body.action_type).to.equal('prune');
  });

  it('should log a harvest action', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'harvest',
        notes: 'Harvested 5 tomatoes',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    expect(response.body.action_type).to.equal('harvest');
  });

  it('should log a transplant action', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'transplant',
        notes: 'Moved to larger pot',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    expect(response.body.action_type).to.equal('transplant');
  });

  it('should log an other action', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'other',
        notes: 'Rotated plant for even sunlight',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    expect(response.body.action_type).to.equal('other');
  });

  it('should log action with custom date', async () => {
    const customDate = new Date('2024-01-15');
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'water',
        action_date: customDate.toISOString(),
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    const actionDate = new Date(response.body.action_date);
    expect(actionDate.toISOString().split('T')[0]).to.equal('2024-01-15');
  });

  it('should require plant_id', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        action_type: 'water',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(400);
  });

  it('should require action_type', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(400);
  });

  it('should validate action_type', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'invalid-action',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(400);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/care-history',
      body: {
        plant_id: testPlant.id,
        action_type: 'water',
      },
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});

describe('Get Care History API', () => {
  beforeEach(async function () {
    this.timeout(10000); // Increase timeout for API operations

    // Create some care history entries
    await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'water',
      notes: 'First watering',
      action_date: new Date('2024-01-01'),
    });
    await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'fertilize',
      notes: 'First fertilizing',
      action_date: new Date('2024-01-05'),
    });
    await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'prune',
      notes: 'First pruning',
      action_date: new Date('2024-01-10'),
    });
  });

  it('should get care history for specific plant', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/care-history/plant/${testPlant.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.equal(3);
  });

  it('should get all care history', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/care-history',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.be.gte(3);
  });

  it('should filter care history by action type', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/care-history?action_type=water',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    response.body.forEach((entry: any) => {
      expect(entry.action_type).to.equal('water');
    });
  });

  it('should limit care history results', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/care-history?limit=2',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.be.lte(2);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/care-history',
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});

describe('Delete Care History API', () => {
  let careHistoryEntry: any;

  beforeEach(async function () {
    this.timeout(10000); // Increase timeout for API operations

    careHistoryEntry = await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'water',
      notes: 'Test entry to delete',
    });
  });

  it('should delete care history entry', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/care-history/${careHistoryEntry.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('message', 'Care history entry deleted');
  });

  it('should return 404 for non-existent entry', async () => {
    const fakeId = 99999;
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/care-history/${fakeId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(404);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/care-history/${careHistoryEntry.id}`,
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});
