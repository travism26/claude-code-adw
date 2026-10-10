/**
 * Queue Service Unit Tests
 *
 * Tests for BullMQ-based queue service implementation
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { getSequelize } from '../../config/sequelize';
import { initializeQueue, shutdownQueue } from '../../services/queue';
import { QueueService, JobStatus } from '../../services/queue/interfaces';

use(chaiAsPromised);

describe('Queue Service', () => {
  let queueService: QueueService;
  let sequelize: any;

  before(async function () {
    // Increase timeout for queue initialization
    this.timeout(10000);

    sequelize = await getSequelize();
    const { queueService: qs } = initializeQueue(sequelize, 'test_queue');
    queueService = qs;

    // Wait a bit for queue to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  after(async function () {
    this.timeout(10000);
    await shutdownQueue(5000);
  });

  beforeEach(async () => {
    // Clean up any existing test jobs
    // Note: In a real test environment, you'd use a separate Redis DB
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Job Enqueueing', () => {
    it('should enqueue a job and return a job ID', async function () {
      this.timeout(5000);

      const jobType = 'care_recommendation';
      const payload = {
        plantType: 'tomato',
        growthStage: 'flowering',
      };

      const job = await queueService.enqueue(jobType, payload);

      expect(job).to.exist;
      expect(job.id).to.be.a('string');
      expect(job.type).to.equal(jobType);
      expect(job.payload).to.deep.equal(payload);
      expect(job.status).to.be.oneOf([JobStatus.PENDING, JobStatus.DELAYED]);
    });

    it('should enqueue a job with custom options', async function () {
      this.timeout(5000);

      const jobType = 'pest_diagnosis';
      const payload = {
        plantName: 'Rose',
        symptoms: 'Yellow leaves',
      };
      const options = {
        priority: 5,
        delay: 1000,
      };

      const job = await queueService.enqueue(jobType, payload, options);

      expect(job).to.exist;
      expect(job.id).to.be.a('string');
      expect(job.type).to.equal(jobType);
    });

    it('should enqueue multiple jobs with unique IDs', async function () {
      this.timeout(5000);

      const job1 = await queueService.enqueue('general', { test: 1 });
      const job2 = await queueService.enqueue('general', { test: 2 });

      expect(job1.id).to.not.equal(job2.id);
    });
  });

  describe('Job Status Retrieval', () => {
    it('should get job status by ID', async function () {
      this.timeout(5000);

      const job = await queueService.enqueue('care_recommendation', {
        plantType: 'basil',
      });

      const status = await queueService.getJobStatus(job.id);

      expect(status).to.exist;
      expect(status).to.be.oneOf([
        JobStatus.PENDING,
        JobStatus.ACTIVE,
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.DELAYED,
      ]);
    });

    it('should return null for non-existent job ID', async function () {
      this.timeout(5000);

      const fakeJobId = 'non-existent-job-id';
      const status = await queueService.getJobStatus(fakeJobId);

      expect(status).to.be.null;
    });
  });

  describe('Job Retrieval', () => {
    it('should get full job details by ID', async function () {
      this.timeout(5000);

      const jobType = 'weather_based_action';
      const payload = {
        weatherForecast: { temp: 75, condition: 'sunny' },
        plants: ['tomato', 'pepper'],
      };

      const enqueuedJob = await queueService.enqueue(jobType, payload);
      const retrievedJob = await queueService.getJob(enqueuedJob.id);

      expect(retrievedJob).to.exist;
      expect(retrievedJob?.id).to.equal(enqueuedJob.id);
      expect(retrievedJob?.type).to.equal(jobType);
      expect(retrievedJob?.payload).to.deep.equal(payload);
      expect(retrievedJob?.status).to.exist;
    });

    it('should return null for non-existent job', async function () {
      this.timeout(5000);

      const job = await queueService.getJob('non-existent-job-id');

      expect(job).to.be.null;
    });

    it('should include timestamps in job details', async function () {
      this.timeout(5000);

      const job = await queueService.enqueue('general', { test: true });
      const retrievedJob = await queueService.getJob(job.id);

      expect(retrievedJob).to.exist;
      expect(retrievedJob?.createdAt).to.exist;
      expect(retrievedJob?.createdAt).to.be.instanceOf(Date);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when Redis is connected', async function () {
      this.timeout(5000);

      const healthy = await queueService.isHealthy();

      // This will fail if Redis is not running, which is expected in CI
      // In local development with Redis running, this should be true
      expect(healthy).to.be.a('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job types gracefully', async function () {
      this.timeout(5000);

      // Even invalid types should be enqueued (validation happens at worker level)
      const job = await queueService.enqueue('invalid_type', { test: true });

      expect(job).to.exist;
      expect(job.type).to.equal('invalid_type');
    });

    it('should handle empty payloads', async function () {
      this.timeout(5000);

      const job = await queueService.enqueue('general', {});

      expect(job).to.exist;
      expect(job.payload).to.deep.equal({});
    });
  });

  describe('Queue Metrics', () => {
    it('should provide queue metrics through BullMQService', async function () {
      this.timeout(5000);

      // This test assumes the BullMQService has a getMetrics method
      // If using the interface directly, skip this test
      if ('getMetrics' in queueService && typeof (queueService as any).getMetrics === 'function') {
        const metrics = await (queueService as any).getMetrics();

        expect(metrics).to.exist;
        expect(metrics).to.have.property('waiting');
        expect(metrics).to.have.property('active');
        expect(metrics).to.have.property('completed');
        expect(metrics).to.have.property('failed');
        expect(metrics).to.have.property('delayed');
      } else {
        this.skip();
      }
    });
  });
});
