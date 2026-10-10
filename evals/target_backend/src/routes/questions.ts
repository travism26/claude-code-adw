import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { QuestionService } from "../services/QuestionService";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Validation middleware
const validateQuestionCreate = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Question title is required")
    .isLength({ max: 200 })
    .withMessage("Title must be 200 characters or less"),
  body("body")
    .trim()
    .notEmpty()
    .withMessage("Question body is required")
    .isLength({ max: 2000 })
    .withMessage("Body must be 2000 characters or less"),
  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Maximum of 10 tags allowed"),
];

const validateQuestionUpdate = [
  param("id").isUUID().withMessage("Invalid question ID"),
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Question title cannot be empty")
    .isLength({ max: 200 })
    .withMessage("Title must be 200 characters or less"),
  body("body")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Question body cannot be empty")
    .isLength({ max: 2000 })
    .withMessage("Body must be 2000 characters or less"),
  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Maximum of 10 tags allowed"),
];

// Get all questions with pagination and filtering
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("tag").optional().trim(),
    query("search").optional().trim(),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const tag = req.query.tag as string;
      const search = req.query.search as string;

      const result = await QuestionService.findAll({ page, limit, tag, search });

      return res.status(200).json(result);
    } catch (error) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const tag = req.query.tag as string;
      const search = req.query.search as string;

      logApi.error("Error fetching questions", {
        filters: { tag, search },
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to fetch questions" });
    }
  }
);

// Get single question by ID
router.get(
  "/:id",
  [param("id").isUUID().withMessage("Invalid question ID")],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const question = await QuestionService.findById(req.params.id);

      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      return res.status(200).json(question);
    } catch (error) {
      logApi.error("Error fetching question", {
        questionId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to fetch question" });
    }
  }
);

// Create new question
router.post(
  "/",
  authenticateJWT,
  validateQuestionCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const question = await QuestionService.create({
        ...req.body,
        user_id: req.user!.id,
      });

      return res.status(201).json(question);
    } catch (error) {
      logApi.error("Error creating question", {
        userId: req.user!.id,
        questionTitle: req.body.title,
        tags: req.body.tags,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to create question" });
    }
  }
);

// Update question (author only)
router.put(
  "/:id",
  authenticateJWT,
  validateQuestionUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const question = await QuestionService.findByIdSimple(req.params.id);

      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Check if user is the author
      if (question.user_id !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "You can only edit your own questions" });
      }

      const updatedQuestion = await QuestionService.update(question, req.body);

      return res.status(200).json(updatedQuestion);
    } catch (error) {
      logApi.error("Error updating question", {
        userId: req.user!.id,
        questionId: req.params.id,
        updateFields: Object.keys(req.body),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to update question" });
    }
  }
);

// Delete question (author only)
router.delete(
  "/:id",
  authenticateJWT,
  [param("id").isUUID().withMessage("Invalid question ID")],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const question = await QuestionService.findByIdSimple(req.params.id);

      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Check if user is the author
      if (question.user_id !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "You can only delete your own questions" });
      }

      await QuestionService.delete(question);

      return res.status(200).json({ message: "Question deleted successfully" });
    } catch (error) {
      logApi.error("Error deleting question", {
        userId: req.user!.id,
        questionId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to delete question" });
    }
  }
);

export default router;
