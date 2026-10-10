import { Vote, Answer, Question, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Vote Model', () => {
  let testUser: User;
  let testQuestion: Question;
  let testAnswer: Answer;

  before(async () => {
    testUser = await testHelper.createTestUser();
    testQuestion = await Question.create({
      user_id: testUser.id,
      title: 'Test Question',
      body: 'This is a test question.',
    });
    testAnswer = await Answer.create({
      question_id: testQuestion.id,
      user_id: testUser.id,
      body: 'This is a test answer.',
    });
  });

  describe('Creation', () => {
    it('should create an upvote (value = 1)', async () => {
      const voteData = {
        answer_id: testAnswer.id,
        user_id: testUser.id,
        value: 1,
      };

      const vote = await Vote.create(voteData);

      expect(vote).to.exist;
      expect(vote.value).to.equal(1);
      expect(vote.answer_id).to.equal(testAnswer.id);
      expect(vote.user_id).to.equal(testUser.id);
    });

    it('should create a downvote (value = -1)', async () => {
      const user2 = await User.create({
        email: `test-vote-${Date.now()}@example.com`,
        password_hash: 'password123',
        tz: 'UTC',
      });

      const voteData = {
        answer_id: testAnswer.id,
        user_id: user2.id,
        value: -1,
      };

      const vote = await Vote.create(voteData);

      expect(vote).to.exist;
      expect(vote.value).to.equal(-1);
      expect(vote.answer_id).to.equal(testAnswer.id);
      expect(vote.user_id).to.equal(user2.id);
    });
  });

  describe('Validation', () => {
    it('should validate value must be 1 or -1', async () => {
      const user3 = await User.create({
        email: `test-vote-invalid-${Date.now()}@example.com`,
        password_hash: 'password123',
        tz: 'UTC',
      });

      const voteData = {
        answer_id: testAnswer.id,
        user_id: user3.id,
        value: 0,
      };

      await expect(Vote.create(voteData)).rejected;

      voteData.value = 2;
      await expect(Vote.create(voteData)).rejected;
    });

    it('should require answer_id', async () => {
      const voteData = {
        user_id: testUser.id,
        value: 1,
      };

      await expect(Vote.create(voteData)).rejected;
    });

    it('should require user_id', async () => {
      const voteData = {
        answer_id: testAnswer.id,
        value: 1,
      };

      await expect(Vote.create(voteData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with an answer', async () => {
      const user4 = await User.create({
        email: `test-vote-assoc-${Date.now()}@example.com`,
        password_hash: 'password123',
        tz: 'UTC',
      });

      const vote = await Vote.create({
        answer_id: testAnswer.id,
        user_id: user4.id,
        value: 1,
      });

      const voteWithAnswer = await Vote.findOne({
        where: { id: vote.id },
        include: [{ model: Answer, as: 'answer' }],
      });

      expect(voteWithAnswer).to.exist;
      expect((voteWithAnswer as any)?.answer).to.exist;
      expect((voteWithAnswer as any)?.answer?.id).to.equal(testAnswer.id);
    });

    it('should associate with a user', async () => {
      const user5 = await User.create({
        email: `test-vote-user-${Date.now()}@example.com`,
        password_hash: 'password123',
        tz: 'UTC',
      });

      const vote = await Vote.create({
        answer_id: testAnswer.id,
        user_id: user5.id,
        value: 1,
      });

      const voteWithUser = await Vote.findOne({
        where: { id: vote.id },
        include: [{ model: User, as: 'user' }],
      });

      expect(voteWithUser).to.exist;
      expect((voteWithUser as any)?.user).to.exist;
      expect((voteWithUser as any)?.user?.id).to.equal(user5.id);
    });

    it('should not create vote with non-existent answer', async () => {
      const voteData = {
        answer_id: '00000000-0000-0000-0000-000000000000',
        user_id: testUser.id,
        value: 1,
      };

      await expect(Vote.create(voteData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update vote value', async () => {
      const user6 = await User.create({
        email: `test-vote-update-${Date.now()}@example.com`,
        password_hash: 'password123',
        tz: 'UTC',
      });

      const vote = await Vote.create({
        answer_id: testAnswer.id,
        user_id: user6.id,
        value: 1,
      });

      await vote.update({ value: -1 });

      expect(vote.value).to.equal(-1);
    });
  });
});
