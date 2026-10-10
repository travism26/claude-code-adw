import { testHelper } from "../mocha.setup";
import { Notification } from "../../models";
import { expect } from "chai";
import { v4 as uuidv4 } from "uuid";

let authToken: string;
let testUser: any;
let secondAuthToken: string;
let secondTestUser: any;

beforeEach(async () => {
  // Clean up notifications from previous tests
  await Notification.destroy({ where: {}, truncate: true });

  // Create first test user (with unique timestamp-based email)
  testHelper.clearTestUser(); // Clear cached user
  const uniqueEmail = `test-user-${Date.now()}-${Math.random()}@example.com`;
  testUser = await testHelper.createTestUser({ email: uniqueEmail });
  const loginResponse = await testHelper.executeRequest({
    httpMethod: "POST",
    path: "/api/auth/login",
    body: { email: testUser.email, password: "test-password" },
    headers: {},
  });
  authToken = loginResponse.body.accessToken;

  // Create second test user for authorization tests
  testHelper.clearTestUser(); // Clear cached user to create a different user
  const uniqueEmail2 = `test-user-2-${Date.now()}-${Math.random()}@example.com`;
  secondTestUser = await testHelper.createTestUser({ email: uniqueEmail2 });
  const loginResponse2 = await testHelper.executeRequest({
    httpMethod: "POST",
    path: "/api/auth/login",
    body: { email: secondTestUser.email, password: "test-password" },
    headers: {},
  });
  secondAuthToken = loginResponse2.body.accessToken;
});

describe("Create Test Notification API", () => {
  it("should create a test notification with valid data", async () => {
    const notificationData = {
      message: "Test notification message",
      link: "/plants/123",
      type: "info",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/notifications/test",
      body: notificationData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property("notification");
    expect(response.body.notification.message).to.equal(
      notificationData.message
    );
    expect(response.body.notification.link).to.equal(notificationData.link);
    expect(response.body.notification.type).to.equal(notificationData.type);
  });

  it("should create notification with minimal data", async () => {
    const notificationData = {
      message: "Simple notification",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/notifications/test",
      body: notificationData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.notification.message).to.equal(
      notificationData.message
    );
    expect(response.body.notification.type).to.equal("info");
  });

  it("should fail without authentication", async () => {
    const notificationData = {
      message: "Test notification",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/notifications/test",
      body: notificationData,
      headers: { Authorization: "invalid-token" },
    });

    expect(response.statusCode).to.equal(401);
  });

  it("should fail with missing message", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/notifications/test",
      body: {},
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it("should fail with invalid type", async () => {
    const notificationData = {
      message: "Test notification",
      type: "invalid-type",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/notifications/test",
      body: notificationData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });
});

describe("Get Notifications API", () => {
  beforeEach(async () => {
    // Create test notifications
    await Notification.create({
      user_id: testUser.id,
      message: "First notification",
      type: "info",
      read: false,
    });

    await Notification.create({
      user_id: testUser.id,
      message: "Second notification",
      type: "success",
      read: true,
    });

    await Notification.create({
      user_id: testUser.id,
      message: "Third notification",
      link: "/plants/456",
      type: "warning",
      read: false,
    });
  });

  it("should fetch all notifications for authenticated user", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/notifications",
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.notifications).to.be.an("array");
    expect(response.body.notifications.length).to.equal(3);
    expect(response.body.count).to.equal(3);
  });

  it("should fetch only unread notifications", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/notifications?unreadOnly=true",
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.notifications.length).to.equal(2);
    expect(response.body.notifications.every((n: any) => !n.read)).to.be.true;
  });

  it("should respect limit parameter", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/notifications?limit=2",
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.notifications.length).to.equal(2);
  });

  it("should fail without authentication", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/notifications",
      body: null,
      headers: { Authorization: "invalid-token" },
    });

    expect(response.statusCode).to.equal(401);
  });

  it("should return empty array for user with no notifications", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/notifications",
      body: null,
      headers: { Authorization: `Bearer ${secondAuthToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.notifications).to.be.an("array");
    expect(response.body.notifications.length).to.equal(0);
  });
});

describe("Get Single Notification API", () => {
  let notification: Notification;

  beforeEach(async () => {
    notification = await Notification.create({
      user_id: testUser.id,
      message: "Single notification test",
      type: "info",
    });
  });

  it("should fetch a single notification by ID", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/notifications/${notification.id}`,
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.notification.id).to.equal(notification.id);
    expect(response.body.notification.message).to.equal(notification.message);
  });

  it("should return 404 for non-existent notification", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/notifications/${uuidv4()}`,
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it("should prevent access to other users notifications", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/notifications/${notification.id}`,
      body: null,
      headers: { Authorization: `Bearer ${secondAuthToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it("should fail with invalid notification ID", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/notifications/invalid-id",
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });
});

describe("Mark Notification as Read API", () => {
  let notification: Notification;

  beforeEach(async () => {
    notification = await Notification.create({
      user_id: testUser.id,
      message: "Unread notification",
      read: false,
    });
  });

  it("should mark notification as read", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "PATCH",
      path: `/api/notifications/${notification.id}/read`,
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    // Verify notification is marked as read
    const updatedNotification = await Notification.findByPk(notification.id);
    expect(updatedNotification?.read).to.be.true;
  });

  it("should return 404 for non-existent notification", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "PATCH",
      path: `/api/notifications/${uuidv4()}/read`,
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it("should prevent marking other users notifications as read", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "PATCH",
      path: `/api/notifications/${notification.id}/read`,
      body: null,
      headers: { Authorization: `Bearer ${secondAuthToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe("Mark All Notifications as Read API", () => {
  beforeEach(async () => {
    // Create multiple unread notifications
    await Notification.create({
      user_id: testUser.id,
      message: "Notification 1",
      read: false,
    });

    await Notification.create({
      user_id: testUser.id,
      message: "Notification 2",
      read: false,
    });

    await Notification.create({
      user_id: testUser.id,
      message: "Notification 3",
      read: false,
    });
  });

  it("should mark all notifications as read", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "PATCH",
      path: "/api/notifications/mark-all-read",
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.count).to.equal(3);

    // Verify all notifications are marked as read
    const notifications = await Notification.findAll({
      where: { user_id: testUser.id },
    });
    expect(notifications.every((n) => n.read)).to.be.true;
  });
});

describe("Get Unread Count API", () => {
  beforeEach(async () => {
    // Create mix of read and unread notifications
    await Notification.create({
      user_id: testUser.id,
      message: "Unread 1",
      read: false,
    });

    await Notification.create({
      user_id: testUser.id,
      message: "Unread 2",
      read: false,
    });

    await Notification.create({
      user_id: testUser.id,
      message: "Read 1",
      read: true,
    });
  });

  it("should return correct unread count", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: "/api/notifications/unread-count",
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.count).to.equal(2);
  });
});

describe("Delete Notification API", () => {
  let notification: Notification;

  beforeEach(async () => {
    notification = await Notification.create({
      user_id: testUser.id,
      message: "Notification to delete",
    });
  });

  it("should delete a notification", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "DELETE",
      path: `/api/notifications/${notification.id}`,
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    // Verify notification is deleted
    const deletedNotification = await Notification.findByPk(notification.id);
    expect(deletedNotification).to.be.null;
  });

  it("should return 404 for non-existent notification", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "DELETE",
      path: `/api/notifications/${uuidv4()}`,
      body: null,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it("should prevent deleting other users notifications", async () => {
    const response = await testHelper.executeRequest({
      httpMethod: "DELETE",
      path: `/api/notifications/${notification.id}`,
      body: null,
      headers: { Authorization: `Bearer ${secondAuthToken}` },
    });

    expect(response.statusCode).to.equal(404);

    // Verify notification is not deleted
    const existingNotification = await Notification.findByPk(notification.id);
    expect(existingNotification).to.not.be.null;
  });
});
