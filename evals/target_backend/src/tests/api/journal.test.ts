import { testHelper } from '../mocha.setup';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

let authToken: string;
let testUser: any;

describe('Journal API', () => {
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

  it('should NOT create a journal entry with invalid plant ID', async () => {
    const plantId = uuidv4();
    const journalData = {
      plant_id: plantId,
      content: 'This is a test journal entry',
    };
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/journal',
      body: journalData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
    expect(response.body.error).to.equal('Plant not found or access denied');
  });

  it('should create a journal entry with valid data', async () => {
    const plantData = {
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      species: 'Test Species',
      photo_url: 'https://example.com/plant.jpg',
    };
    const plant_response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/plants',
      body: plantData,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const journalData = {
      plant_id: plant_response.body.plant.id,
      note: 'This is a test journal entry',
    };
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/journal',
      body: journalData,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.statusCode).to.equal(201);
    expect(response.body.entry.note).to.equal(journalData.note);
    expect(response.body.entry.plant_id).to.equal(journalData.plant_id);
    expect(response.body.entry.createdAt).to.be.a('string');
    expect(response.body.entry.updatedAt).to.be.a('string');
    expect(response.body.entry.id).to.be.a('string');
    expect(response.body.entry.entry_ts).to.be.a('string');
  });
});
