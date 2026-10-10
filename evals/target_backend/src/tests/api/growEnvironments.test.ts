import { GrowEnvironment, User, Grow } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { GrowEnvironmentService } from '../../services/GrowEnvironmentService';
use(chaiAsPromised);

describe('GrowEnvironment API Service Tests', () => {
  let testUser: User;
  let otherUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
    otherUser = await testHelper.createTestUser();
  });

  describe('Create Environment', () => {
    it('should create an environment with valid data', async () => {
      const envData = {
        name: 'Test Tent 1',
        type: 'tent' as const,
        width_inches: 48,
        depth_inches: 48,
        height_inches: 80,
        light_type: 'led' as const,
        light_wattage: 600,
      };

      const environment = await GrowEnvironmentService.create(testUser.id, envData);

      expect(environment).to.exist;
      expect(environment.name).to.equal(envData.name);
      expect(environment.type).to.equal(envData.type);
      expect(environment.user_id).to.equal(testUser.id);
    });

    it('should create environment with minimal data', async () => {
      const envData = {
        name: 'Minimal Tent',
        type: 'tent' as const,
      };

      const environment = await GrowEnvironmentService.create(testUser.id, envData);

      expect(environment).to.exist;
      expect(environment.name).to.equal(envData.name);
      expect(environment.is_active).to.equal(true);
    });
  });

  describe('List Environments', () => {
    beforeEach(async () => {
      // Clean up and create fresh test environments
      await GrowEnvironment.destroy({ where: { user_id: testUser.id } });

      await GrowEnvironmentService.create(testUser.id, {
        name: 'Tent 1',
        type: 'tent',
      });
      await GrowEnvironmentService.create(testUser.id, {
        name: 'Room 1',
        type: 'room',
      });
      await GrowEnvironmentService.create(testUser.id, {
        name: 'Inactive Tent',
        type: 'tent',
        is_active: false,
      });
    });

    it('should list all environments for user', async () => {
      const { environments, total } = await GrowEnvironmentService.findAllByUser(testUser.id);

      expect(environments).to.be.an('array');
      expect(total).to.equal(3);
    });

    it('should filter by type', async () => {
      const { environments, total } = await GrowEnvironmentService.findAllByUser(testUser.id, {
        type: 'tent',
      });

      expect(total).to.equal(2);
      expect(environments.every(env => env.type === 'tent')).to.be.true;
    });

    it('should filter by is_active', async () => {
      const { environments, total } = await GrowEnvironmentService.findAllByUser(testUser.id, {
        is_active: true,
      });

      expect(total).to.equal(2);
      expect(environments.every(env => env.is_active === true)).to.be.true;
    });

    it('should filter by name (case insensitive)', async () => {
      const { environments, total } = await GrowEnvironmentService.findAllByUser(testUser.id, {
        name: 'room',
      });

      expect(total).to.equal(1);
      expect(environments[0].name).to.equal('Room 1');
    });

    it('should support pagination', async () => {
      const { environments, total } = await GrowEnvironmentService.findAllByUser(testUser.id, {
        limit: 2,
        offset: 0,
      });

      expect(environments.length).to.equal(2);
      expect(total).to.equal(3);
    });

    it('should only return user\'s environments', async () => {
      await GrowEnvironmentService.create(otherUser.id, {
        name: 'Other User Tent',
        type: 'tent',
      });

      const { environments, total } = await GrowEnvironmentService.findAllByUser(testUser.id);

      expect(total).to.equal(3);
      expect(environments.every(env => env.user_id === testUser.id)).to.be.true;
    });
  });

  describe('Get Single Environment', () => {
    let environment: GrowEnvironment;

    beforeEach(async () => {
      environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Environment',
        type: 'tent',
      });
    });

    it('should get environment by ID', async () => {
      const found = await GrowEnvironmentService.findByIdAndUser(environment.id, testUser.id);

      expect(found).to.exist;
      expect(found!.id).to.equal(environment.id);
      expect(found!.name).to.equal(environment.name);
    });

    it('should return null for non-existent environment', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const found = await GrowEnvironmentService.findByIdAndUser(fakeId, testUser.id);

      expect(found).to.be.null;
    });

    it('should return null when accessing other user\'s environment', async () => {
      const found = await GrowEnvironmentService.findByIdAndUser(environment.id, otherUser.id);

      expect(found).to.be.null;
    });
  });

  describe('Update Environment', () => {
    let environment: GrowEnvironment;

    beforeEach(async () => {
      environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Original Name',
        type: 'tent',
        width_inches: 24,
      });
    });

    it('should update environment fields', async () => {
      const updated = await GrowEnvironmentService.update(environment, {
        name: 'Updated Name',
        width_inches: 48,
      });

      expect(updated.name).to.equal('Updated Name');
      expect(updated.width_inches).to.equal(48);
    });

    it('should update equipment flags', async () => {
      const updated = await GrowEnvironmentService.update(environment, {
        has_carbon_filter: true,
        has_humidifier: true,
      });

      expect(updated.has_carbon_filter).to.equal(true);
      expect(updated.has_humidifier).to.equal(true);
    });

    it('should allow deactivating environment', async () => {
      const updated = await GrowEnvironmentService.update(environment, {
        is_active: false,
      });

      expect(updated.is_active).to.equal(false);
    });
  });

  describe('Delete Environment', () => {
    it('should delete environment', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'To Delete',
        type: 'tent',
      });

      await GrowEnvironmentService.delete(environment);

      const found = await GrowEnvironment.findByPk(environment.id);
      expect(found).to.be.null;
    });

    it('should set grows environment_id to null when environment deleted', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Environment with Grow',
        type: 'tent',
      });

      const grow = await Grow.create({
        user_id: testUser.id,
        strain_name: 'Test Strain',
        started_at: new Date(),
        environment_id: environment.id,
      });

      expect(grow.environment_id).to.equal(environment.id);

      await GrowEnvironmentService.delete(environment);

      const updatedGrow = await Grow.findByPk(grow.id);
      expect(updatedGrow).to.exist;
      expect(updatedGrow!.environment_id).to.be.null;
    });
  });

  describe('Calculate Recommended Capacity', () => {
    it('should calculate capacity for 2x2 tent', () => {
      const capacity = GrowEnvironmentService.calculateRecommendedCapacity(24, 24);

      expect(capacity.veg).to.be.greaterThan(0);
      expect(capacity.flower).to.be.greaterThan(0);
      expect(capacity.veg).to.be.greaterThan(capacity.flower); // Veg capacity is higher
    });

    it('should calculate capacity for 4x4 tent', () => {
      const capacity = GrowEnvironmentService.calculateRecommendedCapacity(48, 48);

      // 4x4 = 16 sq ft
      // Veg: 16 / 1.5 = 10.67 -> 10
      // Flower: 16 / 3 = 5.33 -> 5
      expect(capacity.veg).to.equal(10);
      expect(capacity.flower).to.equal(5);
    });

    it('should return at least 1 plant for small spaces', () => {
      const capacity = GrowEnvironmentService.calculateRecommendedCapacity(12, 12);

      expect(capacity.veg).to.be.at.least(1);
      expect(capacity.flower).to.be.at.least(1);
    });
  });

  describe('Get Grows in Environment', () => {
    let environment: GrowEnvironment;

    beforeEach(async () => {
      environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Multi-Grow Tent',
        type: 'tent',
      });
    });

    it('should return empty array when no grows', async () => {
      const grows = await GrowEnvironmentService.getGrowsInEnvironment(
        environment.id,
        testUser.id
      );

      expect(grows).to.be.an('array');
      expect(grows.length).to.equal(0);
    });

    it('should return grows in environment', async () => {
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        started_at: new Date(),
        environment_id: environment.id,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 2',
        started_at: new Date(),
        environment_id: environment.id,
      });

      const grows = await GrowEnvironmentService.getGrowsInEnvironment(
        environment.id,
        testUser.id
      );

      expect(grows.length).to.equal(2);
    });

    it('should throw error for non-existent environment', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        GrowEnvironmentService.getGrowsInEnvironment(fakeId, testUser.id)
      ).to.be.rejectedWith('Environment not found');
    });

    it('should throw error when accessing other user\'s environment', async () => {
      await expect(
        GrowEnvironmentService.getGrowsInEnvironment(environment.id, otherUser.id)
      ).to.be.rejectedWith('Environment not found');
    });
  });

  describe('Environment with Grows Association', () => {
    it('should include grow count when listing environments', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Environment with Grows',
        type: 'tent',
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        started_at: new Date(),
        environment_id: environment.id,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 2',
        started_at: new Date(),
        environment_id: environment.id,
      });

      const { environments } = await GrowEnvironmentService.findAllByUser(testUser.id, {
        name: 'Environment with Grows',
      });

      expect(environments.length).to.equal(1);
      expect(environments[0].grows).to.exist;
      expect(environments[0].grows!.length).to.equal(2);
    });
  });

  describe('Check Capacity Endpoint', () => {
    let environment: GrowEnvironment;

    beforeEach(async () => {
      await Grow.destroy({ where: { user_id: testUser.id } });
      await GrowEnvironment.destroy({ where: { user_id: testUser.id } });

      environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Capacity Test Tent',
        type: 'tent',
        max_plants: 10,
        capacity_warning_threshold: 80,
      });
    });

    it('should check capacity with valid inputs', async () => {
      const result = await GrowEnvironmentService.checkCapacity(
        environment.id,
        5,
        testUser.id
      );

      expect(result).to.exist;
      expect(result.environmentId).to.equal(environment.id);
      expect(result.environmentName).to.equal('Capacity Test Tent');
      expect(result.maxPlants).to.equal(10);
      expect(result.currentPlants).to.equal(0);
      expect(result.requestedPlants).to.equal(5);
      expect(result.projectedPlants).to.equal(5);
      expect(result.projectedUtilization).to.equal(50);
      expect(result.status).to.equal('normal');
      expect(result.warnings).to.be.an('array').with.lengthOf(0);
      expect(result.allowed).to.be.true;
    });

    it('should return warning status when approaching capacity', async () => {
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 7,
        phase: 'vegetative',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        environment.id,
        1,
        testUser.id
      );

      expect(result.currentPlants).to.equal(7);
      expect(result.projectedPlants).to.equal(8);
      expect(result.projectedUtilization).to.equal(80);
      expect(result.status).to.equal('warning');
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('80% capacity');
    });

    it('should return over status when exceeding capacity', async () => {
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 9,
        phase: 'vegetative',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        environment.id,
        3,
        testUser.id
      );

      expect(result.currentPlants).to.equal(9);
      expect(result.projectedPlants).to.equal(12);
      expect(result.status).to.equal('over');
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('exceed capacity by 2 plants');
    });

    it('should reject check for non-existent environment', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        GrowEnvironmentService.checkCapacity(fakeId, 5, testUser.id)
      ).to.be.rejectedWith('Environment not found');
    });

    it('should reject check for another user\'s environment', async () => {
      const otherEnv = await GrowEnvironmentService.create(otherUser.id, {
        name: 'Other User Tent',
        type: 'tent',
        max_plants: 5,
      });

      await expect(
        GrowEnvironmentService.checkCapacity(otherEnv.id, 1, testUser.id)
      ).to.be.rejectedWith('Environment not found');

      // Cleanup
      await GrowEnvironment.destroy({ where: { id: otherEnv.id } });
    });

    it('should always return allowed: true even when over capacity', async () => {
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 10,
        phase: 'vegetative',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        environment.id,
        10,
        testUser.id
      );

      expect(result.status).to.equal('over');
      expect(result.allowed).to.be.true;
    });
  });

  describe('Capacity Check API Endpoints', () => {
    let authToken: string;
    let environment: GrowEnvironment;

    beforeEach(async () => {
      // Clean up test data
      await Grow.destroy({ where: { user_id: testUser.id } });
      await GrowEnvironment.destroy({ where: { user_id: testUser.id } });

      // Get auth token for API requests
      const loginResponse = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: '/api/auth/login',
        body: { email: testUser.email, password: 'test-password' },
        headers: {},
      });
      authToken = loginResponse.body.accessToken;

      // Create test environment with capacity limits
      environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'API Test Tent',
        type: 'tent',
        max_plants: 4,
        capacity_warning_threshold: 80,
      });
    });

    describe('POST /api/grow-environments/check-capacity', () => {
      it('should return capacity check result with valid request', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: '/api/grow-environments/check-capacity',
          body: {
            environmentId: environment.id,
            additionalPlants: 2,
          },
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(200);
        expect(response.body.data).to.exist;
        expect(response.body.data.environmentId).to.equal(environment.id);
        expect(response.body.data.environmentName).to.equal('API Test Tent');
        expect(response.body.data.maxPlants).to.equal(4);
        expect(response.body.data.currentPlants).to.equal(0);
        expect(response.body.data.requestedPlants).to.equal(2);
        expect(response.body.data.projectedPlants).to.equal(2);
        expect(response.body.data.status).to.equal('normal');
        expect(response.body.data.allowed).to.be.true;
      });

      it('should return 400 for invalid environmentId (non-UUID)', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: '/api/grow-environments/check-capacity',
          body: {
            environmentId: 'not-a-uuid',
            additionalPlants: 2,
          },
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(400);
        expect(response.body.errors).to.exist;
        expect(response.body.errors).to.be.an('array');
      });

      it('should return 400 for missing additionalPlants field', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: '/api/grow-environments/check-capacity',
          body: {
            environmentId: environment.id,
          },
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(400);
        expect(response.body.errors).to.exist;
      });

      it('should return 400 for additionalPlants less than 1', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: '/api/grow-environments/check-capacity',
          body: {
            environmentId: environment.id,
            additionalPlants: 0,
          },
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(400);
        expect(response.body.errors).to.exist;
      });

      it('should return 401 for unauthorized request (no JWT)', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: '/api/grow-environments/check-capacity',
          body: {
            environmentId: environment.id,
            additionalPlants: 2,
          },
          headers: { Authorization: 'invalid-token' },
        });

        expect(response.statusCode).to.equal(401);
      });

      it('should return 404 for non-existent environment', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';

        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: '/api/grow-environments/check-capacity',
          body: {
            environmentId: fakeId,
            additionalPlants: 2,
          },
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(404);
        expect(response.body.error).to.exist;
      });

      it('should return 404 for wrong user\'s environment (authorization check)', async () => {
        const otherUserEnv = await GrowEnvironmentService.create(otherUser.id, {
          name: 'Other User Tent',
          type: 'tent',
          max_plants: 5,
        });

        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: '/api/grow-environments/check-capacity',
          body: {
            environmentId: otherUserEnv.id,
            additionalPlants: 2,
          },
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(404);
        expect(response.body.error).to.exist;

        // Cleanup
        await GrowEnvironment.destroy({ where: { id: otherUserEnv.id } });
      });
    });

    describe('GET /api/grow-environments/:id/capacity', () => {
      it('should return current capacity info with valid request', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'GET',
          path: `/api/grow-environments/${environment.id}/capacity`,
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(200);
        expect(response.body.data).to.exist;
        expect(response.body.data.id).to.equal(environment.id);
        expect(response.body.data.name).to.equal('API Test Tent');
        expect(response.body.data.maxPlants).to.equal(4);
        expect(response.body.data.currentPlants).to.equal(0);
      });

      it('should return 400 for invalid environmentId', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'GET',
          path: '/api/grow-environments/not-a-uuid/capacity',
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(400);
        expect(response.body.errors).to.exist;
      });

      it('should return 401 for unauthorized request', async () => {
        const response = await testHelper.executeRequest({
          httpMethod: 'GET',
          path: `/api/grow-environments/${environment.id}/capacity`,
          headers: { Authorization: 'invalid-token' },
        });

        expect(response.statusCode).to.equal(401);
      });

      it('should return 404 for non-existent environment', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';

        const response = await testHelper.executeRequest({
          httpMethod: 'GET',
          path: `/api/grow-environments/${fakeId}/capacity`,
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(404);
        expect(response.body.error).to.exist;
      });

      it('should return 404 for wrong user\'s environment', async () => {
        const otherUserEnv = await GrowEnvironmentService.create(otherUser.id, {
          name: 'Other User Tent',
          type: 'tent',
          max_plants: 5,
        });

        const response = await testHelper.executeRequest({
          httpMethod: 'GET',
          path: `/api/grow-environments/${otherUserEnv.id}/capacity`,
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(404);
        expect(response.body.error).to.exist;

        // Cleanup
        await GrowEnvironment.destroy({ where: { id: otherUserEnv.id } });
      });
    });
  });
});
