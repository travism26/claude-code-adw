import { AIWrapper, AIRequest } from '../../services/aiWrapper';
import { AITask, User, Plant } from '../../models';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { getSequelize } from '../../config/sequelize';
import { v4 as uuidv4 } from 'uuid';

use(chaiAsPromised);

describe('AIWrapper Service', () => {
  let aiWrapper: AIWrapper;
  let testUser: User;
  let testPlant: Plant;

  before(async () => {
    const sequelize = await getSequelize();
    aiWrapper = new AIWrapper(sequelize);

    testUser = await testHelper.createTestUser();
    testPlant = await Plant.create({
      user_id: testUser.id,
      name: 'Test Tomato',
      type: 'indoor',
      water_interval_days: 7,
    });
  });

  beforeEach(() => {
    // Stub the AI API clients to avoid actual API calls
    // We'll stub the methods in the test class itself
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Request Validation', () => {
    it('should reject request without taskId', async () => {
      const request = {
        type: 'general' as const,
        payload: { question: 'Test' },
      } as any;

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('failed');
      expect(response.error).to.include('taskId');
    });

    it('should reject request without type', async () => {
      const request = {
        taskId: uuidv4(),
        payload: { question: 'Test' },
      } as any;

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('failed');
      expect(response.error).to.include('type');
    });

    it('should reject request without payload', async () => {
      const request = {
        taskId: uuidv4(),
        type: 'general' as const,
      } as any;

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('failed');
      expect(response.error).to.include('payload');
    });

    it('should reject request with invalid task type', async () => {
      const request = {
        taskId: uuidv4(),
        type: 'invalid_type' as any,
        payload: { question: 'Test' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('failed');
      expect(response.error).to.include('Invalid task type');
    });

    it('should accept valid request with all required fields', async () => {
      // Mock the AI API to return a successful response
      const mockClaudeResponse = {
        action: 'Water your plant',
        reason: 'Soil is dry',
        confidence: 0.9,
      };

      // Stub the private callClaudeAPI method
      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .resolves(mockClaudeResponse);

      const request: AIRequest = {
        taskId: uuidv4(),
        type: 'general',
        payload: { question: 'How often should I water tomatoes?' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('completed');
      expect(response.suggestion).to.exist;
      expect(callClaudeStub.calledOnce).to.be.true;

      callClaudeStub.restore();
    });
  });

  describe('Response Sanitization', () => {
    it('should sanitize HTML tags from AI response', async () => {
      const mockResponse = {
        action: '<script>alert("xss")</script>Water your plant',
        reason: '<b>Soil is dry</b>',
        confidence: 0.9,
      };

      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .resolves(mockResponse);

      const request: AIRequest = {
        taskId: uuidv4(),
        type: 'care_recommendation',
        payload: { plantType: 'Tomato' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('completed');
      expect(response.suggestion?.action).to.not.include('<script>');
      expect(response.suggestion?.action).to.not.include('<b>');
      expect(response.suggestion?.reason).to.not.include('<b>');

      callClaudeStub.restore();
    });

    it('should ensure confidence is between 0 and 1', async () => {
      const mockResponse = {
        action: 'Test action',
        reason: 'Test reason',
        confidence: 5.5, // Invalid - too high
      };

      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .resolves(mockResponse);

      const request: AIRequest = {
        taskId: uuidv4(),
        type: 'general',
        payload: { question: 'Test' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.suggestion?.confidence).to.be.at.most(1);
      expect(response.suggestion?.confidence).to.be.at.least(0);

      callClaudeStub.restore();
    });

    it('should handle missing fields in AI response', async () => {
      const mockResponse = {
        // Missing action and reason
        confidence: 0.7,
      };

      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .resolves(mockResponse);

      const request: AIRequest = {
        taskId: uuidv4(),
        type: 'general',
        payload: { question: 'Test' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('completed');
      expect(response.suggestion).to.exist;
      expect(response.suggestion?.action).to.be.a('string');
      expect(response.suggestion?.reason).to.be.a('string');

      callClaudeStub.restore();
    });
  });

  describe('Database Storage', () => {
    it('should create AITask record when processing request', async () => {
      const mockResponse = {
        action: 'Water your plant',
        reason: 'Soil is dry',
        confidence: 0.85,
      };

      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .resolves(mockResponse);

      const taskId = uuidv4();
      const request: AIRequest = {
        taskId,
        type: 'plant_update_suggestion',
        payload: {
          plantName: 'Tomato',
          currentConditions: { water_level: 'low' },
        },
        userId: testUser.id,
        plantId: testPlant.id,
      };

      await aiWrapper.makeRequest(request);

      const task = await AITask.findByPk(taskId);
      expect(task).to.exist;
      expect(task?.status).to.equal('completed');
      expect(task?.user_id).to.equal(testUser.id);
      expect(task?.plant_id).to.equal(testPlant.id);
      expect(task?.task_type).to.equal('plant_update_suggestion');
      expect(task?.request_payload).to.deep.equal(request.payload);
      expect(task?.response_data).to.exist;
      expect(task?.model_used).to.exist;
      expect(task?.completed_at).to.exist;

      callClaudeStub.restore();
    });

    it('should store error message on failed request', async () => {
      const errorMessage = 'API timeout error';
      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .rejects(new Error(errorMessage));

      // Also stub OpenAI as fallback
      const callOpenAIStub = sinon
        .stub(aiWrapper as any, 'callOpenAIAPI')
        .rejects(new Error(errorMessage));

      const taskId = uuidv4();
      const request: AIRequest = {
        taskId,
        type: 'general',
        payload: { question: 'Test' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('failed');

      const task = await AITask.findByPk(taskId);
      expect(task).to.exist;
      expect(task?.status).to.equal('failed');
      expect(task?.error_message).to.include(errorMessage);

      callClaudeStub.restore();
      callOpenAIStub.restore();
    });
  });

  describe('Task Type Handling', () => {
    const taskTypes: Array<AIRequest['type']> = [
      'plant_update_suggestion',
      'weather_based_action',
      'care_recommendation',
      'pest_diagnosis',
      'general',
    ];

    for (const taskType of taskTypes) {
      it(`should handle ${taskType} task type`, async () => {
        const mockResponse = {
          action: `Action for ${taskType}`,
          reason: `Reason for ${taskType}`,
          confidence: 0.8,
        };

        const callClaudeStub = sinon
          .stub(aiWrapper as any, 'callClaudeAPI')
          .resolves(mockResponse);

        const request: AIRequest = {
          taskId: uuidv4(),
          type: taskType,
          payload: { test: `data for ${taskType}` },
        };

        const response = await aiWrapper.makeRequest(request);

        expect(response.status).to.equal('completed');
        expect(response.suggestion).to.exist;

        callClaudeStub.restore();
      });
    }
  });

  describe('Error Handling', () => {
    it('should handle AI API failures gracefully', async () => {
      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .rejects(new Error('Network error'));

      const callOpenAIStub = sinon
        .stub(aiWrapper as any, 'callOpenAIAPI')
        .rejects(new Error('Network error'));

      const request: AIRequest = {
        taskId: uuidv4(),
        type: 'general',
        payload: { question: 'Test' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('failed');
      expect(response.error).to.exist;
      expect(response.suggestion).to.not.exist;

      callClaudeStub.restore();
      callOpenAIStub.restore();
    });

    it('should fallback to OpenAI if Claude fails', async () => {
      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .rejects(new Error('Claude API error'));

      const mockOpenAIResponse = {
        action: 'OpenAI fallback action',
        reason: 'OpenAI fallback reason',
        confidence: 0.75,
      };

      const callOpenAIStub = sinon
        .stub(aiWrapper as any, 'callOpenAIAPI')
        .resolves(mockOpenAIResponse);

      const request: AIRequest = {
        taskId: uuidv4(),
        type: 'general',
        payload: { question: 'Test' },
      };

      const response = await aiWrapper.makeRequest(request);

      expect(response.status).to.equal('completed');
      expect(response.suggestion).to.exist;
      expect(callOpenAIStub.calledOnce).to.be.true;

      callClaudeStub.restore();
      callOpenAIStub.restore();
    });
  });

  describe('Associations', () => {
    it('should link AI task to user', async () => {
      const mockResponse = {
        action: 'Test action',
        reason: 'Test reason',
        confidence: 0.9,
      };

      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .resolves(mockResponse);

      const taskId = uuidv4();
      const request: AIRequest = {
        taskId,
        type: 'general',
        payload: { question: 'Test' },
        userId: testUser.id,
      };

      await aiWrapper.makeRequest(request);

      const task = await AITask.findOne({
        where: { id: taskId },
        include: [{ model: User, as: 'user' }],
      });

      expect(task).to.exist;
      expect((task as any)?.user).to.exist;
      expect((task as any)?.user?.id).to.equal(testUser.id);

      callClaudeStub.restore();
    });

    it('should link AI task to plant', async () => {
      const mockResponse = {
        action: 'Test action',
        reason: 'Test reason',
        confidence: 0.9,
      };

      const callClaudeStub = sinon
        .stub(aiWrapper as any, 'callClaudeAPI')
        .resolves(mockResponse);

      const taskId = uuidv4();
      const request: AIRequest = {
        taskId,
        type: 'plant_update_suggestion',
        payload: { plantName: 'Test' },
        plantId: testPlant.id,
      };

      await aiWrapper.makeRequest(request);

      const task = await AITask.findOne({
        where: { id: taskId },
        include: [{ model: Plant, as: 'plant' }],
      });

      expect(task).to.exist;
      expect((task as any)?.plant).to.exist;
      expect((task as any)?.plant?.id).to.equal(testPlant.id);

      callClaudeStub.restore();
    });
  });
});
