import { testHelper } from '../mocha.setup';
import { PlantProfile } from '../../models/PlantProfile';
import { expect } from 'chai';

let authToken: string;
let testUser: any;
let testProfile: any;

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

  // Create a test plant profile
  testProfile = await PlantProfile.create({
    common_name: 'Tomato',
    name: 'Tomato',
    species: 'Solanum lycopersicum',
    type: 'vegetable',
    difficulty: 'easy',
    indoor_outdoor: 'outdoor',
    zone_min: 3,
    zone_max: 10,
    default_water_interval_days: 3,
    default_fert_interval_days: 14,
    sunlight_requirements: 'full_sun',
    description: 'A popular garden vegetable',
  });
});

describe('Get Plant Profiles API', () => {
  it('should get all plant profiles', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('plantProfiles');
    expect(response.body.plantProfiles).to.be.an('array');
    expect(response.body).to.have.property('total');
    expect(response.body).to.have.property('page');
    expect(response.body).to.have.property('limit');
  });

  it('should filter plant profiles by type', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles?type=vegetable',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body.plantProfiles).to.be.an('array');
    // All returned profiles should be vegetables
    response.body.plantProfiles.forEach((profile: any) => {
      expect(profile.type).to.equal('vegetable');
    });
  });

  it('should filter plant profiles by difficulty', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles?difficulty=easy',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body.plantProfiles).to.be.an('array');
    // All returned profiles should be easy difficulty
    response.body.plantProfiles.forEach((profile: any) => {
      expect(profile.difficulty).to.equal('easy');
    });
  });

  it('should filter plant profiles by zone', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles?zone=5',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body.plantProfiles).to.be.an('array');
    // All returned profiles should be compatible with zone 5
    // Profiles with null zones (houseplants) should also be included
    response.body.plantProfiles.forEach((profile: any) => {
      if (profile.zone_min !== null && profile.zone_max !== null) {
        expect(profile.zone_min).to.be.lte(5);
        expect(profile.zone_max).to.be.gte(5);
      }
      // Profiles with null zones are valid (indoor plants work in any zone)
    });
  });

  it('should support pagination', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles?page=1&limit=5',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body.plantProfiles).to.be.an('array');
    expect(response.body.plantProfiles.length).to.be.lte(5);
    expect(response.body.page).to.equal(1);
    expect(response.body.limit).to.equal(5);
  });

  it('should fail to get plant profiles without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles',
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});

describe('Search Plant Profiles API', () => {
  it('should search plant profiles by query', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles/search?q=tomato',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    // Should find tomato in the results
    const hasTomato = response.body.some(
      (profile: any) => profile.common_name.toLowerCase().includes('tomato')
    );
    expect(hasTomato).to.be.true;
  });

  it('should return empty array for non-existent plant', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles/search?q=nonexistentplant123',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.equal(0);
  });

  it('should fail to search without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/plant-profiles/search?q=tomato',
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});

describe('Get Single Plant Profile API', () => {
  it('should get a single plant profile by id', async () => {
    if (!testProfile) {
      throw new Error('Test profile not found. Make sure database is seeded.');
    }

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/plant-profiles/${testProfile.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('profile');
    expect(response.body.profile).to.have.property('common_name');
    expect(response.body.profile.common_name).to.equal('Tomato');
    expect(response.body).to.have.property('seasonalTips');
    expect(response.body.seasonalTips).to.be.an('array');
  });

  it('should return 404 for non-existent profile', async () => {
    const fakeId = 99999;
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/plant-profiles/${fakeId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(404);
  });

  it('should fail to get profile without authentication', async () => {
    if (!testProfile) {
      throw new Error('Test profile not found. Make sure database is seeded.');
    }

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/plant-profiles/${testProfile.id}`,
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});
