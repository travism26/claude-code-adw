import { testHelper } from '../mocha.setup';
import { Answer, Question } from '../../models';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

let authToken: string;
let testUser: any;
let testQuestion: Question;

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

  testQuestion = await Question.create({
    user_id: testUser.id,
    title: 'Test Question',
    body: 'This is a test question for answers',
  });
});

describe('Create Answer API', () => {
  it('should create an answer with valid data', async () => {
    const answerData = {
      question_id: testQuestion.id,
      body: 'This is my answer to the question.',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/answers',
      body: answerData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property('id');
    expect(response.body.body).to.equal(answerData.body);
    expect(response.body.question_id).to.equal(testQuestion.id);
  });

  it('should fail to create answer without authentication', async () => {
    const answerData = {
      question_id: testQuestion.id,
      body: 'This should fail',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/answers',
      body: answerData,
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });

  it('should fail with missing body', async () => {
    const answerData = {
      question_id: testQuestion.id,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/answers',
      body: answerData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it('should fail with non-existent question', async () => {
    const answerData = {
      question_id: uuidv4(),
      body: 'Answer to non-existent question',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/answers',
      body: answerData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail with body too long', async () => {
    const answerData = {
      question_id: testQuestion.id,
      body: 'a'.repeat(2001),
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/answers',
      body: answerData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });
});

describe('Vote on Answer API', () => {
  let testAnswer: Answer;

  beforeEach(async () => {
    testAnswer = await Answer.create({
      question_id: testQuestion.id,
      user_id: testUser.id,
      body: 'This is a test answer',
    });
  });

  it('should upvote an answer', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${testAnswer.id}/vote`,
      body: { value: 1 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.upvotes).to.equal(1);
  });

  it('should downvote an answer', async () => {
    // First set answer to have 1 upvote so downvote brings it to 0
    await testAnswer.update({ upvotes: 1 });

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${testAnswer.id}/vote`,
      body: { value: -1 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.upvotes).to.equal(0);
  });

  it('should change vote from upvote to downvote', async () => {
    // First set answer to have 2 upvotes to allow for downvote change
    await testAnswer.update({ upvotes: 2 });

    // First upvote (now at 3)
    await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${testAnswer.id}/vote`,
      body: { value: 1 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Change to downvote (3 - 1 - (-1) = 3 - 2 = 1)
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${testAnswer.id}/vote`,
      body: { value: -1 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.upvotes).to.equal(1);
  });

  it('should fail to vote on non-existent answer', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${uuid}/vote`,
      body: { value: 1 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail with invalid vote value', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${testAnswer.id}/vote`,
      body: { value: 2 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${testAnswer.id}/vote`,
      body: { value: 1 },
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Update Answer', () => {
  let testAnswer: Answer;

  beforeEach(async () => {
    testAnswer = await Answer.create({
      question_id: testQuestion.id,
      user_id: testUser.id,
      body: 'Original answer',
    });
  });

  it('should update an answer with valid data', async () => {
    const updates = {
      body: 'Updated answer with more details',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/answers/${testAnswer.id}`,
      body: updates,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.body).to.equal(updates.body);
  });

  it('should fail to update non-existent answer', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/answers/${uuid}`,
      body: { body: 'Updated' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail to update another users answer', async () => {
    const otherUser = await testHelper.createTestUser({
      email: `other-${Date.now()}@example.com`,
    });
    const otherAnswer = await Answer.create({
      question_id: testQuestion.id,
      user_id: otherUser.id,
      body: 'Other users answer',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/answers/${otherAnswer.id}`,
      body: { body: 'Trying to update' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/answers/${testAnswer.id}`,
      body: { body: 'Updated' },
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Delete Answer', () => {
  let testAnswer: Answer;

  beforeEach(async () => {
    testAnswer = await Answer.create({
      question_id: testQuestion.id,
      user_id: testUser.id,
      body: 'Answer to delete',
    });
  });

  it('should delete an answer', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/answers/${testAnswer.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
  });

  it('should fail to delete non-existent answer', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/answers/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail to delete another users answer', async () => {
    const otherUser = await testHelper.createTestUser({
      email: `other-${Date.now()}@example.com`,
    });
    const otherAnswer = await Answer.create({
      question_id: testQuestion.id,
      user_id: otherUser.id,
      body: 'Other users answer',
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/answers/${otherAnswer.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });
});

describe('Remove Vote', () => {
  let testAnswer: Answer;

  beforeEach(async () => {
    testAnswer = await Answer.create({
      question_id: testQuestion.id,
      user_id: testUser.id,
      body: 'Answer with votes',
    });
  });

  it('should remove a vote', async () => {
    // First add a vote
    await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/answers/${testAnswer.id}/vote`,
      body: { value: 1 },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Then remove it
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/answers/${testAnswer.id}/vote`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.upvotes).to.equal(0);
  });

  it('should fail to remove non-existent vote', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/answers/${testAnswer.id}/vote`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail on non-existent answer', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/answers/${uuid}/vote`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});
