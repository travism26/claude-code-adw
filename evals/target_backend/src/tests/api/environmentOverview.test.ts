import { GrowEnvironment, User, Grow } from '../../models';
import { describe, it, beforeEach, before } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { GrowEnvironmentService } from '../../services/GrowEnvironmentService';

use(chaiAsPromised);

describe('Environment Overview API Tests', () => {
  let testUser: User;
  let otherUser: User;
  let authToken: string;

  before(async () => {
    testHelper.clearTestUser();
    const uniqueEmail = `test-overview-${Date.now()}@example.com`;
    testUser = await testHelper.createTestUser({ email: uniqueEmail });
    const loginResponse = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: testUser.email, password: 'test-password' },
      headers: {},
    });
    authToken = loginResponse.body.accessToken;

    // Create a second user
    const otherEmail = `test-overview-other-${Date.now()}@example.com`;
    otherUser = await testHelper.createTestUser({ email: otherEmail });
  });

  beforeEach(async () => {
    // Clean up test data
    await Grow.destroy({ where: { user_id: testUser.id } });
    await GrowEnvironment.destroy({ where: { user_id: testUser.id } });
    await Grow.destroy({ where: { user_id: otherUser.id } });
    await GrowEnvironment.destroy({ where: { user_id: otherUser.id } });
  });

  describe('GET /api/environment-overview', () => {
    it('should return 401 without authentication', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: 'invalid-token' },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return overview with no environments', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.property('environments');
      expect(response.body).to.have.property('summary');
      expect(response.body.environments).to.be.an('array').with.lengthOf(0);
      expect(response.body.summary.totalEnvironments).to.equal(0);
    });

    it('should return overview with multiple environments', async () => {
      const env1 = await GrowEnvironmentService.create(testUser.id, {
        name: 'Tent 1',
        type: 'tent',
        max_plants: 10,
      });

      const env2 = await GrowEnvironmentService.create(testUser.id, {
        name: 'Room 1',
        type: 'room',
        max_plants: 20,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 5,
        phase: 'vegetative',
        environment_id: env1.id,
        started_at: new Date(),
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 2',
        plant_count: 15,
        phase: 'flowering',
        environment_id: env2.id,
        started_at: new Date(),
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.environments).to.have.lengthOf(2);
      expect(response.body.summary.totalEnvironments).to.equal(2);
      expect(response.body.summary.totalCapacity).to.equal(30);
      expect(response.body.summary.totalPlants).to.equal(20);
      expect(response.body.summary.utilizationPercent).to.equal(67); // 20/30 = 66.67% -> 67%
    });

    it("should only return user's own environments", async () => {
      await GrowEnvironmentService.create(testUser.id, {
        name: 'User 1 Tent',
        type: 'tent',
        max_plants: 10,
      });

      await GrowEnvironmentService.create(otherUser.id, {
        name: 'User 2 Tent',
        type: 'tent',
        max_plants: 10,
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.environments).to.have.lengthOf(1);
      expect(response.body.environments[0].name).to.equal('User 1 Tent');
    });

    it('should include capacity status in response', async () => {
      const env = await GrowEnvironmentService.create(testUser.id, {
        name: 'Over Capacity Tent',
        type: 'tent',
        max_plants: 10,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 12,
        phase: 'vegetative',
        environment_id: env.id,
        started_at: new Date(),
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.environments[0].capacityStatus).to.equal('over');
      expect(response.body.summary.overCapacityCount).to.equal(1);
    });

    it('should calculate warning status correctly', async () => {
      const env = await GrowEnvironmentService.create(testUser.id, {
        name: 'Warning Tent',
        type: 'tent',
        max_plants: 10,
        capacity_warning_threshold: 80,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 9,
        phase: 'vegetative',
        environment_id: env.id,
        started_at: new Date(),
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.environments[0].capacityStatus).to.equal('warning');
      expect(response.body.summary.warningCount).to.equal(1);
    });

    it('should include active grows list', async () => {
      const env = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        max_plants: 10,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Blue Dream',
        plant_count: 3,
        phase: 'vegetative',
        environment_id: env.id,
        started_at: new Date(),
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'OG Kush',
        plant_count: 2,
        phase: 'flowering',
        environment_id: env.id,
        started_at: new Date(),
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.environments[0].activeGrows).to.have.lengthOf(2);
      expect(response.body.environments[0].activeGrows[0]).to.have.property('id');
      expect(response.body.environments[0].activeGrows[0]).to.have.property('name');
      expect(response.body.environments[0].activeGrows[0]).to.have.property('plantCount');
      expect(response.body.environments[0].activeGrows[0]).to.have.property('phase');
    });

    it('should include dimensions and light info', async () => {
      await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        width_inches: 48,
        depth_inches: 48,
        height_inches: 80,
        light_type: 'led',
        light_wattage: 600,
        max_plants: 10,
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.environments[0].dimensions).to.deep.equal({
        widthInches: 48,
        depthInches: 48,
        heightInches: 80,
      });
      expect(response.body.environments[0].lightInfo).to.deep.equal({
        type: 'led',
        wattage: 600,
      });
    });
  });

  describe('GET /api/environment-overview/summary', () => {
    it('should return 401 without authentication', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview/summary',
        headers: { Authorization: 'invalid-token' },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return only summary statistics', async () => {
      await GrowEnvironmentService.create(testUser.id, {
        name: 'Tent 1',
        type: 'tent',
        max_plants: 10,
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview/summary',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.property('totalEnvironments');
      expect(response.body).to.have.property('totalCapacity');
      expect(response.body).to.have.property('totalPlants');
      expect(response.body).to.not.have.property('environments');
    });
  });

  describe('GET /api/environment-overview/:id/capacity', () => {
    it('should return 401 without authentication', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview/00000000-0000-0000-0000-000000000000/capacity',
        headers: { Authorization: 'invalid-token' },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return 400 with invalid UUID', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview/invalid-id/capacity',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should return 404 for non-existent environment', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: '/api/environment-overview/00000000-0000-0000-0000-000000000000/capacity',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(404);
    });

    it("should return 404 for other user's environment", async () => {
      const otherUserEnv = await GrowEnvironmentService.create(otherUser.id, {
        name: 'Other User Tent',
        type: 'tent',
        max_plants: 10,
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: `/api/environment-overview/${otherUserEnv.id}/capacity`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(404);
    });

    it("should return capacity data for user's environment", async () => {
      const env = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        max_plants: 10,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 6,
        phase: 'flowering',
        environment_id: env.id,
        started_at: new Date(),
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: `/api/environment-overview/${env.id}/capacity`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('name');
      expect(response.body).to.have.property('currentPlants');
      expect(response.body).to.have.property('maxPlants');
      expect(response.body).to.have.property('utilizationPercent');
      expect(response.body).to.have.property('capacityStatus');
      expect(response.body).to.have.property('activeGrows');
      expect(response.body.currentPlants).to.equal(6);
      expect(response.body.utilizationPercent).to.equal(60);
      expect(response.body.capacityStatus).to.equal('normal');
    });

    it('should include complete environment data', async () => {
      const env = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        max_plants: 10,
        width_inches: 48,
        depth_inches: 48,
        height_inches: 80,
        light_type: 'led',
        light_wattage: 600,
        display_color: '#10B981',
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: `/api/environment-overview/${env.id}/capacity`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.type).to.equal('tent');
      expect(response.body.displayColor).to.equal('#10B981');
      expect(response.body.dimensions).to.deep.equal({
        widthInches: 48,
        depthInches: 48,
        heightInches: 80,
      });
      expect(response.body.lightInfo).to.deep.equal({
        type: 'led',
        wattage: 600,
      });
    });
  });
});
