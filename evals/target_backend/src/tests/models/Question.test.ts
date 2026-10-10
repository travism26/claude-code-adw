import { Question, User } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Question Model', () => {
  let testUser: User;

  before(async () => {
    testUser = await testHelper.createTestUser();
  });

  describe('Creation', () => {
    it('should create a question with required fields', async () => {
      const questionData = {
        user_id: testUser.id,
        title: 'How do I water tomatoes?',
        body: 'I am new to gardening and need help with watering schedules for tomatoes.',
      };

      const question = await Question.create(questionData);

      expect(question).to.exist;
      expect(question.title).to.equal(questionData.title);
      expect(question.body).to.equal(questionData.body);
      expect(question.user_id).to.equal(testUser.id);
      expect(question.tags).to.deep.equal([]);
    });

    it('should create a question with all fields', async () => {
      const questionData = {
        user_id: testUser.id,
        title: 'Best companion plants for basil?',
        body: 'What plants grow well alongside basil in a vegetable garden?',
        tags: ['herbs', 'companion-planting', 'basil'],
      };

      const question = await Question.create(questionData);

      expect(question).to.exist;
      expect(question.title).to.equal(questionData.title);
      expect(question.body).to.equal(questionData.body);
      expect(question.tags).to.deep.equal(questionData.tags);
      expect(question.user_id).to.equal(testUser.id);
    });
  });

  describe('Validation', () => {
    it('should require a title', async () => {
      const questionData = {
        user_id: testUser.id,
        body: 'This is the question body.',
      };

      await expect(Question.create(questionData)).rejected;
    });

    it('should require a body', async () => {
      const questionData = {
        user_id: testUser.id,
        title: 'Question Title',
      };

      await expect(Question.create(questionData)).rejected;
    });

    it('should validate title length (max 200 characters)', async () => {
      const questionData = {
        user_id: testUser.id,
        title: 'a'.repeat(201),
        body: 'Question body',
      };

      await expect(Question.create(questionData)).rejected;
    });

    it('should validate body length (max 2000 characters)', async () => {
      const questionData = {
        user_id: testUser.id,
        title: 'Question Title',
        body: 'a'.repeat(2001),
      };

      await expect(Question.create(questionData)).rejected;
    });

    it('should validate maximum of 10 tags', async () => {
      const questionData = {
        user_id: testUser.id,
        title: 'Question Title',
        body: 'Question body',
        tags: Array(11).fill('tag'),
      };

      await expect(Question.create(questionData)).rejected;
    });

    it('should validate tag length (max 50 characters each)', async () => {
      const questionData = {
        user_id: testUser.id,
        title: 'Question Title',
        body: 'Question body',
        tags: ['a'.repeat(51)],
      };

      await expect(Question.create(questionData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a user', async () => {
      const question = await Question.create({
        user_id: testUser.id,
        title: 'Test Question',
        body: 'This is a test question.',
      });

      const questionWithUser = await Question.findOne({
        where: { id: question.id },
        include: [{ model: User, as: 'author' }],
      });

      expect(questionWithUser).to.exist;
      expect((questionWithUser as any)?.author).to.exist;
      expect((questionWithUser as any)?.author?.id).to.equal(testUser.id);
    });

    it('should not create question with non-existent user', async () => {
      const questionData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        title: 'Test Question',
        body: 'This is a test question.',
      };

      await expect(Question.create(questionData)).rejected;
    });
  });

  describe('Updates', () => {
    it('should update question details', async () => {
      const question = await Question.create({
        user_id: testUser.id,
        title: 'Original Title',
        body: 'Original body',
        tags: ['original'],
      });

      const updates = {
        title: 'Updated Title',
        body: 'Updated body',
        tags: ['updated', 'modified'],
      };

      await question.update(updates);

      expect(question.title).to.equal(updates.title);
      expect(question.body).to.equal(updates.body);
      expect(question.tags).to.deep.equal(updates.tags);
    });
  });
});
