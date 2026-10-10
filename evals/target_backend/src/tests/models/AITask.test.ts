import { AITask, Plant, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('AITask Model', () => {
  let testUser: User;
  let testPlant: Plant;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testPlant = await Plant.create({
      user_id: testUser.id,
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
    });
  });

  describe('Creation', () => {
    it('should create an AI task with required fields', async () => {
      const taskData = {
        task_type: 'general' as const,
        request_payload: {
          question: 'How do I care for tomatoes?',
        },
      };

      const task = await AITask.create(taskData);

      expect(task).to.exist;
      expect(task.task_type).to.equal(taskData.task_type);
      expect(task.request_payload).to.deep.equal(taskData.request_payload);
      expect(task.status).to.equal('pending');
      expect(task.user_id).to.be.null;
      expect(task.plant_id).to.be.null;
      expect(task.response_data).to.be.null;
      expect(task.model_used).to.be.null;
      expect(task.error_message).to.be.null;
      expect(task.completed_at).to.be.null;
    });

    it('should create an AI task with all fields', async () => {
      const taskData = {
        user_id: testUser.id,
        plant_id: testPlant.id,
        task_type: 'plant_update_suggestion' as const,
        status: 'processing' as const,
        request_payload: {
          plantName: 'Tomato',
          currentConditions: { water_level: 'low' },
        },
        response_data: {
          action: 'Water the plant',
          reason: 'Soil is dry',
          confidence: 0.9,
        },
        model_used: 'claude-3-5-sonnet-20241022',
        completed_at: new Date(),
      };

      const task = await AITask.create(taskData);

      expect(task).to.exist;
      expect(task.user_id).to.equal(testUser.id);
      expect(task.plant_id).to.equal(testPlant.id);
      expect(task.task_type).to.equal(taskData.task_type);
      expect(task.status).to.equal(taskData.status);
      expect(task.request_payload).to.deep.equal(taskData.request_payload);
      expect(task.response_data).to.deep.equal(taskData.response_data);
      expect(task.model_used).to.equal(taskData.model_used);
    });
  });

  describe('Validation', () => {
    it('should require task_type', async () => {
      const taskData = {
        request_payload: { question: 'Test' },
      };

      await expect(AITask.create(taskData)).rejected;
    });

    it('should require request_payload', async () => {
      const taskData = {
        task_type: 'general' as const,
      };

      await expect(AITask.create(taskData)).rejected;
    });

    it('should validate task_type enum values', async () => {
      const taskData = {
        task_type: 'invalid' as any,
        request_payload: { test: 'data' },
      };

      await expect(AITask.create(taskData)).rejected;

      // Valid task_type values
      const validTypes = [
        'plant_update_suggestion',
        'weather_based_action',
        'care_recommendation',
        'pest_diagnosis',
        'general',
      ];
      for (const type of validTypes) {
        const task = await AITask.create({
          task_type: type as any,
          request_payload: { test: `${type} data` },
        });
        expect(task).to.exist;
        expect(task.task_type).to.equal(type);
      }
    });

    it('should validate status enum values', async () => {
      const taskData = {
        task_type: 'general' as const,
        request_payload: { test: 'data' },
        status: 'invalid' as any,
      };

      await expect(AITask.create(taskData)).rejected;

      // Valid status values
      const validStatuses = ['pending', 'processing', 'completed', 'failed'];
      for (const status of validStatuses) {
        const task = await AITask.create({
          task_type: 'general' as const,
          request_payload: { test: `${status} data` },
          status: status as any,
        });
        expect(task).to.exist;
        expect(task.status).to.equal(status);
      }
    });

    it('should not allow empty request_payload', async () => {
      const taskData = {
        task_type: 'general' as const,
        request_payload: null as any,
      };

      await expect(AITask.create(taskData)).rejected;
    });
  });

  describe('JSON Field Storage', () => {
    it('should store and retrieve complex request_payload correctly', async () => {
      const payload = {
        plantName: 'Tomato',
        conditions: {
          temperature: 75,
          humidity: 60,
          sunlight: 'full',
        },
        history: [
          { date: '2024-01-01', action: 'watered' },
          { date: '2024-01-05', action: 'fertilized' },
        ],
      };

      const task = await AITask.create({
        task_type: 'plant_update_suggestion' as const,
        request_payload: payload,
      });

      expect(task.request_payload).to.deep.equal(payload);

      // Verify it persists after retrieval
      const retrieved = await AITask.findByPk(task.id);
      expect(retrieved?.request_payload).to.deep.equal(payload);
    });

    it('should store and retrieve complex response_data correctly', async () => {
      const responseData = {
        action: 'Water immediately',
        reason: 'Soil moisture is below 20%',
        confidence: 0.95,
        additionalInfo: {
          nextWatering: '2024-01-10',
          recommendedAmount: '2 cups',
        },
      };

      const task = await AITask.create({
        task_type: 'care_recommendation' as const,
        request_payload: { test: 'data' },
        response_data: responseData,
        status: 'completed' as const,
      });

      expect(task.response_data).to.deep.equal(responseData);

      // Verify it persists after retrieval
      const retrieved = await AITask.findByPk(task.id);
      expect(retrieved?.response_data).to.deep.equal(responseData);
    });
  });

  describe('Associations', () => {
    it('should associate with a user', async () => {
      const task = await AITask.create({
        user_id: testUser.id,
        task_type: 'general' as const,
        request_payload: { question: 'Test question' },
      });

      const taskWithUser = await AITask.findOne({
        where: { id: task.id },
        include: [{ model: User, as: 'user' }],
      });

      expect(taskWithUser).to.exist;
      expect((taskWithUser as any)?.user).to.exist;
      expect((taskWithUser as any)?.user?.id).to.equal(testUser.id);
    });

    it('should associate with a plant', async () => {
      const task = await AITask.create({
        plant_id: testPlant.id,
        task_type: 'plant_update_suggestion' as const,
        request_payload: { plantName: 'Test Plant' },
      });

      const taskWithPlant = await AITask.findOne({
        where: { id: task.id },
        include: [{ model: Plant, as: 'plant' }],
      });

      expect(taskWithPlant).to.exist;
      expect((taskWithPlant as any)?.plant).to.exist;
      expect((taskWithPlant as any)?.plant?.id).to.equal(testPlant.id);
    });

    it('should allow null user_id and plant_id', async () => {
      const task = await AITask.create({
        task_type: 'general' as const,
        request_payload: { question: 'General question' },
      });

      expect(task.user_id).to.be.null;
      expect(task.plant_id).to.be.null;
    });
  });

  describe('Updates', () => {
    it('should update task status and response', async () => {
      const task = await AITask.create({
        task_type: 'care_recommendation' as const,
        request_payload: { plantType: 'Tomato' },
        status: 'pending' as const,
      });

      const updates = {
        status: 'completed' as const,
        response_data: {
          action: 'Water weekly',
          reason: 'Standard care schedule',
          confidence: 0.85,
        },
        model_used: 'claude-3-5-sonnet-20241022',
        completed_at: new Date(),
      };

      await task.update(updates);

      expect(task.status).to.equal(updates.status);
      expect(task.response_data).to.deep.equal(updates.response_data);
      expect(task.model_used).to.equal(updates.model_used);
      expect(task.completed_at).to.exist;
    });

    it('should update task to failed status with error message', async () => {
      const task = await AITask.create({
        task_type: 'pest_diagnosis' as const,
        request_payload: { symptoms: 'Yellow leaves' },
        status: 'processing' as const,
      });

      const updates = {
        status: 'failed' as const,
        error_message: 'API timeout',
        completed_at: new Date(),
      };

      await task.update(updates);

      expect(task.status).to.equal('failed');
      expect(task.error_message).to.equal('API timeout');
      expect(task.completed_at).to.exist;
    });
  });

  describe('Timestamps', () => {
    it('should automatically set created_at and updated_at', async () => {
      const task = await AITask.create({
        task_type: 'general' as const,
        request_payload: { test: 'data' },
      });

      expect(task.created_at).to.exist;
      expect(task.updated_at).to.exist;
      expect(task.created_at).to.be.instanceOf(Date);
      expect(task.updated_at).to.be.instanceOf(Date);
    });

    it('should update updated_at when task is modified', async () => {
      const task = await AITask.create({
        task_type: 'general' as const,
        request_payload: { test: 'data' },
      });

      const originalUpdatedAt = task.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await task.update({ status: 'processing' as const });

      expect(task.updated_at.getTime()).to.be.greaterThan(originalUpdatedAt.getTime());
    });
  });
});
