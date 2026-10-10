import { Notification, User } from "../../models";
import { describe, it } from "mocha";
import { testHelper } from "../mocha.setup";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
use(chaiAsPromised);

describe("Notification Model", () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe("Creation", () => {
    it("should create a notification with required fields", async () => {
      const notificationData = {
        user_id: testUser.id,
        message: "Your AI task has completed successfully!",
      };

      const notification = await Notification.create(notificationData);

      expect(notification).to.exist;
      expect(notification.message).to.equal(notificationData.message);
      expect(notification.user_id).to.equal(testUser.id);
      expect(notification.read).to.equal(false);
      expect(notification.type).to.equal("info");
      expect(notification.link).to.be.null;
    });

    it("should create a notification with all fields", async () => {
      const notificationData = {
        user_id: testUser.id,
        message: "Your plant needs water!",
        link: "/plants/123",
        type: "warning" as const,
      };

      const notification = await Notification.create(notificationData);

      expect(notification).to.exist;
      expect(notification.message).to.equal(notificationData.message);
      expect(notification.link).to.equal(notificationData.link);
      expect(notification.type).to.equal(notificationData.type);
      expect(notification.user_id).to.equal(testUser.id);
      expect(notification.read).to.equal(false);
    });

    it("should create a success notification", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Plant added successfully!",
        type: "success",
      });

      expect(notification.type).to.equal("success");
    });

    it("should create an error notification", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Failed to process your request",
        type: "error",
      });

      expect(notification.type).to.equal("error");
    });
  });

  describe("Validation", () => {
    it("should require user_id", async () => {
      const notificationData = {
        message: "Test notification",
      };

      await expect(Notification.create(notificationData)).rejected;
    });

    it("should require message", async () => {
      const notificationData = {
        user_id: testUser.id,
      };

      await expect(Notification.create(notificationData)).rejected;
    });

    it("should reject empty message", async () => {
      const notificationData = {
        user_id: testUser.id,
        message: "",
      };

      await expect(Notification.create(notificationData)).rejected;
    });

    it("should validate message length (max 5000 characters)", async () => {
      const notificationData = {
        user_id: testUser.id,
        message: "a".repeat(5001),
      };

      await expect(Notification.create(notificationData)).rejected;
    });

    it("should validate type enum", async () => {
      const notificationData = {
        user_id: testUser.id,
        message: "Test notification",
        type: "invalid-type" as any,
      };

      await expect(Notification.create(notificationData)).rejected;
    });

    it("should accept valid type values", async () => {
      const types = ["info", "success", "warning", "error"] as const;

      for (const type of types) {
        const notification = await Notification.create({
          user_id: testUser.id,
          message: `Test ${type} notification`,
          type,
        });

        expect(notification.type).to.equal(type);
      }
    });
  });

  describe("Default Values", () => {
    it("should default read to false", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
      });

      expect(notification.read).to.equal(false);
    });

    it("should default type to info", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
      });

      expect(notification.type).to.equal("info");
    });

    it("should auto-generate timestamps", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
      });

      expect(notification.created_at).to.exist;
      expect(notification.updated_at).to.exist;
      expect(notification.created_at).to.be.instanceof(Date);
      expect(notification.updated_at).to.be.instanceof(Date);
    });
  });

  describe("Optional Fields", () => {
    it("should allow null link", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
        link: null,
      });

      expect(notification.link).to.be.null;
    });

    it("should allow undefined link", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
      });

      expect(notification.link).to.be.null;
    });

    it("should accept link value", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
        link: "/dashboard",
      });

      expect(notification.link).to.equal("/dashboard");
    });
  });

  describe("Associations", () => {
    it("should associate with a user", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
      });

      const notificationWithUser = await Notification.findOne({
        where: { id: notification.id },
        include: [{ model: User, as: "user" }],
      });

      expect(notificationWithUser).to.exist;
      expect((notificationWithUser as any)?.user).to.exist;
      expect((notificationWithUser as any)?.user?.id).to.equal(testUser.id);
    });

    it("should not create notification with non-existent user", async () => {
      const notificationData = {
        user_id: "00000000-0000-0000-0000-000000000000",
        message: "Test notification",
      };

      await expect(Notification.create(notificationData)).rejected;
    });

    it("should cascade delete when user is deleted", async () => {
      // Create a truly temporary user (not using testHelper to avoid conflicts)
      const tempUser = await User.create({
        email: "temp-cascade-test@example.com",
        password_hash: "test-password",
        tz: "UTC",
      });

      // Create notification for that user
      const notification = await Notification.create({
        user_id: tempUser.id,
        message: "Test notification",
      });

      expect(notification).to.exist;

      // Delete the user (with hooks to trigger cascade deletes via associations)
      await tempUser.destroy({ hooks: true });

      // Notification should be deleted
      const deletedNotification = await Notification.findByPk(notification.id);
      expect(deletedNotification).to.be.null;
    });
  });

  describe("Updates", () => {
    it("should update notification read status", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
      });

      expect(notification.read).to.equal(false);

      await notification.update({ read: true });

      expect(notification.read).to.equal(true);
    });

    it("should update notification message", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Original message",
      });

      const newMessage = "Updated message";
      await notification.update({ message: newMessage });

      expect(notification.message).to.equal(newMessage);
    });

    it("should update notification type", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
        type: "info",
      });

      await notification.update({ type: "warning" });

      expect(notification.type).to.equal("warning");
    });

    it("should update updated_at timestamp", async () => {
      const notification = await Notification.create({
        user_id: testUser.id,
        message: "Test notification",
      });

      const originalUpdatedAt = notification.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await notification.update({ read: true });

      expect(notification.updated_at.getTime()).to.be.greaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });
});
