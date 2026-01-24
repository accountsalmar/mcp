import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { evaluatePrompt } from '../services/evaluation-service.js';
import { generatePrompt, generateRawPrompt } from '../services/generation-service.js';
import { evaluationLimiter } from '../middleware/rate-limiter.js';
import { isApiConfigured } from '../services/claude-api.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// Validation schemas
const evaluateSchema = z.object({
  product: z.string().min(1),
  process: z.string().optional(),
  performance: z.string().optional(),
  answers: z.record(z.string()).optional(),
  isReevaluation: z.boolean().optional().default(false),
  previousScore: z.number().optional(),
});

const generateSchema = z.object({
  product: z.string().min(1),
  process: z.string().optional(),
  performance: z.string().optional(),
  answers: z.record(z.string()).optional(),
});

// POST /api/evaluate - Evaluate a prompt using the 30-point rubric
router.post('/evaluate', evaluationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isApiConfigured()) {
      throw new AppError(503, 'Anthropic API is not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const body = evaluateSchema.parse(req.body);

    const result = await evaluatePrompt(
      {
        product: body.product,
        process: body.process,
        performance: body.performance,
        answers: body.answers,
      },
      {
        isReevaluation: body.isReevaluation,
        previousScore: body.previousScore,
      }
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// POST /api/generate - Generate a polished prompt
router.post('/generate', evaluationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isApiConfigured()) {
      throw new AppError(503, 'Anthropic API is not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const body = generateSchema.parse(req.body);

    const result = await generatePrompt({
      product: body.product,
      process: body.process,
      performance: body.performance,
      answers: body.answers,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// POST /api/generate/preview - Generate a raw prompt preview (no API call)
router.post('/generate/preview', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = generateSchema.parse(req.body);

    const prompt = generateRawPrompt({
      product: body.product,
      process: body.process,
      performance: body.performance,
      answers: body.answers,
    });

    res.json({ prompt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// GET /api/evaluate/status - Check if evaluation is available
router.get('/evaluate/status', (req: Request, res: Response) => {
  res.json({
    available: isApiConfigured(),
    message: isApiConfigured()
      ? 'Evaluation service is ready'
      : 'ANTHROPIC_API_KEY not configured',
  });
});

export default router;
