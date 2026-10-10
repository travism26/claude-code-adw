import { testHelper } from '../mocha.setup';
import { Question } from '../../models/Question';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

let authToken: string;
let testUser: any;

beforeEach(async () => {
  testHelper.clearTestUser();
  const uniqueEmail = `test-user-${Date.now()}@example.com`;
  testUser = await testHelper.createTestUser({ email: uniqueEmail });
  const loginResponse = await testHelper.executeRequest({
    httpMethod: 'POST',
    path: '/api/auth/login',
    body: { email: testUser.email, password: 'test-password' },
    headers: {},
  });
  authToken = loginResponse.body.accessToken;
});

describe('Create Question API', () => {
  it('should create a question with valid data', async () => {
    const questionData = {
      title: 'How do I water tomatoes?',
      body: 'I am new to gardening and need help with watering schedules.',
      tags: ['tomatoes', 'watering', 'beginner'],
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/questions',
      body: questionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property('id');
    expect(response.body.title).to.equal(questionData.title);
    expect(response.body.body).to.equal(questionData.body);
    expect(response.body.tags).to.deep.equal(questionData.tags);
  });

  it('should create a question without tags', async () => {
    const questionData = {
      title: 'What is companion planting?',
      body: 'Can someone explain the basics of companion planting?',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/questions',
      body: questionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property('id');
  });

  it('should fail to create question without authentication', async () => {
    const questionData = {
      title: 'Test Question',
      body: 'This should fail',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/questions',
      body: questionData,
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });

  it('should fail with missing title', async () => {
    const questionData = {
      body: 'Question without a title',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/questions',
      body: questionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it('should fail with missing body', async () => {
    const questionData = {
      title: 'Question without body',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/questions',
      body: questionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it('should fail with title too long', async () => {
    const questionData = {
      title: 'a'.repeat(201),
      body: 'Valid body',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/questions',
      body: questionData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });
});

describe('Get Questions', () => {
  beforeEach(async () => {
    await Question.create({
      user_id: testUser.id,
      title: 'First Question',
      body: 'This is the first test question',
      tags: ['test', 'first'],
    });
    await Question.create({
      user_id: testUser.id,
      title: 'Second Question',
      body: 'This is the second test question',
      tags: ['test', 'second'],
    });
  });

  it('should get all questions', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/questions',
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.questions).to.be.an('array');
    expect(response.body.questions.length).to.be.gte(2);
  });

  it('should filter questions by tag', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/questions?tag=first',
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.questions).to.be.an('array');
  });

  it('should search questions', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/questions?search=first',
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.questions).to.be.an('array');
  });

  it('should support pagination', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/questions?page=1&limit=1',
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.pagination).to.exist;
    expect(response.body.pagination.page).to.equal(1);
    expect(response.body.pagination.limit).to.equal(1);
  });
});

describe('Get Single Question', () => {
  let testQuestion: any;

  beforeEach(async () => {
    testQuestion = await Question.create({
      user_id: testUser.id,
      title: 'Test Question',
      body: 'This is a test question',
    });
  });

  it('should get a single question by id', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/questions/${testQuestion.id}`,
      headers: {},
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.id).to.equal(testQuestion.id);
    expect(response.body.title).to.equal(testQuestion.title);
  });

  it('should return 404 for non-existent question', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/questions/${uuid}`,
      headers: {},
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Update Question', () => {
  let testQuestion: any;

  beforeEach(async () => {
    testQuestion = await Question.create({
      user_id: testUser.id,
      title: 'Original Title',
      body: 'Original body',
    });
  });

  it('should update a question with valid data', async () => {
    const updates = {
      title: 'Updated Title',
      body: 'Updated body',
      tags: ['updated'],
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/questions/${testQuestion.id}`,
      body: updates,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.title).to.equal(updates.title);
    expect(response.body.body).to.equal(updates.body);
  });

  it('should fail to update non-existent question', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/questions/${uuid}`,
      body: { title: 'Updated' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail to update another users question', async () => {
    const otherUser = await testHelper.createTestUser({
      email: `other-${Date.now()}@example.com`,
    });
    const otherQuestion = await Question.create({
      user_id: otherUser.id,
      title: 'Other User Question',
      body: 'This belongs to another user',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/questions/${otherQuestion.id}`,
      body: { title: 'Trying to update' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/questions/${testQuestion.id}`,
      body: { title: 'Updated' },
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Delete Question', () => {
  let testQuestion: any;

  beforeEach(async () => {
    testQuestion = await Question.create({
      user_id: testUser.id,
      title: 'Question to Delete',
      body: 'This will be deleted',
    });
  });

  it('should delete a question', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/questions/${testQuestion.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
  });

  it('should fail to delete non-existent question', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/questions/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail to delete another users question', async () => {
    const otherUser = await testHelper.createTestUser({
      email: `other-${Date.now()}@example.com`,
    });
    const otherQuestion = await Question.create({
      user_id: otherUser.id,
      title: 'Other User Question',
      body: 'This belongs to another user',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/questions/${otherQuestion.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });
});
