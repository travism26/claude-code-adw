import { GrowEnvironment, User, Grow } from '../../models';
import { describe, it, beforeEach } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { EnvironmentOverviewService } from '../../services/EnvironmentOverviewService';
import { GrowEnvironmentService } from '../../services/GrowEnvironmentService';

use(chaiAsPromised);

describe('EnvironmentOverviewService Tests', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  beforeEach(async () => {
    // Clean up test data
    await Grow.destroy({ where: { user_id: testUser.id } });
    await GrowEnvironment.destroy({ where: { user_id: testUser.id } });
  });

  describe('calculateCapacityStatus', () => {
    it('should return "normal" when under warning threshold', () => {
      const status = EnvironmentOverviewService.calculateCapacityStatus(
        5, // currentPlants
        10, // maxPlants
        80 // warningThreshold
      );
      expect(status).to.equal('normal');
    });

    it('should return "warning" when at warning threshold', () => {
      const status = EnvironmentOverviewService.calculateCapacityStatus(
        8, // currentPlants (80%)
        10, // maxPlants
        80 // warningThreshold
      );
      expect(status).to.equal('warning');
    });

    it('should return "warning" when between threshold and 100%', () => {
      const status = EnvironmentOverviewService.calculateCapacityStatus(
        9, // currentPlants (90%)
        10, // maxPlants
        80 // warningThreshold
      );
      expect(status).to.equal('warning');
    });

    it('should return "warning" when exactly at 100%', () => {
      const status = EnvironmentOverviewService.calculateCapacityStatus(
        10, // currentPlants (100%)
        10, // maxPlants
        80 // warningThreshold
      );
      expect(status).to.equal('warning');
    });

    it('should return "over" when exceeding max capacity', () => {
      const status = EnvironmentOverviewService.calculateCapacityStatus(
        12, // currentPlants (120%)
        10, // maxPlants
        80 // warningThreshold
      );
      expect(status).to.equal('over');
    });

    it('should return "normal" when max_plants is null', () => {
      const status = EnvironmentOverviewService.calculateCapacityStatus(
        5, // currentPlants
        null, // maxPlants
        80 // warningThreshold
      );
      expect(status).to.equal('normal');
    });

    it('should return "normal" when max_plants is 0', () => {
      const status = EnvironmentOverviewService.calculateCapacityStatus(
        5, // currentPlants
        0, // maxPlants
        80 // warningThreshold
      );
      expect(status).to.equal('normal');
    });
  });

  describe('calculateUtilizationPercent', () => {
    it('should calculate correct percentage', () => {
      const percent = EnvironmentOverviewService.calculateUtilizationPercent(5, 10);
      expect(percent).to.equal(50);
    });

    it('should round to nearest integer', () => {
      const percent = EnvironmentOverviewService.calculateUtilizationPercent(7, 10);
      expect(percent).to.equal(70);
    });

    it('should return null when max_plants is null', () => {
      const percent = EnvironmentOverviewService.calculateUtilizationPercent(5, null);
      expect(percent).to.be.null;
    });

    it('should return null when max_plants is 0', () => {
      const percent = EnvironmentOverviewService.calculateUtilizationPercent(5, 0);
      expect(percent).to.be.null;
    });

    it('should handle over 100% utilization', () => {
      const percent = EnvironmentOverviewService.calculateUtilizationPercent(15, 10);
      expect(percent).to.equal(150);
    });
  });

  describe('transformEnvironment', () => {
    it('should transform environment with no grows', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Empty Tent',
        type: 'tent',
        max_plants: 10,
      });

      const env = await GrowEnvironmentService.findByIdAndUser(
        environment.id,
        testUser.id
      );

      const transformed = EnvironmentOverviewService.transformEnvironment(env!);

      expect(transformed.currentPlants).to.equal(0);
      expect(transformed.utilizationPercent).to.equal(0);
      expect(transformed.capacityStatus).to.equal('normal');
      expect(transformed.activeGrows).to.be.an('array').with.lengthOf(0);
    });

    it('should calculate current plants from active grows', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        max_plants: 10,
      });

      // Create active grows
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 3,
        phase: 'vegetative',
        environment_id: environment.id,
        started_at: new Date(),
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 2',
        plant_count: 2,
        phase: 'flowering',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const env = await GrowEnvironmentService.findByIdAndUser(
        environment.id,
        testUser.id
      );

      const transformed = EnvironmentOverviewService.transformEnvironment(env!);

      expect(transformed.currentPlants).to.equal(5);
      expect(transformed.utilizationPercent).to.equal(50);
      expect(transformed.capacityStatus).to.equal('normal');
      expect(transformed.activeGrows).to.have.lengthOf(2);
    });

    it('should exclude archived and harvested grows from current plants', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        max_plants: 10,
      });

      // Active grow
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Active Strain',
        plant_count: 3,
        phase: 'vegetative',
        environment_id: environment.id,
        started_at: new Date(),
      });

      // Harvested grow (should be excluded)
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Harvested Strain',
        plant_count: 5,
        phase: 'harvest',
        environment_id: environment.id,
        started_at: new Date(),
      });

      // Archived grow (should be excluded)
      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Archived Strain',
        plant_count: 4,
        phase: 'archived',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const env = await GrowEnvironmentService.findByIdAndUser(
        environment.id,
        testUser.id
      );

      const transformed = EnvironmentOverviewService.transformEnvironment(env!);

      expect(transformed.currentPlants).to.equal(3);
      expect(transformed.activeGrows).to.have.lengthOf(1);
    });

    it('should handle null max_plants', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'No Limit Tent',
        type: 'tent',
        max_plants: null,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 5,
        phase: 'vegetative',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const env = await GrowEnvironmentService.findByIdAndUser(
        environment.id,
        testUser.id
      );

      const transformed = EnvironmentOverviewService.transformEnvironment(env!);

      expect(transformed.currentPlants).to.equal(5);
      expect(transformed.utilizationPercent).to.be.null;
      expect(transformed.capacityStatus).to.equal('normal');
    });

    it('should use custom warning threshold', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        max_plants: 10,
        capacity_warning_threshold: 70,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 8,
        phase: 'vegetative',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const env = await GrowEnvironmentService.findByIdAndUser(
        environment.id,
        testUser.id
      );

      const transformed = EnvironmentOverviewService.transformEnvironment(env!);

      expect(transformed.utilizationPercent).to.equal(80);
      expect(transformed.capacityStatus).to.equal('warning');
      expect(transformed.capacityWarningThreshold).to.equal(70);
    });
  });

  describe('calculateSummary', () => {
    it('should calculate summary for empty array', () => {
      const summary = EnvironmentOverviewService.calculateSummary([]);

      expect(summary.totalEnvironments).to.equal(0);
      expect(summary.activeEnvironments).to.equal(0);
      expect(summary.totalCapacity).to.equal(0);
      expect(summary.totalPlants).to.equal(0);
      expect(summary.utilizationPercent).to.be.null;
      expect(summary.warningCount).to.equal(0);
      expect(summary.overCapacityCount).to.equal(0);
    });

    it('should calculate summary statistics correctly', () => {
      const environments = [
        {
          id: '1',
          name: 'Tent 1',
          type: 'tent',
          displayColor: '#10B981',
          maxPlants: 10,
          currentPlants: 5,
          utilizationPercent: 50,
          capacityWarningThreshold: 80,
          capacityStatus: 'normal' as const,
          isActive: true,
          activeGrows: [],
          dimensions: { widthInches: null, depthInches: null, heightInches: null },
          lightInfo: { type: null, wattage: null },
        },
        {
          id: '2',
          name: 'Tent 2',
          type: 'tent',
          displayColor: '#10B981',
          maxPlants: 10,
          currentPlants: 9,
          utilizationPercent: 90,
          capacityWarningThreshold: 80,
          capacityStatus: 'warning' as const,
          isActive: true,
          activeGrows: [],
          dimensions: { widthInches: null, depthInches: null, heightInches: null },
          lightInfo: { type: null, wattage: null },
        },
        {
          id: '3',
          name: 'Tent 3',
          type: 'tent',
          displayColor: '#10B981',
          maxPlants: 10,
          currentPlants: 12,
          utilizationPercent: 120,
          capacityWarningThreshold: 80,
          capacityStatus: 'over' as const,
          isActive: false,
          activeGrows: [],
          dimensions: { widthInches: null, depthInches: null, heightInches: null },
          lightInfo: { type: null, wattage: null },
        },
      ];

      const summary = EnvironmentOverviewService.calculateSummary(environments);

      expect(summary.totalEnvironments).to.equal(3);
      expect(summary.activeEnvironments).to.equal(2);
      expect(summary.totalCapacity).to.equal(30);
      expect(summary.totalPlants).to.equal(26);
      expect(summary.utilizationPercent).to.equal(87); // 26/30 = 86.67% -> 87%
      expect(summary.warningCount).to.equal(1);
      expect(summary.overCapacityCount).to.equal(1);
    });
  });

  describe('getOverview', () => {
    it('should return overview with no environments', async () => {
      const overview = await EnvironmentOverviewService.getOverview(testUser.id);

      expect(overview.environments).to.be.an('array').with.lengthOf(0);
      expect(overview.summary.totalEnvironments).to.equal(0);
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

      const overview = await EnvironmentOverviewService.getOverview(testUser.id);

      expect(overview.environments).to.have.lengthOf(2);
      expect(overview.summary.totalEnvironments).to.equal(2);
      expect(overview.summary.totalCapacity).to.equal(30);
      expect(overview.summary.totalPlants).to.equal(20);
    });
  });

  describe('getEnvironmentCapacity', () => {
    it('should return null for non-existent environment', async () => {
      const capacity = await EnvironmentOverviewService.getEnvironmentCapacity(
        '00000000-0000-0000-0000-000000000000',
        testUser.id
      );

      expect(capacity).to.be.null;
    });

    it('should return capacity data for existing environment', async () => {
      const environment = await GrowEnvironmentService.create(testUser.id, {
        name: 'Test Tent',
        type: 'tent',
        max_plants: 10,
      });

      await Grow.create({
        user_id: testUser.id,
        strain_name: 'Strain 1',
        plant_count: 6,
        phase: 'flowering',
        environment_id: environment.id,
        started_at: new Date(),
      });

      const capacity = await EnvironmentOverviewService.getEnvironmentCapacity(
        environment.id,
        testUser.id
      );

      expect(capacity).to.not.be.null;
      expect(capacity!.currentPlants).to.equal(6);
      expect(capacity!.utilizationPercent).to.equal(60);
      expect(capacity!.capacityStatus).to.equal('normal');
    });
  });

  describe('getCapacitySummary', () => {
    it('should return only summary statistics', async () => {
      await GrowEnvironmentService.create(testUser.id, {
        name: 'Tent 1',
        type: 'tent',
        max_plants: 10,
      });

      const summary = await EnvironmentOverviewService.getCapacitySummary(testUser.id);

      expect(summary).to.have.property('totalEnvironments');
      expect(summary).to.have.property('totalCapacity');
      expect(summary).to.have.property('totalPlants');
      expect(summary).to.not.have.property('environments');
    });
  });
});
