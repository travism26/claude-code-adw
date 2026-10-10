import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { AnswerService } from "../services/AnswerService";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Validation middleware
const validateAnswerCreate = [
  body("question_id").isUUID().withMessage("Invalid question ID"),
  body("body")
    .trim()
    .notEmpty()
    .withMessage("Answer body is required")
    .isLength({ max: 2000 })
    .withMessage("Body must be 2000 characters or less"),
];

const validateAnswerUpdate = [
  param("id").isUUID().withMessage("Invalid answer ID"),
  body("body")
    .trim()
    .notEmpty()
    .withMessage("Answer body is required")
    .isLength({ max: 2000 })
    .withMessage("Body must be 2000 characters or less"),
];

const validateVote = [
  param("id").isUUID().withMessage("Invalid answer ID"),
  body("value")
    .isInt()
    .withMessage("Vote value is required")
    .isIn([1, -1])
    .withMessage("Vote value must be 1 (upvote) or -1 (downvote)"),
];

// Create answer
router.post(
  "/",
  authenticateJWT,
  validateAnswerCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify question exists
      const question = await AnswerService.findQuestionById(req.body.question_id);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      const createdAnswer = await AnswerService.create({
        question_id: req.body.question_id,
        body: req.body.body,
        user_id: req.user!.id,
      });

      return res.status(201).json(createdAnswer);
    } catch (error) {
      logApi.error("Error creating answer", {
        userId: req.user!.id,
        questionId: req.body.question_id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to create answer" });
    }
  }
);

// Update answer (author only)
router.put(
  "/:id",
  authenticateJWT,
  validateAnswerUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const answer = await AnswerService.findById(req.params.id);

      if (!answer) {
        return res.status(404).json({ error: "Answer not found" });
      }

      // Check if user is the author
      if (answer.user_id !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "You can only edit your own answers" });
      }

      const updatedAnswer = await AnswerService.update(answer, { body: req.body.body });

      return res.status(200).json(updatedAnswer);
    } catch (error) {
      logApi.error("Error updating answer", {
        userId: req.user!.id,
        answerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to update answer" });
    }
  }
);

// Delete answer (author only)
router.delete(
  "/:id",
  authenticateJWT,
  [param("id").isUUID().withMessage("Invalid answer ID")],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const answer = await AnswerService.findById(req.params.id);

      if (!answer) {
        return res.status(404).json({ error: "Answer not found" });
      }

      // Check if user is the author
      if (answer.user_id !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "You can only delete your own answers" });
      }

      await AnswerService.delete(answer);

      return res.status(200).json({ message: "Answer deleted successfully" });
    } catch (error) {
      logApi.error("Error deleting answer", {
        userId: req.user!.id,
        answerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to delete answer" });
    }
  }
);

// Vote on answer
router.post(
  "/:id/vote",
  authenticateJWT,
  validateVote,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify answer exists
      const answer = await AnswerService.findById(req.params.id);
      if (!answer) {
        return res.status(404).json({ error: "Answer not found" });
      }

      // Check if user already voted on this answer
      const existingVote = await AnswerService.findVoteByUserAndAnswer(req.user!.id, req.params.id);

      let updatedAnswer;
      if (existingVote) {
        // Update existing vote
        updatedAnswer = await AnswerService.updateVote(existingVote, answer, req.body.value);
      } else {
        // Create new vote
        await AnswerService.createVote({
          answer_id: req.params.id,
          user_id: req.user!.id,
          value: req.body.value,
        });
        updatedAnswer = await AnswerService.addVoteToAnswer(answer, req.body.value);
      }

      return res.status(200).json(updatedAnswer);
    } catch (error) {
      logApi.error("Error voting on answer", {
        userId: req.user!.id,
        answerId: req.params.id,
        voteValue: req.body.value,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to vote on answer" });
    }
  }
);

// Remove vote from answer
router.delete(
  "/:id/vote",
  authenticateJWT,
  [param("id").isUUID().withMessage("Invalid answer ID")],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify answer exists
      const answer = await AnswerService.findById(req.params.id);
      if (!answer) {
        return res.status(404).json({ error: "Answer not found" });
      }

      // Find user's vote
      const vote = await AnswerService.findVoteByUserAndAnswer(req.user!.id, req.params.id);

      if (!vote) {
        return res.status(404).json({ error: "Vote not found" });
      }

      const updatedAnswer = await AnswerService.removeVote(vote, answer);

      return res.status(200).json(updatedAnswer);
    } catch (error) {
      logApi.error("Error removing vote", {
        userId: req.user!.id,
        answerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to remove vote" });
    }
  }
);

export default router;
