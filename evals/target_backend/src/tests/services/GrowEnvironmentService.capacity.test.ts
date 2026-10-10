import { GrowEnvironment, User, Grow } from '../../models';
import { describe, it, beforeEach } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { GrowEnvironmentService } from '../../services/GrowEnvironmentService';

use(chaiAsPromised);

describe('GrowEnvironmentService.checkCapacity Tests', () => {
  let testUser: User;
  let testEnvironment: GrowEnvironment;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  beforeEach(async () => {
    // Clean up test data
    await Grow.destroy({ where: { user_id: testUser.id } });
    await GrowEnvironment.destroy({ where: { user_id: testUser.id } });

    // Create a test environment for each test
    testEnvironment = await GrowEnvironmentService.create(testUser.id, {
      name: 'Test Tent',
      type: 'tent',
      max_plants: 4,
      capacity_warning_threshold: 80,
    });
  });

  describe('checkCapacity - basic functionality', () => {
    it('should calculate capacity for environment with no grows', async () => {
      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        2,
        testUser.id
      );

      expect(result.environmentId).to.equal(testEnvironment.id);
      expect(result.environmentName).to.equal('Test Tent');
      expect(result.maxPlants).to.equal(4);
      expect(result.currentPlants).to.equal(0);
      expect(result.requestedPlants).to.equal(2);
      expect(result.projectedPlants).to.equal(2);
      expect(result.projectedUtilization).to.equal(50);
      expect(result.capacityWarningThreshold).to.equal(80);
      expect(result.status).to.equal('normal');
      expect(result.warnings).to.be.an('array').with.lengthOf(0);
      expect(result.allowed).to.be.true;
    });

    it('should calculate capacity with existing active grows', async () => {
      // Create active grows with 2 plants
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 2,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        1,
        testUser.id
      );

      expect(result.currentPlants).to.equal(2);
      expect(result.requestedPlants).to.equal(1);
      expect(result.projectedPlants).to.equal(3);
      expect(result.projectedUtilization).to.equal(75);
      expect(result.status).to.equal('normal');
      expect(result.warnings).to.be.an('array').with.lengthOf(0);
    });

    it('should exclude archived and harvested grows from current plant count', async () => {
      // Active grow
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Active Strain',
        plant_count: 2,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      // Harvested grow (should be excluded)
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Harvested Strain',
        plant_count: 3,
        phase: 'harvest',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      // Archived grow (should be excluded)
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Archived Strain',
        plant_count: 4,
        phase: 'archived',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        1,
        testUser.id
      );

      expect(result.currentPlants).to.equal(2);
      expect(result.projectedPlants).to.equal(3);
    });
  });

  describe('checkCapacity - status scenarios', () => {
    it('should return "normal" status when under warning threshold (75%)', async () => {
      // 3 existing plants
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 2,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      // Adding 1 plant = 3/4 = 75% (below 80% threshold)
      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        1,
        testUser.id
      );

      expect(result.projectedPlants).to.equal(3);
      expect(result.projectedUtilization).to.equal(75);
      expect(result.status).to.equal('normal');
      expect(result.warnings).to.be.an('array').with.lengthOf(0);
    });

    it('should return "warning" status when at warning threshold (80%)', async () => {
      // 3 existing plants
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 3,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      // Adding 1 plant = 4/5 = 80% (at threshold)
      const env = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent 2',
        type: 'tent',
        max_plants: 5,
        capacity_warning_threshold: 80,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 2',
        plant_count: 3,
        phase: 'vegetative',
        environment_id: env.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(env.id, 1, testUser.id);

      expect(result.projectedPlants).to.equal(4);
      expect(result.projectedUtilization).to.equal(80);
      expect(result.status).to.equal('warning');
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('80% capacity');
    });

    it('should return "warning" status when at 100% capacity', async () => {
      // 3 existing plants
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 3,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      // Adding 1 plant = 4/4 = 100%
      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        1,
        testUser.id
      );

      expect(result.projectedPlants).to.equal(4);
      expect(result.projectedUtilization).to.equal(100);
      expect(result.status).to.equal('warning');
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('100% capacity');
      expect(result.warnings[0]).to.include('4/4 plants');
    });

    it('should return "over" status when exceeding max capacity', async () => {
      // 4 existing plants (at max)
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 4,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      // Adding 2 plants = 6/4 = 150%
      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        2,
        testUser.id
      );

      expect(result.projectedPlants).to.equal(6);
      expect(result.projectedUtilization).to.equal(150);
      expect(result.status).to.equal('over');
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('exceed capacity by 2 plants');
      expect(result.warnings[0]).to.include('6/4 plants');
    });

    it('should return "over" status with singular plant message when exceeding by 1', async () => {
      // 4 existing plants
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 4,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      // Adding 1 plant = 5/4 = 125%
      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        1,
        testUser.id
      );

      expect(result.projectedPlants).to.equal(5);
      expect(result.status).to.equal('over');
      expect(result.warnings[0]).to.include('exceed capacity by 1 plant');
      expect(result.warnings[0]).to.not.include('plants');
    });
  });

  describe('checkCapacity - edge cases', () => {
    it('should return "normal" status when max_plants is null', async () => {
      const unlimitedEnv = await GrowEnvironmentService.create(testUser.id, {
        name: 'Unlimited Tent',
        type: 'tent',
        max_plants: null,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 100,
        phase: 'vegetative',
        environment_id: unlimitedEnv.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        unlimitedEnv.id,
        50,
        testUser.id
      );

      expect(result.maxPlants).to.be.null;
      expect(result.projectedUtilization).to.be.null;
      expect(result.status).to.equal('normal');
      expect(result.warnings).to.be.an('array').with.lengthOf(0);
    });

    it('should use default warning threshold of 80 when not set', async () => {
      const defaultEnv = await GrowEnvironmentService.create(testUser.id, {
        name: 'Default Threshold Tent',
        type: 'tent',
        max_plants: 10,
        capacity_warning_threshold: null,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 7,
        phase: 'vegetative',
        environment_id: defaultEnv.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        defaultEnv.id,
        1,
        testUser.id
      );

      expect(result.capacityWarningThreshold).to.equal(80);
      expect(result.projectedUtilization).to.equal(80);
      expect(result.status).to.equal('warning');
    });

    it('should throw error when environment not found', async () => {
      await expect(
        GrowEnvironmentService.checkCapacity(
          '00000000-0000-0000-0000-000000000000',
          1,
          testUser.id
        )
      ).to.be.rejectedWith('Environment not found');
    });

    it('should throw error when user does not own environment', async () => {
      const otherUser = await testHelper.createTestUser();
      const otherEnv = await GrowEnvironmentService.create(otherUser.id, {
        name: 'Other User Tent',
        type: 'tent',
        max_plants: 5,
      });

      await expect(
        GrowEnvironmentService.checkCapacity(otherEnv.id, 1, testUser.id)
      ).to.be.rejectedWith('Environment not found');

      // Cleanup
      await GrowEnvironment.destroy({ where: { user_id: otherUser.id } });
      await User.destroy({ where: { id: otherUser.id } });
    });

    it('should handle current plants already over capacity', async () => {
      // Create environment with plants already over capacity
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 5,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      const result = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        2,
        testUser.id
      );

      expect(result.currentPlants).to.equal(5);
      expect(result.projectedPlants).to.equal(7);
      expect(result.status).to.equal('over');
      expect(result.warnings[0]).to.include('exceed capacity by 3 plants');
    });
  });

  describe('checkCapacity - non-blocking behavior', () => {
    it('should always return allowed: true regardless of status', async () => {
      // Test normal status
      const normalResult = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        1,
        testUser.id
      );
      expect(normalResult.allowed).to.be.true;

      // Test warning status
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 3,
        phase: 'vegetative',
        environment_id: testEnvironment.id,
        started_at: new Date(),
      });

      const warningResult = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        1,
        testUser.id
      );
      expect(warningResult.allowed).to.be.true;

      // Test over status
      const overResult = await GrowEnvironmentService.checkCapacity(
        testEnvironment.id,
        5,
        testUser.id
      );
      expect(overResult.allowed).to.be.true;
    });
  });
});
