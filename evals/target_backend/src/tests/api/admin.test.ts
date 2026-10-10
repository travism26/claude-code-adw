import { testHelper } from "../mocha.setup";
import { User, Notification } from "../../models";
import { expect } from "chai";
import { v4 as uuidv4 } from "uuid";

let testUser: any;
let secondTestUser: any;

beforeEach(async () => {
  // Clean up notifications and create fresh test users
  await Notification.destroy({ where: {}, truncate: true });

  // Create first test user
  testHelper.clearTestUser();
  const uniqueEmail = `admin-test-user-${Date.now()}-${Math.random()}@example.com`;
  testUser = await testHelper.createTestUser({
    email: uniqueEmail,
    growing_zone: '7a',
    postal_code: '12345'
  });

  // Create second test user
  testHelper.clearTestUser();
  const uniqueEmail2 = `admin-test-user-2-${Date.now()}-${Math.random()}@example.com`;
  secondTestUser = await testHelper.createTestUser({
    email: uniqueEmail2,
    growing_zone: '8b',
    postal_code: '67890'
  });
});

describe("Admin API - User Management", () => {
  describe("GET /api/admin/users", () => {
    it("should fetch all users with pagination", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/users",
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.property("users");
      expect(response.body).to.have.property("pagination");
      expect(response.body.users).to.be.an("array");
      expect(response.body.users.length).to.be.at.least(2);
      expect(response.body.pagination).to.have.property("total");
      expect(response.body.pagination).to.have.property("page");
      expect(response.body.pagination).to.have.property("limit");
    });

    it("should support pagination parameters", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/users?page=1&limit=1",
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.users).to.have.lengthOf(1);
      expect(response.body.pagination.limit).to.equal(1);
    });

    it("should support search by email", async () => {
      const searchEmail = testUser.email.substring(0, 10);
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: `/api/admin/users?search=${searchEmail}`,
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.users).to.be.an("array");
      const foundUser = response.body.users.find((u: any) => u.id === testUser.id);
      expect(foundUser).to.exist;
    });

    it("should validate pagination parameters", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/users?page=0",
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe("GET /api/admin/users/:id", () => {
    it("should fetch a single user by ID", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: `/api/admin/users/${testUser.id}`,
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.property("user");
      expect(response.body.user.id).to.equal(testUser.id);
      expect(response.body.user.email).to.equal(testUser.email);
      expect(response.body.user.growing_zone).to.equal(testUser.growing_zone);
    });

    it("should return 404 for non-existent user", async () => {
      const fakeUserId = uuidv4();
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: `/api/admin/users/${fakeUserId}`,
        headers: {},
      });

      expect(response.statusCode).to.equal(404);
    });

    it("should validate user ID format", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/users/invalid-uuid",
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe("PUT /api/admin/users/:id", () => {
    it("should update user email", async () => {
      const newEmail = `updated-${Date.now()}@example.com`;
      const response = await testHelper.executeRequest({
        httpMethod: "PUT",
        path: `/api/admin/users/${testUser.id}`,
        body: { email: newEmail },
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.user.email).to.equal(newEmail);

      // Verify update persisted
      const updatedUser = await User.findByPk(testUser.id);
      expect(updatedUser?.email).to.equal(newEmail);
    });

    it("should update user growing zone", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "PUT",
        path: `/api/admin/users/${testUser.id}`,
        body: { growing_zone: "9a" },
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.user.growing_zone).to.equal("9a");
    });

    it("should update user postal code", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "PUT",
        path: `/api/admin/users/${testUser.id}`,
        body: { postal_code: "54321" },
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.user.postal_code).to.equal("54321");
    });

    it("should update multiple fields at once", async () => {
      const newEmail = `multi-update-${Date.now()}@example.com`;
      const response = await testHelper.executeRequest({
        httpMethod: "PUT",
        path: `/api/admin/users/${testUser.id}`,
        body: {
          email: newEmail,
          growing_zone: "10b",
          postal_code: "99999",
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.user.email).to.equal(newEmail);
      expect(response.body.user.growing_zone).to.equal("10b");
      expect(response.body.user.postal_code).to.equal("99999");
    });

    it("should reject invalid email format", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "PUT",
        path: `/api/admin/users/${testUser.id}`,
        body: { email: "invalid-email" },
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });

    it("should reject invalid growing zone format", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "PUT",
        path: `/api/admin/users/${testUser.id}`,
        body: { growing_zone: "invalid" },
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });

    it("should return 404 for non-existent user", async () => {
      const fakeUserId = uuidv4();
      const response = await testHelper.executeRequest({
        httpMethod: "PUT",
        path: `/api/admin/users/${fakeUserId}`,
        body: { email: "test@example.com" },
        headers: {},
      });

      expect(response.statusCode).to.equal(404);
    });
  });
});

describe("Admin API - Notification Testing", () => {
  describe("POST /api/admin/notifications/send-to-user", () => {
    it("should send notification to specific user", async () => {
      const notificationData = {
        userId: testUser.id,
        message: "Test notification from admin",
        link: "/test-link",
        type: "info",
      };

      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-user",
        body: notificationData,
        headers: {},
      });

      expect(response.statusCode).to.equal(201);
      expect(response.body).to.have.property("notification");
      expect(response.body.notification.message).to.equal(notificationData.message);
      expect(response.body.notification.user_id).to.equal(testUser.id);

      // Verify notification was created
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });
      expect(notifications).to.have.lengthOf(1);
    });

    it("should send notification with different types", async () => {
      const types = ["info", "success", "warning", "error"];

      for (const type of types) {
        const response = await testHelper.executeRequest({
          httpMethod: "POST",
          path: "/api/admin/notifications/send-to-user",
          body: {
            userId: testUser.id,
            message: `Test ${type} notification`,
            type: type,
          },
          headers: {},
        });

        expect(response.statusCode).to.equal(201);
        expect(response.body.notification.type).to.equal(type);
      }
    });

    it("should send notification without link", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-user",
        body: {
          userId: testUser.id,
          message: "Notification without link",
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(201);
      expect(response.body.notification.link).to.be.null;
    });

    it("should fail with invalid user ID", async () => {
      const fakeUserId = uuidv4();
      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-user",
        body: {
          userId: fakeUserId,
          message: "Test notification",
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(404);
    });

    it("should validate message is required", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-user",
        body: {
          userId: testUser.id,
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });

    it("should validate message length", async () => {
      const longMessage = "a".repeat(5001);
      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-user",
        body: {
          userId: testUser.id,
          message: longMessage,
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });

    it("should validate notification type", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-user",
        body: {
          userId: testUser.id,
          message: "Test notification",
          type: "invalid-type",
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe("POST /api/admin/notifications/send-to-all", () => {
    it("should send notification to all users", async () => {
      const notificationData = {
        message: "Broadcast message to all users",
        link: "/announcement",
        type: "info",
      };

      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-all",
        body: notificationData,
        headers: {},
      });

      expect(response.statusCode).to.equal(201);
      expect(response.body.count).to.be.at.least(2);
      expect(response.body.total).to.be.at.least(2);
      expect(response.body.errors).to.be.an("array");

      // Verify all users received notification
      const user1Notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });
      const user2Notifications = await Notification.findAll({
        where: { user_id: secondTestUser.id },
      });

      expect(user1Notifications).to.have.lengthOf(1);
      expect(user2Notifications).to.have.lengthOf(1);
      expect(user1Notifications[0].message).to.equal(notificationData.message);
      expect(user2Notifications[0].message).to.equal(notificationData.message);
    });

    it("should handle empty user list", async () => {
      // Clean up notifications first to avoid foreign key constraint
      await Notification.destroy({ where: {}, truncate: true });
      // Delete all users
      await User.destroy({ where: {}, force: true });

      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-all",
        body: {
          message: "Test message",
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.count).to.equal(0);
    });

    it("should validate message is required", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-all",
        body: {},
        headers: {},
      });

      expect(response.statusCode).to.equal(400);
    });

    it("should send notification with success type", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "POST",
        path: "/api/admin/notifications/send-to-all",
        body: {
          message: "Success notification",
          type: "success",
        },
        headers: {},
      });

      expect(response.statusCode).to.equal(201);

      // Verify type was set correctly
      const notifications = await Notification.findAll({
        where: { user_id: testUser.id },
      });
      expect(notifications[0].type).to.equal("success");
    });
  });
});

describe("Admin API - Statistics", () => {
  describe("GET /api/admin/stats", () => {
    it("should return user statistics", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/stats",
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.property("totalUsers");
      expect(response.body).to.have.property("usersByZone");
      expect(response.body).to.have.property("recentSignups");
      expect(response.body).to.have.property("usersWithoutZone");
      expect(response.body.totalUsers).to.be.at.least(2);
      expect(response.body.usersByZone).to.be.an("array");
    });

    it("should include users by zone breakdown", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/stats",
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.usersByZone).to.be.an("array");

      // Should have zones from test users
      const zones = response.body.usersByZone.map((item: any) => item.zone);
      expect(zones).to.include.members(['7a', '8b']);
    });

    it("should include recent signup counts", async () => {
      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/stats",
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.recentSignups).to.have.property("last7Days");
      expect(response.body.recentSignups).to.have.property("last30Days");
      expect(response.body.recentSignups.last7Days).to.be.at.least(2);
      expect(response.body.recentSignups.last30Days).to.be.at.least(2);
    });

    it("should count users without zone", async () => {
      // Create user without zone
      testHelper.clearTestUser();
      const uniqueEmail = `no-zone-${Date.now()}@example.com`;
      await testHelper.createTestUser({
        email: uniqueEmail,
        growing_zone: null,
      });

      const response = await testHelper.executeRequest({
        httpMethod: "GET",
        path: "/api/admin/stats",
        headers: {},
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.usersWithoutZone).to.be.at.least(1);
    });
  });
});

describe("Admin API - Edge Cases", () => {
  it("should handle very long notification message (at limit)", async () => {
    const maxMessage = "a".repeat(5000);
    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/admin/notifications/send-to-user",
      body: {
        userId: testUser.id,
        message: maxMessage,
      },
      headers: {},
    });

    expect(response.statusCode).to.equal(201);
  });

  it("should handle special characters in notification message", async () => {
    const specialMessage = "Test with émojis 🌱🌿 and spëcial çharacters!";
    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/admin/notifications/send-to-user",
      body: {
        userId: testUser.id,
        message: specialMessage,
      },
      headers: {},
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.notification.message).to.equal(specialMessage);
  });

  it("should handle updating user with existing email", async () => {
    // Try to update second user with first user's email
    const response = await testHelper.executeRequest({
      httpMethod: "PUT",
      path: `/api/admin/users/${secondTestUser.id}`,
      body: { email: testUser.email },
      headers: {},
    });

    // Should fail due to unique constraint
    expect(response.statusCode).to.equal(409);
    expect(response.body).to.have.property("error");
    expect(response.body.error).to.match(/email.*already exists/i);
  });
});
