import { testHelper } from '../mocha.setup';
import { Grow, GrowHarvest } from '../../models';
import { expect } from 'chai';

let authToken: string;
let testUser: any;
let testGrow: Grow;
let testHarvest: GrowHarvest;

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

  testHarvest = await GrowHarvest.create({
    grow_id: testGrow.id,
    harvested_at: new Date(),
    wet_weight_grams: 500,
    dry_weight_grams: 120,
  });
});

describe('Delete Harvest', () => {
  it('should delete a harvest', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-harvests/${testHarvest.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    const deleted = await GrowHarvest.findByPk(testHarvest.id);
    expect(deleted).to.be.null;
  });

  it('should return 404 for non-existent harvest', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-harvests/${fakeId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should deny deletion of other users harvests', async () => {
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
      path: `/api/grow-harvests/${testHarvest.id}`,
      headers: { Authorization: `Bearer ${anotherToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Harvest DECIMAL Field Conversion', () => {
  it('should return DECIMAL fields as numbers', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${testGrow.id}/harvest`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    // Harvest responses are enveloped as { harvest } (PR #15).
    expect(typeof response.body.harvest.wet_weight_grams).to.equal('number');
    expect(typeof response.body.harvest.dry_weight_grams).to.equal('number');
    expect(response.body.harvest.wet_weight_grams).to.equal(500);
    expect(response.body.harvest.dry_weight_grams).to.equal(120);
  });
});

describe('Harvest Terpene Profile JSONB', () => {
  it('should handle terpene profile as JSON', async () => {
    const terpeneProfile = {
      myrcene: 0.5,
      limonene: 0.3,
      caryophyllene: 0.2,
    };

    // Need to delete first to avoid unique constraint
    await testHarvest.destroy();

    const createResponse = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grows/${testGrow.id}/harvest`,
      body: {
        harvested_at: new Date().toISOString(),
        terpene_profile: terpeneProfile,
      },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(createResponse.statusCode).to.equal(201);

    const getResponse = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${testGrow.id}/harvest`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(getResponse.statusCode).to.equal(200);
    expect(getResponse.body.harvest.terpene_profile).to.deep.equal(terpeneProfile);
  });
});
