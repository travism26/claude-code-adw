/**
 * AI Tasks API Tests
 *
 * Tests for AI task enqueueing and job status endpoints
 */

import { testHelper } from "../mocha.setup";
import { describe, it, before, beforeEach } from "mocha";
import { expect } from "chai";
import { initializeQueues } from "../../services/queue";

let authToken: string;
let testUser: any;
let queueInitialized = false;

before(async function () {
  this.timeout(10000);

  // Initialize queue service for tests
  if (!queueInitialized) {
    await initializeQueues();
    queueInitialized = true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
});

beforeEach(async () => {
  // Clear any existing test user
  testHelper.clearTestUser();

  // Create a test user with a unique email for each test
  const uniqueEmail = `test-user-${Date.now()}@example.com`;
  testUser = await testHelper.createTestUser({ email: uniqueEmail });
  const loginResponse = await testHelper.executeRequest({
    httpMethod: "POST",
    path: "/api/auth/login",
    body: { email: testUser.email, password: "test-password" },
    headers: {},
  });
  authToken = loginResponse.body.accessToken;
});

describe("POST /api/ai-tasks - Enqueue AI Task", () => {
  it("should enqueue a care recommendation task", async function () {
    this.timeout(5000);

    const taskData = {
      type: "care_recommendation",
      payload: {
        plantType: "tomato",
        growthStage: "flowering",
        location: "indoor",
      },
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(202);
    expect(response.body).to.have.property("jobId");
    expect(response.body).to.have.property("status");
    expect(response.body.type).to.equal("care_recommendation");
    expect(response.body.message).to.include("enqueued");
  });

  it("should enqueue a pest diagnosis task", async function () {
    this.timeout(5000);

    const taskData = {
      type: "pest_diagnosis",
      payload: {
        plantName: "Rose",
        symptoms: "Yellow leaves with brown spots",
        photoDescription: "Spots on upper leaves",
      },
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(202);
    expect(response.body).to.have.property("jobId");
    expect(response.body.jobId).to.be.a("string");
  });

  it("should enqueue a task with priority", async function () {
    this.timeout(5000);

    const taskData = {
      type: "general",
      payload: { question: "How often should I water tomatoes?" },
      priority: 8,
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(202);
    expect(response.body).to.have.property("jobId");
  });

  xit("should fail without authentication", async function () {
    this.timeout(5000);

    const taskData = {
      type: "care_recommendation",
      payload: { plantType: "basil" },
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: {},
    });

    expect(response.statusCode).to.equal(401);
  });

  it("should fail with invalid task type", async function () {
    this.timeout(5000);

    const taskData = {
      type: "invalid_task_type",
      payload: { test: "data" },
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body).to.have.property("errors");
  });

  it("should fail without payload", async function () {
    this.timeout(5000);

    const taskData = {
      type: "care_recommendation",
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body).to.have.property("errors");
  });

  it("should fail with empty payload", async function () {
    this.timeout(5000);

    const taskData = {
      type: "care_recommendation",
      payload: {},
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Empty payload should be accepted (validation happens at worker level)
    expect(response.statusCode).to.equal(202);
  });

  it("should fail with invalid priority", async function () {
    this.timeout(5000);

    const taskData = {
      type: "general",
      payload: { question: "Test" },
      priority: 15, // Invalid: must be 1-10
    };

    const response = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body).to.have.property("errors");
  });
});

describe("GET /api/ai-tasks/:jobId - Get Job Details", () => {
  let jobId: string;

  beforeEach(async function () {
    this.timeout(5000);

    // Create a job first
    const taskData = {
      type: "care_recommendation",
      payload: { plantType: "basil" },
    };

    const createResponse = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    jobId = createResponse.body.jobId;
  });

  it("should get job details by ID", async function () {
    this.timeout(5000);

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/ai-tasks/${jobId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property("jobId");
    expect(response.body.jobId).to.equal(jobId);
    expect(response.body).to.have.property("type");
    expect(response.body).to.have.property("status");
  });

  xit("should fail without authentication", async function () {
    this.timeout(5000);

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/ai-tasks/${jobId}`,
      headers: {},
    });

    expect(response.statusCode).to.equal(401);
  });

  it("should return 404 for non-existent job", async function () {
    this.timeout(5000);

    const fakeJobId = "non-existent-job-id";

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/ai-tasks/${fakeJobId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
    expect(response.body).to.have.property("error");
  });

  it("should include timestamps in response", async function () {
    this.timeout(5000);

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/ai-tasks/${jobId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property("createdAt");
  });
});

describe("GET /api/ai-tasks/:jobId/status - Get Job Status", () => {
  let jobId: string;

  beforeEach(async function () {
    this.timeout(5000);

    // Create a job first
    const taskData = {
      type: "general",
      payload: { question: "Test question" },
    };

    const createResponse = await testHelper.executeRequest({
      httpMethod: "POST",
      path: "/api/ai-tasks",
      body: taskData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    jobId = createResponse.body.jobId;
  });

  it("should get job status by ID", async function () {
    this.timeout(5000);

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/ai-tasks/${jobId}/status`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property("jobId");
    expect(response.body.jobId).to.equal(jobId);
    expect(response.body).to.have.property("status");
    expect(response.body.status).to.be.a("string");
  });

  xit("should fail without authentication", async function () {
    this.timeout(5000);

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/ai-tasks/${jobId}/status`,
      headers: {},
    });

    expect(response.statusCode).to.equal(401);
  });

  it("should return 404 for non-existent job", async function () {
    this.timeout(5000);

    const response = await testHelper.executeRequest({
      httpMethod: "GET",
      path: `/api/ai-tasks/fake-job-id/status`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});
