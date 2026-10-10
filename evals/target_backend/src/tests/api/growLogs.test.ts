import { testHelper } from '../mocha.setup';
import { Grow, GrowLog, GrowLogEnvironment } from '../../models';
import { expect } from 'chai';

let authToken: string;
let testUser: any;
let testGrow: Grow;
let testLog: GrowLog;

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

  testLog = await GrowLog.create({
    grow_id: testGrow.id,
    logged_at: new Date(),
    day_number: 10,
  });
});

describe('Get Grow Log', () => {
  it('should get a single log by ID', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grow-logs/${testLog.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.id).to.equal(testLog.id);
    expect(response.body.day_number).to.equal(10);
  });

  it('should return 404 for non-existent log', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grow-logs/${fakeId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should deny access to other users logs', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const anotherLogin = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: anotherUser.email, password: 'test-password' },
      headers: {},
    });
    const anotherToken = anotherLogin.body.accessToken;

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grow-logs/${testLog.id}`,
      headers: { Authorization: `Bearer ${anotherToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Update Grow Log', () => {
  it('should update log fields', async () => {
    const updateData = {
      day_number: 15,
      height_inches: 18.5,
      notes: 'Updated notes',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-logs/${testLog.id}`,
      body: updateData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.day_number).to.equal(15);
    expect(response.body.height_inches).to.equal(18.5);
    expect(response.body.notes).to.equal('Updated notes');
  });
});

describe('Delete Grow Log', () => {
  it('should delete a log', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-logs/${testLog.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    const deletedLog = await GrowLog.findByPk(testLog.id);
    expect(deletedLog).to.be.null;
  });
});

describe('Log Environment Data', () => {
  it('should add environment data to log', async () => {
    const environmentData = {
      temperature_f: 72,
      humidity_percent: 55,
      ph: 6.0,
      ec: 1.5,
      light_hours: 18,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${testLog.id}/environment`,
      body: environmentData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.temperature_f).to.equal(72);
    expect(response.body.humidity_percent).to.equal(55);
    expect(response.body.ph).to.equal(6.0);
  });

  it('should reject duplicate environment creation', async () => {
    await GrowLogEnvironment.create({
      grow_log_id: testLog.id,
      temperature_f: 70,
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${testLog.id}/environment`,
      body: { temperature_f: 75 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(409);
  });

  it('should update environment data', async () => {
    await GrowLogEnvironment.create({
      grow_log_id: testLog.id,
      temperature_f: 70,
      humidity_percent: 50,
    });

    const updateData = {
      temperature_f: 75,
      humidity_percent: 60,
      vpd: 1.2,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-logs/${testLog.id}/environment`,
      body: updateData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.temperature_f).to.equal(75);
    expect(response.body.humidity_percent).to.equal(60);
    expect(response.body.vpd).to.equal(1.2);
  });

  it('should return 404 when updating non-existent environment', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-logs/${testLog.id}/environment`,
      body: { temperature_f: 75 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});
