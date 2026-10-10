import { testHelper } from '../mocha.setup';
import { Nutrient } from '../../models';
import { expect } from 'chai';

let authToken: string;
let testUser: any;
let systemNutrient: Nutrient;
let userNutrient: Nutrient;
let systemNutrientWasCreated: boolean;

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

  // Find or create system nutrient
  const [sysNutrient, created] = await Nutrient.findOrCreate({
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
  systemNutrient = sysNutrient;
  systemNutrientWasCreated = created;

  // Create user nutrient
  userNutrient = await Nutrient.create({
    user_id: testUser.id,
    brand: 'Custom Brand',
    product_name: 'My Mix',
    type: 'supplement',
    is_organic: true,
  });
});

afterEach(async () => {
  // Clean up test nutrients (only system nutrient if we created it)
  if (systemNutrient && systemNutrientWasCreated) {
    await systemNutrient.destroy({ force: true });
  }
  if (userNutrient) {
    await userNutrient.destroy({ force: true });
  }
});

describe('Get Nutrients', () => {
  it('should get all nutrients (system + user)', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/nutrients',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    // GET /nutrients is enveloped as { nutrients: [...] } (BUG-005).
    expect(response.body.nutrients).to.be.an('array');
    expect(response.body.nutrients.length).to.be.at.least(2);
  });

  it('should filter nutrients by brand', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/nutrients?brand=General',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.nutrients).to.be.an('array');
    expect(response.body.nutrients.some((n: any) => n.brand.includes('General'))).to.be.true;
  });

  it('should filter nutrients by type', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/nutrients?type=base',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.nutrients).to.be.an('array');
    expect(response.body.nutrients.every((n: any) => n.type === 'base')).to.be.true;
  });

  it('should filter nutrients by organic status', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/nutrients?is_organic=true',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.nutrients).to.be.an('array');
    expect(response.body.nutrients.every((n: any) => n.is_organic === true)).to.be.true;
  });
});

describe('Create Nutrient', () => {
  it('should create a custom nutrient', async () => {
    const nutrientData = {
      brand: 'Fox Farm',
      product_name: 'Grow Big',
      type: 'base',
      npk_ratio: '6-4-4',
      description: 'Liquid plant food',
      is_organic: true,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/nutrients',
      body: nutrientData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.brand).to.equal(nutrientData.brand);
    expect(response.body.product_name).to.equal(nutrientData.product_name);
    expect(response.body.user_id).to.equal(testUser.id);
  });

  it('should create nutrient with minimal fields', async () => {
    const nutrientData = {
      brand: 'Test Brand',
      product_name: 'Test Product',
      type: 'additive',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/nutrients',
      body: nutrientData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.brand).to.equal(nutrientData.brand);
  });

  it('should fail without required fields', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/nutrients',
      body: { brand: 'Test' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });
});

describe('Get Single Nutrient', () => {
  it('should get system nutrient', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/nutrients/${systemNutrient.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.id).to.equal(systemNutrient.id);
    expect(response.body.user_id).to.be.null;
  });

  it('should get own custom nutrient', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/nutrients/${userNutrient.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.id).to.equal(userNutrient.id);
  });

  it('should not get other users custom nutrient', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const otherNutrient = await Nutrient.create({
      user_id: anotherUser.id,
      brand: 'Other Brand',
      product_name: 'Other Product',
      type: 'base',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/nutrients/${otherNutrient.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Update Nutrient', () => {
  it('should update custom nutrient', async () => {
    const updateData = {
      product_name: 'Updated Product Name',
      npk_ratio: '5-5-5',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/nutrients/${userNutrient.id}`,
      body: updateData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.product_name).to.equal(updateData.product_name);
    expect(response.body.npk_ratio).to.equal(updateData.npk_ratio);
  });

  it('should reject update of system nutrient', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/nutrients/${systemNutrient.id}`,
      body: { product_name: 'Hacked' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });

  it('should reject update of other users nutrient', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const otherNutrient = await Nutrient.create({
      user_id: anotherUser.id,
      brand: 'Other',
      product_name: 'Other',
      type: 'base',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/nutrients/${otherNutrient.id}`,
      body: { product_name: 'Hacked' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Delete Nutrient', () => {
  it('should delete custom nutrient', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/nutrients/${userNutrient.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    const deletedNutrient = await Nutrient.findByPk(userNutrient.id);
    expect(deletedNutrient).to.be.null;
  });

  it('should reject delete of system nutrient', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/nutrients/${systemNutrient.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(403);

    const stillExists = await Nutrient.findByPk(systemNutrient.id);
    expect(stillExists).to.exist;
  });
});
