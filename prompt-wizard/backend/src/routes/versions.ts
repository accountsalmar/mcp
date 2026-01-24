import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as versionService from '../services/version-service.js';
import * as promptService from '../services/prompt-service.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// Validation schema for creating a version
const createVersionSchema = z.object({
  product: z.string().min(1),
  process: z.string().optional(),
  performance: z.string().optional(),
  answers: z.record(z.string()).optional(),
  finalPrompt: z.string().optional(),
  evaluation: z.object({
    productScore: z.number().min(0).max(10),
    processScore: z.number().min(0).max(10),
    performanceScore: z.number().min(0).max(10),
    totalScore: z.number().min(0).max(30),
    percentageScore: z.number().min(0).max(100),
    strengths: z.array(z.string()),
    criticalMissing: z.array(z.string()),
    questions: z.array(z.unknown()),
    changeExplanation: z.string().optional(),
  }).optional(),
});

// GET /api/prompts/:promptId/versions - List all versions for a prompt
router.get('/:promptId/versions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const promptId = parseInt(req.params.promptId, 10);
    if (isNaN(promptId)) {
      throw new AppError(400, 'Invalid prompt ID');
    }

    // Verify prompt exists
    const prompt = promptService.getPromptById(promptId);
    if (!prompt) {
      throw new AppError(404, 'Prompt not found');
    }

    const versions = versionService.getVersionsByPromptId(promptId);
    res.json(versions);
  } catch (error) {
    next(error);
  }
});

// GET /api/prompts/:promptId/versions/evolution - Get score evolution
router.get('/:promptId/versions/evolution', (req: Request, res: Response, next: NextFunction) => {
  try {
    const promptId = parseInt(req.params.promptId, 10);
    if (isNaN(promptId)) {
      throw new AppError(400, 'Invalid prompt ID');
    }

    const evolution = versionService.getScoreEvolution(promptId);
    res.json(evolution);
  } catch (error) {
    next(error);
  }
});

// GET /api/prompts/:promptId/versions/:versionNumber - Get a specific version
router.get('/:promptId/versions/:versionNumber', (req: Request, res: Response, next: NextFunction) => {
  try {
    const promptId = parseInt(req.params.promptId, 10);
    const versionNumber = parseInt(req.params.versionNumber, 10);

    if (isNaN(promptId) || isNaN(versionNumber)) {
      throw new AppError(400, 'Invalid prompt ID or version number');
    }

    const version = versionService.getVersion(promptId, versionNumber);
    if (!version) {
      throw new AppError(404, 'Version not found');
    }

    // Parse JSON fields for the response
    const parsed = versionService.parseVersionFields(version);
    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

// POST /api/prompts/:promptId/versions - Create a new version
router.post('/:promptId/versions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const promptId = parseInt(req.params.promptId, 10);
    if (isNaN(promptId)) {
      throw new AppError(400, 'Invalid prompt ID');
    }

    // Verify prompt exists
    const prompt = promptService.getPromptById(promptId);
    if (!prompt) {
      throw new AppError(404, 'Prompt not found');
    }

    const body = createVersionSchema.parse(req.body);

    const version = versionService.createVersion({
      promptId,
      product: body.product,
      process: body.process,
      performance: body.performance,
      answers: body.answers,
      finalPrompt: body.finalPrompt,
      evaluation: body.evaluation as any,
    });

    res.status(201).json(version);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// DELETE /api/prompts/:promptId/versions/:versionNumber - Delete a version
router.delete('/:promptId/versions/:versionNumber', (req: Request, res: Response, next: NextFunction) => {
  try {
    const promptId = parseInt(req.params.promptId, 10);
    const versionNumber = parseInt(req.params.versionNumber, 10);

    if (isNaN(promptId) || isNaN(versionNumber)) {
      throw new AppError(400, 'Invalid prompt ID or version number');
    }

    const deleted = versionService.deleteVersion(promptId, versionNumber);
    if (!deleted) {
      throw new AppError(404, 'Version not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
