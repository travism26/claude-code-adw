import { describe, it, before, beforeEach, after } from 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { createServer } from 'http';
import { testHelper } from '../../mocha.setup';
import { messageBus, MessageBusEvent } from '../../../services/messageBus';
import { AITask, User, Notification } from '../../../models';
import { WebSocketService } from '../../../services/websocket';
import { getSequelize } from '../../../config/sequelize';

use(chaiAsPromised);

describe('WebSocketService - AI Task Completed Notification', () => {
  let testUser: User;
  let aiTask: AITask;
  let wsService: WebSocketService;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    testUser = await testHelper.createTestUser();

    // Initialize WebSocketService for tests
    httpServer = createServer();
    const sequelize = await getSequelize();
    wsService = new WebSocketService(httpServer, sequelize);
  });

  after(async () => {
    // Clean up WebSocket service
    if (wsService) {
      await wsService.shutdown();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  beforeEach(async () => {
    // Clean up notifications before each test
    await Notification.destroy({ where: { user_id: testUser.id } });
  });

  describe('AI_TASK_COMPLETED event handling', () => {
    it('should create notification when AI_TASK_COMPLETED event is published for garden_analysis', async () => {
      // Create an AI task with garden_analysis type
      aiTask = await AITask.create({
        user_id: testUser.id,
        task_type: 'garden_analysis',
        status: 'completed',
        request_payload: { gardenId: 'test-garden-123' },
        response_data: { analysis: 'test data' },
      });

      // Simulate the AI worker publishing AI_TASK_COMPLETED event with enriched payload
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId: aiTask.id,
        userId: testUser.id,
        taskType: 'garden_analysis',
        requestPayload: { gardenId: 'test-garden-123' },
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification was created
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].message).to.equal('Your garden analysis is complete! View your recommendations.');
      expect(notifications[0].link).to.equal('/garden-planner/test-garden-123');
      expect(notifications[0].type).to.equal('success');
      expect(notifications[0].read).to.equal(false);
    });

    it('should create notification with correct message for plant_update_suggestion task', async () => {
      // No need to create AITask in DB - we're testing the enriched payload approach
      const taskId = '00000000-0000-0000-0000-000000000001';
      const plantId = '00000000-0000-0000-0000-000000000123';

      // Publish event with enriched payload
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId,
        userId: testUser.id,
        taskType: 'plant_update_suggestion',
        plantId,
        requestPayload: { action: 'update' },
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].message).to.equal('New care suggestions available for your plant.');
      expect(notifications[0].link).to.equal(`/plants/${plantId}`);
    });

    it('should create notification with correct message for care_recommendation task', async () => {
      // No need to create AITask in DB - we're testing the enriched payload approach
      const taskId = '00000000-0000-0000-0000-000000000002';
      const plantId = '00000000-0000-0000-0000-000000000456';

      // Publish event with enriched payload
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId,
        userId: testUser.id,
        taskType: 'care_recommendation',
        plantId,
        requestPayload: { type: 'care' },
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].message).to.equal('Your personalized care plan is ready.');
      expect(notifications[0].link).to.equal(`/plants/${plantId}`);
    });

    it('should create notification with correct message for pest_diagnosis task', async () => {
      // No need to create AITask in DB - we're testing the enriched payload approach
      const taskId = '00000000-0000-0000-0000-000000000003';
      const plantId = '00000000-0000-0000-0000-000000000789';

      // Publish event with enriched payload
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId,
        userId: testUser.id,
        taskType: 'pest_diagnosis',
        plantId,
        requestPayload: { symptoms: 'test' },
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].message).to.equal('Pest diagnosis complete. View treatment recommendations.');
      expect(notifications[0].link).to.equal(`/plants/${plantId}`);
    });

    it('should create notification with correct message for weather_based_action task', async () => {
      // Create an AI task with weather_based_action type
      aiTask = await AITask.create({
        user_id: testUser.id,
        task_type: 'weather_based_action',
        status: 'completed',
        request_payload: { weather: 'test' },
        response_data: { action: 'test data' },
      });

      // Publish event with enriched payload
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId: aiTask.id,
        userId: testUser.id,
        taskType: 'weather_based_action',
        requestPayload: { weather: 'test' },
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].message).to.equal('Weather-based action plan is ready.');
      expect(notifications[0].link).to.equal('/dashboard');
    });

    it('should create notification with default message for general task', async () => {
      // Create an AI task with general type
      aiTask = await AITask.create({
        user_id: testUser.id,
        task_type: 'general',
        status: 'completed',
        request_payload: { task: 'general' },
        response_data: { result: 'test data' },
      });

      // Publish event with enriched payload
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId: aiTask.id,
        userId: testUser.id,
        taskType: 'general',
        requestPayload: { task: 'general' },
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].message).to.equal('Your AI task is complete.');
      expect(notifications[0].link).to.equal('/dashboard');
    });

    it('should publish NOTIFICATION_CREATED event to message bus', (done) => {
      // Create an AI task
      AITask.create({
        user_id: testUser.id,
        task_type: 'general',
        status: 'completed',
        request_payload: { task: 'test' },
        response_data: { result: 'test' },
      }).then((task) => {
        // Subscribe to NOTIFICATION_CREATED event
        const unsubscribe = messageBus.subscribe(
          MessageBusEvent.NOTIFICATION_CREATED,
          (payload) => {
            expect(payload.userId).to.equal(testUser.id);
            expect(payload.message).to.equal('Your AI task is complete.');
            expect(payload.type).to.equal('success');
            unsubscribe();
            done();
          }
        );

        // Publish AI_TASK_COMPLETED event with enriched payload
        messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
          taskId: task.id,
          userId: testUser.id,
          taskType: 'general',
          requestPayload: { task: 'test' },
          timestamp: new Date(),
        });
      });
    });

    it('should handle payload without database task lookup', async () => {
      const nonExistentTaskId = '00000000-0000-0000-0000-000000000000';

      // Publish event with enriched payload (no database lookup needed)
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId: nonExistentTaskId,
        userId: testUser.id,
        taskType: 'general',
        requestPayload: {},
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification was created even though task doesn't exist in DB
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].message).to.equal('Your AI task is complete.');
    });

    it('should use fallback link when gardenId is missing from garden_analysis task', async () => {
      // Create an AI task without gardenId in request_payload
      aiTask = await AITask.create({
        user_id: testUser.id,
        task_type: 'garden_analysis',
        status: 'completed',
        request_payload: {},
        response_data: { analysis: 'test data' },
      });

      // Publish event with enriched payload but no gardenId
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId: aiTask.id,
        userId: testUser.id,
        taskType: 'garden_analysis',
        requestPayload: {},
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification uses fallback link
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].link).to.equal('/dashboard');
    });

    it('should use fallback link when plant_id is missing from plant task', async () => {
      // Create an AI task without plant_id
      aiTask = await AITask.create({
        user_id: testUser.id,
        task_type: 'care_recommendation',
        status: 'completed',
        request_payload: { type: 'care' },
        response_data: { recommendation: 'test data' },
      });

      // Publish event with enriched payload but no plantId
      messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
        taskId: aiTask.id,
        userId: testUser.id,
        taskType: 'care_recommendation',
        requestPayload: { type: 'care' },
        timestamp: new Date(),
      });

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification uses fallback link
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });

      expect(notifications).to.have.length(1);
      expect(notifications[0].link).to.equal('/dashboard');
    });
  });
});
