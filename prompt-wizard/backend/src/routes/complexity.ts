import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { detectComplexity, normalizeComplexity, getQuestionCount } from '../services/complexity-service.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// Validation schemas
const detectSchema = z.object({
  text: z.string().min(1),
});

const normalizeSchema = z.object({
  level: z.string().min(1),
});

// POST /api/detect-complexity - Detect complexity level of a prompt
router.post('/detect-complexity', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = detectSchema.parse(req.body);
    const result = detectComplexity(body.text);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// POST /api/normalize-complexity - Normalize a complexity level
router.post('/normalize-complexity', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = normalizeSchema.parse(req.body);
    const level = normalizeComplexity(body.level);
    const questionCount = getQuestionCount(level);

    res.json({
      level,
      questionCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// GET /api/complexity-levels - Get all complexity levels and their question counts
router.get('/complexity-levels', (req: Request, res: Response) => {
  res.json({
    levels: [
      { level: 'simple', questionCount: 9, description: 'Basic tasks with clear, single objectives' },
      { level: 'moderate', questionCount: 12, description: 'Tasks with some complexity or multiple aspects' },
      { level: 'complex', questionCount: 15, description: 'Multi-step tasks requiring comprehensive prompts' },
    ],
  });
});

export default router;
