import { Question, Answer, User } from '../models';
import { Op } from 'sequelize';

export interface QuestionFilters {
  page?: number;
  limit?: number;
  tag?: string;
  search?: string;
}

export interface QuestionPaginationResult {
  questions: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * QuestionService - Encapsulates all Question model operations
 */
export const QuestionService = {
  /**
   * Find questions with pagination and filtering
   */
  async findAll(filters: QuestionFilters): Promise<QuestionPaginationResult> {
    const { page = 1, limit = 20, tag, search } = filters;
    const offset = (page - 1) * limit;

    const where: any = {};

    if (tag) {
      where.tags = { [Op.contains]: [tag] };
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows: questions } = await Question.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
        {
          model: Answer,
          as: 'answers',
          attributes: ['id'],
        },
      ],
    });

    return {
      questions: questions.map((q: any) => ({
        id: q.id,
        title: q.title,
        body: q.body,
        tags: q.tags,
        author: q.author,
        answerCount: q.answers?.length || 0,
        created_at: q.created_at,
        updated_at: q.updated_at,
      })),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  },

  /**
   * Find question by ID with full details
   */
  async findById(id: string): Promise<Question | null> {
    return Question.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email'],
        },
        {
          model: Answer,
          as: 'answers',
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'email'],
            },
          ],
          order: [['upvotes', 'DESC']],
        },
      ],
    });
  },

  /**
   * Find question by ID (simple)
   */
  async findByIdSimple(id: string): Promise<Question | null> {
    return Question.findOne({
      where: { id },
    });
  },

  /**
   * Create a new question
   */
  async create(data: {
    title: string;
    body: string;
    tags?: string[];
    user_id: string;
  }): Promise<Question> {
    const question = await Question.create(data);
    return (await Question.findByPk(question.id, {
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
   * Update a question
   */
  async update(question: Question, data: Partial<{
    title: string;
    body: string;
    tags: string[];
  }>): Promise<Question> {
    await question.update(data);
    return (await Question.findByPk(question.id, {
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
   * Delete a question
   */
  async delete(question: Question): Promise<void> {
    await question.destroy();
  },
};
