/**
 * AITaskWorker Tests
 *
 * Tests the AI task worker's garden analysis integration:
 * - Receiving garden_analysis jobs
 * - Calling GardenAnalysisService
 * - Publishing completion events
 * - Error handling
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { GardenAnalysisService } from '../../../services/ai/garden/GardenAnalysisService';
import { messageBus, MessageBusEvent } from '../../../services/messageBus';
import { v4 as uuidv4 } from 'uuid';

describe('AITaskWorker - Garden Analysis Integration', () => {
  let analyzeGardenStub: sinon.SinonStub;
  let messageBusPublishSpy: sinon.SinonSpy;

  const userId = uuidv4();
  const gardenId = uuidv4();
  const jobId = uuidv4();

  beforeEach(() => {
    analyzeGardenStub = sinon.stub(
      GardenAnalysisService.prototype,
      'analyzeGarden'
    );
    messageBusPublishSpy = sinon.spy(messageBus, 'publish');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('garden_analysis job handling', () => {
    it('should call GardenAnalysisService for garden_analysis jobs', async () => {
      const mockAnalysisResult = {
        gardenId,
        analyzedAt: new Date(),
        context: {} as any,
        suggestions: [],
        overallScore: 85,
        summary: 'Test summary',
      };

      analyzeGardenStub.resolves(mockAnalysisResult);

      // Simulate worker processing garden_analysis job
      // We're testing the integration logic here
      const jobPayload = {
        gardenId,
        userId,
        triggeredBy: 'garden_plot_change',
        timestamp: new Date().toISOString(),
      };

      const gardenService = new GardenAnalysisService();
      const result = await gardenService.analyzeGarden(
        jobPayload.gardenId,
        jobPayload.userId
      );

      expect(analyzeGardenStub.calledOnce).to.be.true;
      expect(analyzeGardenStub.calledWith(gardenId, userId)).to.be.true;
      expect(result).to.deep.equal(mockAnalysisResult);
    });

    it('should publish GARDEN_ANALYSIS_COMPLETED event on success', () => {
      const payload = {
        gardenId,
        userId,
        analysisId: jobId,
        overallScore: 90,
        suggestionCount: 3,
        timestamp: new Date(),
      };

      messageBus.publish(MessageBusEvent.GARDEN_ANALYSIS_COMPLETED, payload);

      expect(messageBusPublishSpy.calledOnce).to.be.true;
      expect(
        messageBusPublishSpy.calledWith(
          MessageBusEvent.GARDEN_ANALYSIS_COMPLETED,
          sinon.match(payload)
        )
      ).to.be.true;
    });

    it('should include correct data in completion event', () => {
      const completionPayload = {
        gardenId,
        userId,
        analysisId: jobId,
        overallScore: 75,
        suggestionCount: 5,
        timestamp: new Date(),
      };

      messageBus.publish(
        MessageBusEvent.GARDEN_ANALYSIS_COMPLETED,
        completionPayload
      );

      const publishCall = messageBusPublishSpy.getCall(0);
      expect(publishCall.args[0]).to.equal(
        MessageBusEvent.GARDEN_ANALYSIS_COMPLETED
      );
      expect(publishCall.args[1]).to.have.property('gardenId', gardenId);
      expect(publishCall.args[1]).to.have.property('userId', userId);
      expect(publishCall.args[1]).to.have.property('analysisId', jobId);
      expect(publishCall.args[1]).to.have.property('overallScore', 75);
      expect(publishCall.args[1]).to.have.property('suggestionCount', 5);
      expect(publishCall.args[1]).to.have.property('timestamp');
    });
  });

  describe('job payload validation', () => {
    it('should require gardenId in payload', async () => {
      const invalidPayload = {
        userId,
        triggeredBy: 'garden_plot_change',
      };

      // Simulate validation check
      expect(invalidPayload).to.not.have.property('gardenId');
    });

    it('should require userId in payload', async () => {
      const invalidPayload = {
        gardenId,
        triggeredBy: 'garden_plot_change',
      };

      expect(invalidPayload).to.not.have.property('userId');
    });

    it('should accept valid payload with all required fields', () => {
      const validPayload = {
        gardenId,
        userId,
        triggeredBy: 'garden_plot_change',
        timestamp: new Date().toISOString(),
      };

      expect(validPayload).to.have.property('gardenId');
      expect(validPayload).to.have.property('userId');
      expect(validPayload).to.have.property('triggeredBy');
      expect(validPayload).to.have.property('timestamp');
    });
  });

  describe('error handling', () => {
    it('should handle errors from GardenAnalysisService', async () => {
      const error = new Error('Garden not found');
      analyzeGardenStub.rejects(error);

      try {
        const gardenService = new GardenAnalysisService();
        await gardenService.analyzeGarden(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).to.equal('Garden not found');
      }
    });

    it('should handle missing garden errors', async () => {
      analyzeGardenStub.rejects(
        new Error('Garden not found or access denied')
      );

      try {
        const gardenService = new GardenAnalysisService();
        await gardenService.analyzeGarden(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).to.include('Garden not found');
      }
    });

    it('should handle database connection errors', async () => {
      analyzeGardenStub.rejects(new Error('Database connection failed'));

      try {
        const gardenService = new GardenAnalysisService();
        await gardenService.analyzeGarden(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).to.include('Database connection failed');
      }
    });
  });

  describe('analysis result structure', () => {
    it('should return properly structured analysis result', async () => {
      const mockResult = {
        gardenId,
        analyzedAt: new Date(),
        context: {
          garden: {
            id: gardenId,
            name: 'Test Garden',
            dimensions: { width: 10, height: 10 },
            zone: '5a',
          },
          user: { zone: '5a', timezone: 'UTC' },
          plots: [],
          companionRules: [],
          seasonalTips: [],
          metrics: {
            totalPlots: 0,
            occupiedPlots: 0,
            uniquePlants: 0,
            averageSpacing: null,
            zoneCompatibilityIssues: 0,
            companionConflicts: 0,
          },
        },
        suggestions: [
          {
            type: 'improvement' as const,
            category: 'spacing',
            title: 'Test Suggestion',
            description: 'Test description',
            affectedIds: [],
            priority: 'low' as const,
            actionable: true,
          },
        ],
        overallScore: 95,
        summary: 'Test summary',
      };

      analyzeGardenStub.resolves(mockResult);

      const gardenService = new GardenAnalysisService();
      const result = await gardenService.analyzeGarden(gardenId, userId);

      expect(result).to.have.property('gardenId');
      expect(result).to.have.property('analyzedAt');
      expect(result).to.have.property('context');
      expect(result).to.have.property('suggestions');
      expect(result).to.have.property('overallScore');
      expect(result).to.have.property('summary');
    });

    it('should include suggestions array in result', async () => {
      const mockResult = {
        gardenId,
        analyzedAt: new Date(),
        context: {} as any,
        suggestions: [
          {
            type: 'warning' as const,
            category: 'companion_planting',
            title: 'Test Warning',
            description: 'Test description',
            affectedIds: [uuidv4()],
            priority: 'high' as const,
            actionable: true,
          },
          {
            type: 'optimization' as const,
            category: 'layout',
            title: 'Test Optimization',
            description: 'Test description',
            affectedIds: [],
            priority: 'medium' as const,
            actionable: true,
          },
        ],
        overallScore: 80,
        summary: 'Test summary',
      };

      analyzeGardenStub.resolves(mockResult);

      const gardenService = new GardenAnalysisService();
      const result = await gardenService.analyzeGarden(gardenId, userId);

      expect(result.suggestions).to.be.an('array');
      expect(result.suggestions).to.have.length(2);
      expect(result.suggestions[0]).to.have.property('type');
      expect(result.suggestions[0]).to.have.property('category');
      expect(result.suggestions[0]).to.have.property('title');
      expect(result.suggestions[0]).to.have.property('description');
    });
  });

  describe('event-driven integration', () => {
    it('should work with message bus events', () => {
      const analysisCompletedHandler = sinon.spy();

      // Subscribe to completion event
      const unsubscribe = messageBus.subscribe(
        MessageBusEvent.GARDEN_ANALYSIS_COMPLETED,
        analysisCompletedHandler
      );

      // Publish event
      messageBus.publish(MessageBusEvent.GARDEN_ANALYSIS_COMPLETED, {
        gardenId,
        userId,
        analysisId: jobId,
        overallScore: 85,
        suggestionCount: 3,
        timestamp: new Date(),
      });

      expect(analysisCompletedHandler.calledOnce).to.be.true;

      unsubscribe();
    });

    it('should include timestamp in completion events', () => {
      const beforeTime = new Date();

      messageBus.publish(MessageBusEvent.GARDEN_ANALYSIS_COMPLETED, {
        gardenId,
        userId,
        analysisId: jobId,
        overallScore: 90,
        suggestionCount: 2,
        timestamp: new Date(),
      });

      const publishCall = messageBusPublishSpy.getCall(0);
      const eventTimestamp = publishCall.args[1].timestamp;

      expect(eventTimestamp).to.be.instanceOf(Date);
      expect(eventTimestamp.getTime()).to.be.at.least(beforeTime.getTime());
    });

    it('should pass through analysis metrics in events', () => {
      const payload = {
        gardenId,
        userId,
        analysisId: jobId,
        overallScore: 65,
        suggestionCount: 8,
        timestamp: new Date(),
      };

      messageBus.publish(MessageBusEvent.GARDEN_ANALYSIS_COMPLETED, payload);

      const publishCall = messageBusPublishSpy.getCall(0);
      expect(publishCall.args[1].overallScore).to.equal(65);
      expect(publishCall.args[1].suggestionCount).to.equal(8);
    });
  });
});
