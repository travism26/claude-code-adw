import { testHelper } from '../mocha.setup';
import { Recommendation, Plant } from '../../models';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

let authToken: string;
let testUser: any;
let testPlant: Plant;

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

  testPlant = await Plant.create({
    user_id: testUser.id,
    name: 'Test Plant',
    type: 'indoor',
    water_interval_days: 7,
  });
});

describe('Get Recommendations API', () => {
  beforeEach(async () => {
    await Recommendation.create({
      user_id: testUser.id,
      plant_id: testPlant.id,
      type: 'water',
      message: 'Time to water your plant',
      severity: 'high',
    });
    await Recommendation.create({
      user_id: testUser.id,
      type: 'general',
      message: 'Check for pests',
      severity: 'low',
    });
    await Recommendation.create({
      user_id: testUser.id,
      plant_id: testPlant.id,
      type: 'fertilize',
      message: 'Time to fertilize',
      severity: 'medium',
    });
  });

  it('should get recommendations for user', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/recommendations',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.be.gte(3);
  });

  it('should filter by severity', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/recommendations?severity=high',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    response.body.forEach((rec: any) => {
      expect(rec.severity).to.equal('high');
    });
  });

  it('should filter by type', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/recommendations?type=water',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    response.body.forEach((rec: any) => {
      expect(rec.type).to.equal('water');
    });
  });

  it('should limit results', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/recommendations?limit=2',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.be.lte(2);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/recommendations',
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Get Recommendation Summary', () => {
  beforeEach(async () => {
    await Recommendation.create({
      user_id: testUser.id,
      type: 'water',
      message: 'Water message',
      severity: 'high',
    });
    await Recommendation.create({
      user_id: testUser.id,
      type: 'fertilize',
      message: 'Fertilize message',
      severity: 'medium',
    });
    await Recommendation.create({
      user_id: testUser.id,
      type: 'general',
      message: 'General message',
      severity: 'low',
    });
  });

  it('should get recommendation summary', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/recommendations/summary',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('total');
    expect(response.body).to.have.property('by_severity');
    expect(response.body).to.have.property('by_type');
    expect(response.body.total).to.equal(3);
    expect(response.body.by_severity.high).to.equal(1);
    expect(response.body.by_severity.medium).to.equal(1);
    expect(response.body.by_severity.low).to.equal(1);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/recommendations/summary',
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Generate Recommendations API', () => {
  it('should generate recommendations', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/recommendations/generate',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('message');
    expect(response.body).to.have.property('count');
    expect(response.body).to.have.property('recommendations');
  });

  it('should return empty for user with no plants', async () => {
    // Delete the test plant
    await testPlant.destroy();

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/recommendations/generate',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.count).to.equal(0);
  });

  it('should replace existing recommendations', async () => {
    // Create existing recommendation
    await Recommendation.create({
      user_id: testUser.id,
      type: 'general',
      message: 'Old recommendation',
      severity: 'low',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/recommendations/generate',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    // Verify old recommendations were deleted
    const oldRec = await Recommendation.findOne({
      where: { message: 'Old recommendation' },
    });
    expect(oldRec).to.be.null;
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/recommendations/generate',
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Delete Recommendation', () => {
  let testRecommendation: Recommendation;

  beforeEach(async () => {
    testRecommendation = await Recommendation.create({
      user_id: testUser.id,
      type: 'water',
      message: 'Recommendation to delete',
      severity: 'medium',
    });
  });

  it('should delete a recommendation', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/recommendations/${testRecommendation.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
  });

  it('should fail to delete non-existent recommendation', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/recommendations/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail to delete another users recommendation', async () => {
    const otherUser = await testHelper.createTestUser({
      email: `other-${Date.now()}@example.com`,
    });
    const otherRec = await Recommendation.create({
      user_id: otherUser.id,
      type: 'general',
      message: 'Other user rec',
      severity: 'low',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/recommendations/${otherRec.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/recommendations/${testRecommendation.id}`,
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});
