import { MessageBus, MessageBusEvent } from "../../services/messageBus";
import type {
  AIResultReadyPayload,
  AITaskFailedPayload,
  AITaskStartedPayload,
} from "../../services/messageBus";
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";

describe("MessageBus", () => {
  beforeEach(() => {
    // Reset singleton before each test
    MessageBus.resetInstance();
  });

  afterEach(() => {
    // Clean up after each test
    MessageBus.resetInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = MessageBus.getInstance();
      const instance2 = MessageBus.getInstance();
      expect(instance1).to.equal(instance2);
    });

    it("should maintain singleton even after getting instance", () => {
      const instance1 = MessageBus.getInstance();
      const instance2 = MessageBus.getInstance();
      const instance3 = MessageBus.getInstance();
      expect(instance1).to.equal(instance2);
      expect(instance2).to.equal(instance3);
    });
  });

  describe("Event Publishing and Subscription", () => {
    it("should publish and receive AI_RESULT_READY event", (done) => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        plantId: "plant-789",
        suggestion: {
          type: "care",
          content: "Water your tomato plant",
          confidence: 0.95,
          actionItems: ["Water now", "Check soil moisture"],
        },
        timestamp: new Date(),
      };

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, (received) => {
        expect(received).to.deep.equal(payload);
        done();
      });

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
    });

    it("should publish and receive AI_TASK_FAILED event", (done) => {
      const bus = MessageBus.getInstance();
      const payload: AITaskFailedPayload = {
        taskId: "task-123",
        userId: "user-456",
        error: "API rate limit exceeded",
        timestamp: new Date(),
      };

      bus.subscribe(MessageBusEvent.AI_TASK_FAILED, (received) => {
        expect(received).to.deep.equal(payload);
        done();
      });

      bus.publish(MessageBusEvent.AI_TASK_FAILED, payload);
    });

    it("should publish and receive AI_TASK_STARTED event", (done) => {
      const bus = MessageBus.getInstance();
      const payload: AITaskStartedPayload = {
        taskId: "task-123",
        userId: "user-456",
        timestamp: new Date(),
      };

      bus.subscribe(MessageBusEvent.AI_TASK_STARTED, (received) => {
        expect(received).to.deep.equal(payload);
        done();
      });

      bus.publish(MessageBusEvent.AI_TASK_STARTED, payload);
    });

    it("should support multiple subscribers for the same event", (done) => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      let callCount = 0;
      const expectedCalls = 3;

      const handler = () => {
        callCount++;
        if (callCount === expectedCalls) {
          done();
        }
      };

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, handler);
      bus.subscribe(MessageBusEvent.AI_RESULT_READY, handler);
      bus.subscribe(MessageBusEvent.AI_RESULT_READY, handler);

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
    });

    it("should support async handlers", async () => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      let handlerCalled = false;

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, async (received) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        handlerCalled = true;
        expect(received).to.deep.equal(payload);
      });

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);

      // Wait for async handler to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(handlerCalled).to.equal(true);
    });
  });

  describe("Unsubscribe Functionality", () => {
    it("should unsubscribe a handler using returned function", () => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      let callCount = 0;
      const handler = () => {
        callCount++;
      };

      const unsubscribe = bus.subscribe(
        MessageBusEvent.AI_RESULT_READY,
        handler
      );

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
      expect(callCount).to.equal(1);

      unsubscribe();

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
      expect(callCount).to.equal(1); // Should not increment
    });

    it("should only unsubscribe the specific handler", () => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      let handler1Calls = 0;
      let handler2Calls = 0;

      const handler1 = () => {
        handler1Calls++;
      };
      const handler2 = () => {
        handler2Calls++;
      };

      const unsubscribe1 = bus.subscribe(
        MessageBusEvent.AI_RESULT_READY,
        handler1
      );
      bus.subscribe(MessageBusEvent.AI_RESULT_READY, handler2);

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
      expect(handler1Calls).to.equal(1);
      expect(handler2Calls).to.equal(1);

      unsubscribe1();

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
      expect(handler1Calls).to.equal(1); // Should not increment
      expect(handler2Calls).to.equal(2); // Should increment
    });
  });

  describe("One-time Subscription", () => {
    it("should only call handler once with subscribeOnce", () => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      let callCount = 0;
      const handler = () => {
        callCount++;
      };

      bus.subscribeOnce(MessageBusEvent.AI_RESULT_READY, handler);

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
      expect(callCount).to.equal(1);

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
      expect(callCount).to.equal(1); // Should not increment
    });
  });

  describe("Listener Count", () => {
    it("should return correct listener count", () => {
      const bus = MessageBus.getInstance();

      expect(bus.getListenerCount(MessageBusEvent.AI_RESULT_READY)).to.equal(0);

      const handler = () => {
        // Empty handler for testing
      };
      bus.subscribe(MessageBusEvent.AI_RESULT_READY, handler);

      expect(bus.getListenerCount(MessageBusEvent.AI_RESULT_READY)).to.equal(1);

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, handler);

      expect(bus.getListenerCount(MessageBusEvent.AI_RESULT_READY)).to.equal(2);
    });
  });

  describe("Clear Functionality", () => {
    it("should clear all listeners for a specific event", () => {
      const bus = MessageBus.getInstance();

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, () => {
        // Empty handler for testing
      });
      bus.subscribe(MessageBusEvent.AI_RESULT_READY, () => {
        // Empty handler for testing
      });
      bus.subscribe(MessageBusEvent.AI_TASK_FAILED, () => {
        // Empty handler for testing
      });

      expect(bus.getListenerCount(MessageBusEvent.AI_RESULT_READY)).to.equal(2);
      expect(bus.getListenerCount(MessageBusEvent.AI_TASK_FAILED)).to.equal(1);

      bus.clear(MessageBusEvent.AI_RESULT_READY);

      expect(bus.getListenerCount(MessageBusEvent.AI_RESULT_READY)).to.equal(0);
      expect(bus.getListenerCount(MessageBusEvent.AI_TASK_FAILED)).to.equal(1);
    });

    it("should clear all listeners when no event specified", () => {
      const bus = MessageBus.getInstance();

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, () => {
        // Empty handler for testing
      });
      bus.subscribe(MessageBusEvent.AI_TASK_FAILED, () => {
        // Empty handler for testing
      });
      bus.subscribe(MessageBusEvent.AI_TASK_STARTED, () => {
        // Empty handler for testing
      });

      expect(bus.getListenerCount(MessageBusEvent.AI_RESULT_READY)).to.equal(1);
      expect(bus.getListenerCount(MessageBusEvent.AI_TASK_FAILED)).to.equal(1);
      expect(bus.getListenerCount(MessageBusEvent.AI_TASK_STARTED)).to.equal(1);

      bus.clear();

      expect(bus.getListenerCount(MessageBusEvent.AI_RESULT_READY)).to.equal(0);
      expect(bus.getListenerCount(MessageBusEvent.AI_TASK_FAILED)).to.equal(0);
      expect(bus.getListenerCount(MessageBusEvent.AI_TASK_STARTED)).to.equal(0);
    });
  });

  describe("Error Handling", () => {
    it("should not throw when handler throws error", () => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      const errorHandler = () => {
        throw new Error("Handler error");
      };

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, errorHandler);

      expect(() => {
        bus.publish(MessageBusEvent.AI_RESULT_READY, payload);
      }).to.not.throw();
    });

    it("should continue calling other handlers if one throws", (done) => {
      const bus = MessageBus.getInstance();
      const payload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      let secondHandlerCalled = false;

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, () => {
        throw new Error("First handler error");
      });

      bus.subscribe(MessageBusEvent.AI_RESULT_READY, () => {
        secondHandlerCalled = true;
      });

      bus.publish(MessageBusEvent.AI_RESULT_READY, payload);

      // Wait for async error handling
      setTimeout(() => {
        expect(secondHandlerCalled).to.equal(true);
        done();
      }, 50);
    });
  });

  describe("Type Safety", () => {
    it("should enforce correct payload types at compile time", () => {
      const bus = MessageBus.getInstance();

      // This should compile without errors
      const validPayload: AIResultReadyPayload = {
        taskId: "task-123",
        userId: "user-456",
        suggestion: {
          type: "care",
          content: "Water your plant",
        },
        timestamp: new Date(),
      };

      bus.publish(MessageBusEvent.AI_RESULT_READY, validPayload);

      // TypeScript should ensure handlers receive correct types
      bus.subscribe(MessageBusEvent.AI_RESULT_READY, (payload) => {
        // payload should be typed as AIResultReadyPayload
        expect(payload.taskId).to.exist;
        expect(payload.userId).to.exist;
        expect(payload.suggestion).to.exist;
      });
    });
  });
});
