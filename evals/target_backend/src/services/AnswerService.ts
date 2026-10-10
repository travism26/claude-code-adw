import { Answer, Question, Vote, User } from '../models';

/**
 * AnswerService - Encapsulates all Answer model operations
 */
export const AnswerService = {
  /**
   * Create a new answer
   */
  async create(data: {
    question_id: string;
    body: string;
    user_id: string;
  }): Promise<Answer> {
    const answer = await Answer.create(data);
    return (await Answer.findByPk(answer.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
      ],
    }))!;
  },

  /**
   * Find answer by ID
   */
  async findById(id: string): Promise<Answer | null> {
    return Answer.findOne({
      where: { id },
    });
  },

  /**
   * Find answer by ID with author
   */
  async findByIdWithAuthor(id: string): Promise<Answer | null> {
    return Answer.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
      ],
    });
  },

  /**
   * Update an answer
   */
  async update(answer: Answer, data: { body: string }): Promise<Answer> {
    await answer.update(data);
    return (await Answer.findByPk(answer.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
      ],
    }))!;
  },

  /**
   * Delete an answer
   */
  async delete(answer: Answer): Promise<void> {
    await answer.destroy();
  },

  /**
   * Find vote for an answer by user
   */
  async findVoteByUserAndAnswer(userId: string, answerId: string): Promise<Vote | null> {
    return Vote.findOne({
      where: {
        answer_id: answerId,
        user_id: userId,
      },
    });
  },

  /**
   * Create a vote
   */
  async createVote(data: {
    answer_id: string;
    user_id: string;
    value: number;
  }): Promise<Vote> {
    return Vote.create(data);
  },

  /**
   * Update vote and answer upvotes count
   */
  async updateVote(
    vote: Vote,
    answer: Answer,
    newValue: number
  ): Promise<Answer> {
    const oldValue = vote.value;
    await vote.update({ value: newValue });
    const voteDiff = newValue - oldValue;
    await answer.update({ upvotes: answer.upvotes + voteDiff });
    return (await Answer.findByPk(answer.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
      ],
    }))!;
  },

  /**
   * Add vote to answer
   */
  async addVoteToAnswer(answer: Answer, value: number): Promise<Answer> {
    await answer.update({ upvotes: answer.upvotes + value });
    return (await Answer.findByPk(answer.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
      ],
    }))!;
  },

  /**
   * Remove vote from answer
   */
  async removeVote(vote: Vote, answer: Answer): Promise<Answer> {
    await answer.update({ upvotes: answer.upvotes - vote.value });
    await vote.destroy();
    return (await Answer.findByPk(answer.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
      ],
    }))!;
  },

  /**
   * Find question by ID
   */
  async findQuestionById(id: string): Promise<Question | null> {
    return Question.findByPk(id);
  },
};
