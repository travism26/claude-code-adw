import { testHelper } from '../mocha.setup';
import { Grow, Nutrient, GrowNutrient } from '../../models';
import { expect } from 'chai';

let authToken: string;
let testUser: any;
let testGrow: Grow;
let testNutrient: Nutrient;
let growNutrient: GrowNutrient;

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

  testGrow = await Grow.create({
    user_id: testUser.id,
    strain_name: 'Test Strain',
    started_at: new Date(),
  });

  testNutrient = await Nutrient.create({
    user_id: null,
    brand: 'Test Brand',
    product_name: 'Test Nutrient',
    type: 'base',
  });

  growNutrient = await GrowNutrient.create({
    grow_id: testGrow.id,
    nutrient_id: testNutrient.id,
    dosage_ml_per_gallon: 5,
    frequency: 'weekly',
  });
});

afterEach(async () => {
  // Clean up test nutrient
  if (testNutrient) {
    await testNutrient.destroy({ force: true });
  }
});

describe('Update Grow Nutrient', () => {
  it('should update grow nutrient dosage and frequency', async () => {
    const updateData = {
      dosage_ml_per_gallon: 10,
      frequency: 'every_watering',
      phase_used: 'flowering',
      notes: 'Increased dosage',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-nutrients/${growNutrient.id}`,
      body: updateData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.dosage_ml_per_gallon).to.equal(10);
    expect(response.body.frequency).to.equal('every_watering');
    expect(response.body.phase_used).to.equal('flowering');
    expect(response.body.notes).to.equal('Increased dosage');
  });

  it('should return 404 for non-existent grow nutrient', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-nutrients/${fakeId}`,
      body: { dosage_ml_per_gallon: 5 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should deny access to other users grow nutrients', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const anotherLogin = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: anotherUser.email, password: 'test-password' },
      headers: {},
    });
    const anotherToken = anotherLogin.body.accessToken;

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-nutrients/${growNutrient.id}`,
      body: { dosage_ml_per_gallon: 100 },
      headers: { Authorization: `Bearer ${anotherToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Delete Grow Nutrient', () => {
  it('should remove nutrient from grow', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-nutrients/${growNutrient.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    const deleted = await GrowNutrient.findByPk(growNutrient.id);
    expect(deleted).to.be.null;
  });

  it('should return 404 for non-existent grow nutrient', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-nutrients/${fakeId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should deny deletion of other users grow nutrients', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const anotherLogin = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: anotherUser.email, password: 'test-password' },
      headers: {},
    });
    const anotherToken = anotherLogin.body.accessToken;

    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-nutrients/${growNutrient.id}`,
      headers: { Authorization: `Bearer ${anotherToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});
