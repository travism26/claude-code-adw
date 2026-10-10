import { testHelper } from '../mocha.setup';
import { Plant } from '../../models/Plant';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

let authToken: string;
let testUser: any;

beforeEach(async () => {
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
});

describe('Create Plant API', () => {
  it('should create a plant with valid data', async () => {
    const plantData = {
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
    };
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/plants',
      body: plantData,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
  });

  it('should fail to create plant without authentication', async () => {
    const plantData = {
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
    };
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/plants',
      body: plantData,
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });

  it('should fail to create plant with invalid data', async () => {
    const plantData = {
      name: '', // Invalid: empty name
      type: 'invalid', // Invalid: not indoor/outdoor
      water_interval_days: 0, // Invalid: less than 1
      species: 'Test Species',
      photo_url: 'not-a-url', // Invalid: not a URL
    };
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/plants',
      body: plantData,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(400);
  });
});

describe('Get Plants', () => {
  beforeEach(async () => {
    // Create test plants with user_id
    await Plant.create({
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
      user_id: testUser.id, // Add user_id
    });
    await Plant.create({
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
      user_id: testUser.id, // Add user_id
    });
  });

  it('should get all plants for authenticated user', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plants',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
  });

  it('should fail to get plants without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plants',
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});

describe('Get Single Plant', () => {
  let testPlant: any;

  beforeEach(async () => {
    testPlant = await Plant.create({
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
      user_id: testUser.id, // Add user_id directly in create
    });
  });

  it('should get a single plant by id', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/plants/${testPlant.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
  });

  it('should fail to get non-existent plant', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/plants/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(404);
  });
});

describe('Update Plant', () => {
  let testPlant: any;

  beforeEach(async () => {
    testPlant = await Plant.create({
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
      user_id: testUser.id, // Add user_id directly in create
    });
  });

  it('should update a plant with valid data', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/plants/${testPlant.id}`,
      body: {
        name: 'Updated Plant',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
  });

  it('should fail to update non-existent plant', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/plants/${uuid}`,
      body: {
        name: 'Updated Plant',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(404);
  });
});

describe('Delete Plant', () => {
  let testPlant: any;

  beforeEach(async () => {
    testPlant = await Plant.create({
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
      user_id: testUser.id, // Add user_id directly in create
    });
  });

  it('should delete a plant', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/plants/${testPlant.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
  });

  it('should fail to delete non-existent plant', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/plants/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(404);
  });
});
