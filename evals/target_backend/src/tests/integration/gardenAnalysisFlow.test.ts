/**
 * Garden Analysis End-to-End Integration Tests
 *
 * Tests the complete flow from plot CRUD operations to AI analysis:
 * 1. Plot CRUD → Event published
 * 2. Event → Debounce timer started
 * 3. Timer expires → Job enqueued
 * 4. Worker processes → Analysis generated
 * 5. Analysis complete → Event published
 *
 * These tests verify that all components work together correctly.
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { GardenEventHandler } from '../../services/events/GardenEventHandler';
import { GardenAnalysisService } from '../../services/ai/garden/GardenAnalysisService';
import { GardenContextBuilder } from '../../services/ai/garden/GardenContextBuilder';
import { messageBus, MessageBusEvent } from '../../services/messageBus';
import * as aiTasksQueue from '../../services/queue/queues/aiTasks.queue';
import { v4 as uuidv4 } from 'uuid';

describe('Garden Analysis Flow - End-to-End Integration', () => {
  let clock: sinon.SinonFakeTimers;
  let eventHandler: GardenEventHandler;
  let enqueueStub: sinon.SinonStub;
  let contextBuilderStub: sinon.SinonStub;

  const userId = uuidv4();
  const gardenId = uuidv4();
  const plotId = uuidv4();

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    // Stub queue function
    enqueueStub = sinon.stub(aiTasksQueue, 'queueGardenAnalysisJob');
    enqueueStub.resolves({ id: uuidv4() });

    // Stub context builder to avoid database calls
    contextBuilderStub = sinon.stub(GardenContextBuilder.prototype, 'build');
    contextBuilderStub.resolves({
      garden: {
        id: gardenId,
        name: 'Test Garden',
        dimensions: { width: 10, height: 10 },
        zone: '5a',
      },
      user: { zone: '5a', timezone: 'UTC' },
      plots: [
        {
          id: plotId,
          position: { x: 0, y: 0 },
          dimensions: { width: 2, height: 2 },
          compassDirection: 'N',
          notes: null,
          plant: {
            profileId: uuidv4(),
            name: 'Tomato',
            species: null,
            type: 'vegetable',
            sunlightRequirements: 'full_sun',
            spacingInches: 24,
            plantFamily: 'Solanaceae',
            zoneMin: 3,
            zoneMax: 9,
            difficulty: 'medium',
          },
        },
      ],
      companionRules: [],
      seasonalTips: [],
      metrics: {
        totalPlots: 1,
        occupiedPlots: 1,
        uniquePlants: 1,
        averageSpacing: null,
        zoneCompatibilityIssues: 0,
        companionConflicts: 0,
      },
    });

    eventHandler = new GardenEventHandler();
    eventHandler.initialize();
  });

  afterEach(async () => {
    await eventHandler.shutdown();
    clock.restore();
    sinon.restore();
  });

  describe('complete flow: plot created → debounce → queue → analysis', () => {
    it('should complete full flow when plot is created', async () => {
      // Step 1: Plot created event
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      // Verify debounce timer is active
      let status = eventHandler.getStatus();
      expect(status.pendingDebounces).to.equal(1);

      // Step 2: Wait for debounce delay
      await clock.tickAsync(5000);

      // Verify job was enqueued
      expect(enqueueStub.calledOnce).to.be.true;
      expect(enqueueStub.firstCall.args[0]).to.deep.include({
        gardenId,
        userId,
        triggeredBy: 'garden_plot_change',
      });

      // Verify debounce timer is cleared
      status = eventHandler.getStatus();
      expect(status.pendingDebounces).to.equal(0);

      // Verify analysis is marked as in-flight
      expect(status.inFlightAnalysis).to.equal(1);
    });

    it('should generate analysis result when worker processes job', async () => {
      // Trigger the flow
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      // Step 3: Worker processes job (simulate)
      const analysisService = new GardenAnalysisService();
      const result = await analysisService.analyzeGarden(gardenId, userId);

      // Verify analysis result structure
      expect(result).to.have.property('gardenId', gardenId);
      expect(result).to.have.property('analyzedAt');
      expect(result).to.have.property('context');
      expect(result).to.have.property('suggestions');
      expect(result).to.have.property('overallScore');
      expect(result).to.have.property('summary');
    });

    it('should publish completion event after analysis', async () => {
      const completionHandler = sinon.spy();
      const unsubscribe = messageBus.subscribe(
        MessageBusEvent.GARDEN_ANALYSIS_COMPLETED,
        completionHandler
      );

      // Trigger analysis
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      // Simulate worker publishing completion event
      messageBus.publish(MessageBusEvent.GARDEN_ANALYSIS_COMPLETED, {
        gardenId,
        userId,
        analysisId: uuidv4(),
        overallScore: 85,
        suggestionCount: 2,
        timestamp: new Date(),
      });

      expect(completionHandler.calledOnce).to.be.true;

      unsubscribe();
    });
  });

  describe('multiple rapid changes batching', () => {
    it('should batch multiple rapid plot changes into single analysis', async () => {
      // Rapidly create 5 plots
      for (let i = 0; i < 5; i++) {
        messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
          gardenId,
          userId,
          plotId: uuidv4(),
          timestamp: new Date(),
        });
        await clock.tickAsync(500);
      }

      // Should still be in debounce (only 2.5 seconds passed)
      const status = eventHandler.getStatus();
      expect(status.pendingDebounces).to.equal(1);
      expect(enqueueStub.called).to.be.false;

      // Wait for debounce to complete
      await clock.tickAsync(5000);

      // Should have triggered only one analysis
      expect(enqueueStub.calledOnce).to.be.true;
    });

    it('should handle mix of create/update/delete events', async () => {
      // Create
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId: plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(1000);

      // Update
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId: plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(1000);

      // Delete
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_DELETED, {
        gardenId,
        userId,
        plotId: plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(1000);

      // Another create
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      // Wait for debounce
      await clock.tickAsync(5000);

      // Should have batched all into one analysis
      expect(enqueueStub.calledOnce).to.be.true;
    });
  });

  describe('multiple gardens independence', () => {
    it('should handle changes to different gardens independently', async () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();

      // Event for garden 1
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      await clock.tickAsync(2000);

      // Event for garden 2
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      // Should have 2 independent timers
      const status = eventHandler.getStatus();
      expect(status.pendingDebounces).to.equal(2);

      // Advance to trigger garden 1 analysis
      await clock.tickAsync(3000);

      expect(enqueueStub.calledOnce).to.be.true;
      expect(enqueueStub.firstCall.args[0].gardenId).to.equal(gardenId1);

      // Advance to trigger garden 2 analysis
      await clock.tickAsync(2000);

      expect(enqueueStub.calledTwice).to.be.true;
      expect(enqueueStub.secondCall.args[0].gardenId).to.equal(gardenId2);
    });

    it('should not interfere between different users gardens', async () => {
      const userId1 = uuidv4();
      const userId2 = uuidv4();
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();

      // User 1's garden
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId: userId1,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      // User 2's garden
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId: userId2,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      // Both should trigger
      expect(enqueueStub.calledTwice).to.be.true;

      // Verify correct user IDs in payloads
      expect(enqueueStub.firstCall.args[0].userId).to.be.oneOf([
        userId1,
        userId2,
      ]);
      expect(enqueueStub.secondCall.args[0].userId).to.be.oneOf([
        userId1,
        userId2,
      ]);
    });
  });

  describe('error scenarios in flow', () => {
    it('should handle queue failures gracefully', async () => {
      enqueueStub.rejects(new Error('Queue connection failed'));

      // Should not throw
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      // Error should be handled, in-flight should be cleared
      const status = eventHandler.getStatus();
      expect(status.inFlightAnalysis).to.equal(0);
    });

    it('should allow retry after queue failure', async () => {
      // First attempt fails
      enqueueStub.onFirstCall().rejects(new Error('Queue error'));

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      // Second attempt succeeds
      enqueueStub.onSecondCall().resolves({ id: uuidv4() });

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      expect(enqueueStub.calledTwice).to.be.true;
    });

    it('should handle analysis service errors', async () => {
      contextBuilderStub.rejects(new Error('Garden not found'));

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      // Worker would process the job
      const analysisService = new GardenAnalysisService();

      try {
        await analysisService.analyzeGarden(gardenId, userId);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('Garden not found');
      }
    });
  });

  describe('in-flight duplicate prevention', () => {
    it('should prevent duplicate analysis while one is in-flight', async () => {
      // First event triggers analysis
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      expect(enqueueStub.calledOnce).to.be.true;

      // Second event while analysis is in-flight
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      // Should not enqueue again
      expect(enqueueStub.calledOnce).to.be.true;
    });

    it('should allow new analysis after in-flight timeout', async () => {
      // First analysis
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      expect(enqueueStub.calledOnce).to.be.true;

      // Wait for in-flight timeout (5 minutes)
      await clock.tickAsync(5 * 60 * 1000);

      // New event should trigger new analysis
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      expect(enqueueStub.calledTwice).to.be.true;
    });
  });

  describe('integration with message bus events', () => {
    it('should work with all three plot event types', async () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();
      const gardenId3 = uuidv4();

      // Created event
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      // Updated event
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId: gardenId2,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      // Deleted event
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_DELETED, {
        gardenId: gardenId3,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      // All three should trigger
      expect(enqueueStub.calledThrice).to.be.true;
    });

    it('should preserve event payload data through the flow', async () => {
      const specificPlotId = uuidv4();

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId: specificPlotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      const jobPayload = enqueueStub.firstCall.args[0];
      expect(jobPayload.gardenId).to.equal(gardenId);
      expect(jobPayload.userId).to.equal(userId);
      // Note: plotId is not passed to the job, only gardenId and userId
    });
  });

  describe('cleanup and shutdown', () => {
    it('should prevent analysis after handler shutdown', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      // Shutdown before debounce expires
      await eventHandler.shutdown();

      // Advance time
      await clock.tickAsync(5000);

      // Should not have triggered
      expect(enqueueStub.called).to.be.false;
    });

    it('should clear all state on shutdown', async () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId,
        plotId: uuidv4(),
        timestamp: new Date(),
      });

      await eventHandler.shutdown();

      const status = eventHandler.getStatus();
      expect(status.pendingDebounces).to.equal(0);
    });
  });
});
