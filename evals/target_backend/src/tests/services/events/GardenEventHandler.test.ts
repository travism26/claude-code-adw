/**
 * GardenEventHandler Tests
 *
 * Tests the event-driven garden analysis with debouncing:
 * - Event subscription
 * - Debounce timer logic
 * - Queue job enqueueing
 * - In-flight analysis tracking
 * - Multiple garden handling
 * - Shutdown and cleanup
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { GardenEventHandler } from '../../../services/events/GardenEventHandler';
import {
  messageBus,
  MessageBusEvent,
} from '../../../services/messageBus';
import * as aiTasksQueue from '../../../services/queue/queues/aiTasks.queue';
import { v4 as uuidv4 } from 'uuid';

describe('GardenEventHandler', () => {
  let handler: GardenEventHandler;
  let clock: sinon.SinonFakeTimers;
  let enqueueStub: sinon.SinonStub;

  const userId = uuidv4();
  const gardenId = uuidv4();
  const plotId = uuidv4();

  beforeEach(() => {
    // Use fake timers to control debouncing
    clock = sinon.useFakeTimers();

    // Stub queue function
    enqueueStub = sinon.stub(aiTasksQueue, 'queueGardenAnalysisJob');

    // Make enqueue return a mock job
    enqueueStub.resolves({ id: uuidv4() });

    handler = new GardenEventHandler();
    handler.initialize();
  });

  afterEach(async () => {
    await handler.shutdown();
    clock.restore();
    sinon.restore();
  });

  describe('initialize()', () => {
    it('should subscribe to GARDEN_PLOT_CREATED event', () => {
      const subscribeSpy = sinon.spy(messageBus, 'subscribe');
      const newHandler = new GardenEventHandler();
      newHandler.initialize();

      expect(
        subscribeSpy.calledWith(
          MessageBusEvent.GARDEN_PLOT_CREATED,
          sinon.match.func
        )
      ).to.be.true;

      newHandler.shutdown();
      subscribeSpy.restore();
    });

    it('should subscribe to GARDEN_PLOT_UPDATED event', () => {
      const subscribeSpy = sinon.spy(messageBus, 'subscribe');
      const newHandler = new GardenEventHandler();
      newHandler.initialize();

      expect(
        subscribeSpy.calledWith(
          MessageBusEvent.GARDEN_PLOT_UPDATED,
          sinon.match.func
        )
      ).to.be.true;

      newHandler.shutdown();
      subscribeSpy.restore();
    });

    it('should subscribe to GARDEN_PLOT_DELETED event', () => {
      const subscribeSpy = sinon.spy(messageBus, 'subscribe');
      const newHandler = new GardenEventHandler();
      newHandler.initialize();

      expect(
        subscribeSpy.calledWith(
          MessageBusEvent.GARDEN_PLOT_DELETED,
          sinon.match.func
        )
      ).to.be.true;

      newHandler.shutdown();
      subscribeSpy.restore();
    });
  });

  describe('event handling and debouncing', () => {
    it('should set debounce timer on first plot created event', () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      const status = handler.getStatus();
      expect(status.pendingDebounces).to.equal(1);
    });

    it('should trigger analysis after debounce delay', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      // Advance time by 5 seconds (debounce delay)
      await clock.tickAsync(5000);

      expect(enqueueStub.calledOnce).to.be.true;
      expect(enqueueStub.firstCall.args[0]).to.deep.include({
        gardenId,
        userId,
        triggeredBy: 'garden_plot_change',
      });
    });

    it('should reset debounce timer on subsequent events', async () => {
      // First event
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId: plotId,
        timestamp: new Date(),
      });

      // Advance 3 seconds
      await clock.tickAsync(3000);

      // Second event before debounce expires
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId: plotId,
        timestamp: new Date(),
      });

      // Advance 3 more seconds (total 6, but timer was reset at 3)
      await clock.tickAsync(3000);

      // Should not have triggered yet (only 3 seconds since last event)
      expect(enqueueStub.called).to.be.false;

      // Advance 2 more seconds to reach 5 seconds from last event
      await clock.tickAsync(2000);

      // Now should have triggered
      expect(enqueueStub.calledOnce).to.be.true;
    });

    it('should handle GARDEN_PLOT_UPDATED events', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      expect(enqueueStub.calledOnce).to.be.true;
    });

    it('should handle GARDEN_PLOT_DELETED events', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_DELETED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      expect(enqueueStub.calledOnce).to.be.true;
    });

    it('should batch multiple rapid events into single analysis', async () => {
      // Rapidly fire 5 events
      for (let i = 0; i < 5; i++) {
        messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
          gardenId,
          userId,
          plotId: uuidv4(),
          timestamp: new Date(),
        });
        await clock.tickAsync(500); // 500ms between events
      }

      // Total time: 2.5 seconds, debounce should keep resetting

      // Advance to complete the debounce (5 seconds from last event)
      await clock.tickAsync(5000);

      // Should only trigger once
      expect(enqueueStub.calledOnce).to.be.true;
    });
  });

  describe('multiple gardens handling', () => {
    it('should handle independent debounce timers for different gardens', async () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();

      // Event for garden 1
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId,
        timestamp: new Date(),
      });

      // Advance 2 seconds
      await clock.tickAsync(2000);

      // Event for garden 2
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId,
        plotId,
        timestamp: new Date(),
      });

      const status = handler.getStatus();
      expect(status.pendingDebounces).to.equal(2);

      // Advance 3 more seconds (total 5 from garden 1 event)
      await clock.tickAsync(3000);

      // Garden 1 should have triggered
      expect(enqueueStub.calledOnce).to.be.true;
      expect(enqueueStub.firstCall.args[0].gardenId).to.equal(gardenId1);

      // Advance 2 more seconds (total 5 from garden 2 event)
      await clock.tickAsync(2000);

      // Garden 2 should have triggered
      expect(enqueueStub.calledTwice).to.be.true;
      expect(enqueueStub.secondCall.args[0].gardenId).to.equal(gardenId2);
    });

    it('should not interfere between different gardens', async () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();

      // Multiple events for garden 1
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(1000);
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId: gardenId1,
        userId,
        plotId,
        timestamp: new Date(),
      });

      // Single event for garden 2
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId,
        plotId,
        timestamp: new Date(),
      });

      // Advance 5 seconds
      await clock.tickAsync(5000);

      // Garden 2 should trigger first (last event was 5 seconds ago)
      expect(enqueueStub.calledOnce).to.be.true;
      expect(enqueueStub.firstCall.args[0].gardenId).to.equal(gardenId2);

      // Advance 1 more second (total 6 from last garden 1 event)
      await clock.tickAsync(1000);

      // Garden 1 should trigger now
      expect(enqueueStub.calledTwice).to.be.true;
      expect(enqueueStub.secondCall.args[0].gardenId).to.equal(gardenId1);
    });
  });

  describe('in-flight analysis tracking', () => {
    it('should mark garden as in-flight when analysis is triggered', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      const status = handler.getStatus();
      expect(status.inFlightAnalysis).to.equal(1);
    });

    it('should prevent duplicate analysis for same garden', async () => {
      // First event triggers analysis
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      expect(enqueueStub.calledOnce).to.be.true;

      // New event while analysis is in-flight
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      // Should not enqueue again (still in-flight)
      expect(enqueueStub.calledOnce).to.be.true;
    });

    it('should clear in-flight tracking after timeout', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      expect(handler.getStatus().inFlightAnalysis).to.equal(1);

      // Advance 5 minutes (cleanup timeout)
      await clock.tickAsync(5 * 60 * 1000);

      expect(handler.getStatus().inFlightAnalysis).to.equal(0);
    });

    it('should allow new analysis after in-flight cleanup', async () => {
      // First analysis
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      expect(enqueueStub.calledOnce).to.be.true;

      // Wait for cleanup timeout
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

  describe('getStatus()', () => {
    it('should return correct pending debounces count', () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();
      const gardenId3 = uuidv4();

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId,
        timestamp: new Date(),
      });
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId,
        plotId,
        timestamp: new Date(),
      });
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId3,
        userId,
        plotId,
        timestamp: new Date(),
      });

      const status = handler.getStatus();
      expect(status.pendingDebounces).to.equal(3);
    });

    it('should return correct in-flight analysis count', async () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId,
        plotId,
        timestamp: new Date(),
      });
      await clock.tickAsync(5000);

      const status = handler.getStatus();
      expect(status.inFlightAnalysis).to.equal(2);
    });

    it('should show zero counts initially', () => {
      const newHandler = new GardenEventHandler();
      newHandler.initialize();

      const status = newHandler.getStatus();
      expect(status.pendingDebounces).to.equal(0);
      expect(status.inFlightAnalysis).to.equal(0);

      newHandler.shutdown();
    });
  });

  describe('shutdown()', () => {
    it('should clear all pending debounce timers', async () => {
      const gardenId1 = uuidv4();
      const gardenId2 = uuidv4();

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId1,
        userId,
        plotId,
        timestamp: new Date(),
      });
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId: gardenId2,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await handler.shutdown();

      // Advance time
      await clock.tickAsync(5000);

      // Should not trigger analysis after shutdown
      expect(enqueueStub.called).to.be.false;
    });

    it('should unsubscribe from all events', async () => {
      const unsubscribeSpy = sinon.spy();
      sinon.stub(messageBus, 'subscribe').returns(unsubscribeSpy);

      const newHandler = new GardenEventHandler();
      newHandler.initialize();
      await newHandler.shutdown();

      // Should call unsubscribe functions (3 events subscribed)
      expect(unsubscribeSpy.callCount).to.equal(3);

      sinon.restore();
    });

    it('should complete shutdown without errors', async () => {
      // Just verify shutdown doesn't throw
      await handler.shutdown();
      // Queue is managed globally now, so no close stub needed
    });

    it('should leave no pending debounces after shutdown', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await handler.shutdown();

      const status = handler.getStatus();
      expect(status.pendingDebounces).to.equal(0);
    });
  });

  describe('error handling', () => {
    it('should handle enqueue failures gracefully', async () => {
      enqueueStub.rejects(new Error('Queue connection failed'));

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      // Should not throw
      await clock.tickAsync(5000);

      // In-flight should be cleared on error
      const status = handler.getStatus();
      expect(status.inFlightAnalysis).to.equal(0);
    });

    it('should clear in-flight flag on enqueue error', async () => {
      enqueueStub.rejects(new Error('Queue error'));

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      // Should allow retry after error
      enqueueStub.resolves({ id: uuidv4() });

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_UPDATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      // Second attempt should succeed
      expect(enqueueStub.calledTwice).to.be.true;
    });
  });

  describe('job payload structure', () => {
    it('should include all required fields in job payload', async () => {
      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      const payload = enqueueStub.firstCall.args[0];
      expect(payload).to.have.property('gardenId');
      expect(payload).to.have.property('userId');
      expect(payload).to.have.property('triggeredBy');
      expect(payload).to.have.property('timestamp');

      expect(payload.gardenId).to.equal(gardenId);
      expect(payload.userId).to.equal(userId);
      expect(payload.triggeredBy).to.equal('garden_plot_change');
    });

    it('should include current timestamp in payload', async () => {
      const beforeTime = new Date().toISOString();

      messageBus.publish(MessageBusEvent.GARDEN_PLOT_CREATED, {
        gardenId,
        userId,
        plotId,
        timestamp: new Date(),
      });

      await clock.tickAsync(5000);

      const payload = enqueueStub.firstCall.args[0];
      const payloadTime = new Date(payload.timestamp);
      const afterTime = new Date();

      expect(payloadTime.getTime()).to.be.at.least(
        new Date(beforeTime).getTime()
      );
      expect(payloadTime.getTime()).to.be.at.most(afterTime.getTime() + 1000);
    });
  });
});
