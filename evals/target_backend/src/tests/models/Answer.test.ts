import { Answer, Question, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Answer Model', () => {
  let testUser: User;
  let testQuestion: Question;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testQuestion = await Question.create({
      user_id: testUser.id,
      title: 'Test Question',
      body: 'This is a test question for answers.',
    });
  });

  describe('Creation', () => {
    it('should create an answer with required fields', async () => {
      const answerData = {
        question_id: testQuestion.id,
        user_id: testUser.id,
        body: 'This is my answer to the question.',
      };

      const answer = await Answer.create(answerData);

      expect(answer).to.exist;
      expect(answer.body).to.equal(answerData.body);
      expect(answer.question_id).to.equal(testQuestion.id);
      expect(answer.user_id).to.equal(testUser.id);
      expect(answer.upvotes).to.equal(0);
    });

    it('should create an answer with all fields', async () => {
      const answerData = {
        question_id: testQuestion.id,
        user_id: testUser.id,
        body: 'This is a detailed answer with initial upvotes.',
        upvotes: 5,
      };

      const answer = await Answer.create(answerData);

      expect(answer).to.exist;
      expect(answer.body).to.equal(answerData.body);
      expect(answer.upvotes).to.equal(5);
    });
  });

  describe('Validation', () => {
    it('should require a body', async () => {
      const answerData = {
        question_id: testQuestion.id,
        user_id: testUser.id,
      };

      await expect(Answer.create(answerData)).rejected;
    });

    it('should validate body length (max 2000 characters)', async () => {
      const answerData = {
        question_id: testQuestion.id,
        user_id: testUser.id,
        body: 'a'.repeat(2001),
      };

      await expect(Answer.create(answerData)).rejected;
    });

    it('should validate upvotes cannot be negative', async () => {
      const answerData = {
        question_id: testQuestion.id,
        user_id: testUser.id,
        body: 'This is an answer.',
        upvotes: -1,
      };

      await expect(Answer.create(answerData)).rejected;
    });

    it('should require a question_id', async () => {
      const answerData = {
        user_id: testUser.id,
        body: 'This is an answer.',
      };

      await expect(Answer.create(answerData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a question', async () => {
      const answer = await Answer.create({
        question_id: testQuestion.id,
        user_id: testUser.id,
        body: 'Test answer',
      });

      const answerWithQuestion = await Answer.findOne({
        where: { id: answer.id },
        include: [{ model: Question, as: 'question' }],
      });

      expect(answerWithQuestion).to.exist;
      expect((answerWithQuestion as any)?.question).to.exist;
      expect((answerWithQuestion as any)?.question?.id).to.equal(testQuestion.id);
    });

    it('should associate with a user', async () => {
      const answer = await Answer.create({
        question_id: testQuestion.id,
        user_id: testUser.id,
        body: 'Test answer',
      });

      const answerWithUser = await Answer.findOne({
        where: { id: answer.id },
        include: [{ model: User, as: 'author' }],
      });

      expect(answerWithUser).to.exist;
      expect((answerWithUser as any)?.author).to.exist;
      expect((answerWithUser as any)?.author?.id).to.equal(testUser.id);
    });

    it('should not create answer with non-existent question', async () => {
      const answerData = {
        question_id: '00000000-0000-0000-0000-000000000000',
        user_id: testUser.id,
        body: 'Test answer',
      };

      await expect(Answer.create(answerData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update answer details', async () => {
      const answer = await Answer.create({
        question_id: testQuestion.id,
        user_id: testUser.id,
        body: 'Original answer',
        upvotes: 0,
      });

      const updates = {
        body: 'Updated answer with more details',
        upvotes: 10,
      };

      await answer.update(updates);

      expect(answer.body).to.equal(updates.body);
      expect(answer.upvotes).to.equal(updates.upvotes);
    });
  });
});
