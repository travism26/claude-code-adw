import { testHelper } from '../mocha.setup';
import { expect } from 'chai';

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

describe('Zone Detection API', () => {
  it('should detect zone from US ZIP code', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/zones/detect',
      body: { postal_code: '02134' }, // Boston, MA - should be zone 6-7
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('zone');
    expect(response.body.zone).to.be.a('string');
    expect(response.body).to.have.property('postal_code', '02134');
  });

  it('should detect zone from Canadian postal code', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/zones/detect',
      body: { postal_code: 'M5H' }, // Toronto - should be zone 5-6
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('zone');
    expect(response.body.zone).to.be.a('string');
  });

  it('should return error for invalid postal code', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/zones/detect',
      body: { postal_code: 'INVALID' },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(400);
    expect(response.body).to.have.property('message');
  });

  it('should require postal_code parameter', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/zones/detect',
      body: {},
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(400);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/zones/detect',
      body: { postal_code: '02134' },
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});

describe('Get User Zone API', () => {
  it('should get user zone when not set', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/zones/user',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('growing_zone');
    expect(response.body).to.have.property('postal_code');
    expect(response.body).to.have.property('zone_override');
  });

  it('should get user zone after detection', async () => {
    // First, detect and save a zone
    await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: '/api/zones/user',
      body: { growing_zone: '6a', postal_code: '02134' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Then get the zone
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/zones/user',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body.growing_zone).to.equal('6a');
    expect(response.body.postal_code).to.equal('02134');
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/zones/user',
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});

describe('Update User Zone API', () => {
  it('should update user zone with valid data', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: '/api/zones/user',
      body: {
        growing_zone: '7b',
        postal_code: '20001',
        zone_override: false,
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('growing_zone', '7b');
    expect(response.body).to.have.property('postal_code', '20001');
    expect(response.body).to.have.property('zone_override', false);
  });

  it('should update zone with manual override', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: '/api/zones/user',
      body: {
        growing_zone: '9a',
        zone_override: true,
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(200);
    expect(response.body.growing_zone).to.equal('9a');
    expect(response.body.zone_override).to.equal(true);
  });

  it('should validate zone format', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: '/api/zones/user',
      body: {
        growing_zone: 'invalid-zone',
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(400);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: '/api/zones/user',
      body: { growing_zone: '7b' },
      headers: { Authorization: `test-token` },
    });
    expect(response.statusCode).to.equal(401);
  });
});
