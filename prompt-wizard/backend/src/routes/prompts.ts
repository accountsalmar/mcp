import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as promptService from '../services/prompt-service.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// Validation schemas
const createPromptSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
});

const updatePromptSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
});

// GET /api/prompts - List all prompts
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const prompts = promptService.getAllPrompts();
    res.json(prompts);
  } catch (error) {
    next(error);
  }
});

// GET /api/prompts/search?q=query - Search prompts
router.get('/search', (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      throw new AppError(400, 'Search query is required');
    }
    const prompts = promptService.searchPrompts(query);
    res.json(prompts);
  } catch (error) {
    next(error);
  }
});

// GET /api/prompts/:id - Get a prompt by ID
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError(400, 'Invalid prompt ID');
    }

    const result = promptService.getPromptWithLatestVersion(id);
    if (!result) {
      throw new AppError(404, 'Prompt not found');
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/prompts - Create a new prompt
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createPromptSchema.parse(req.body);

    // Check if name already exists
    const existing = promptService.getPromptByName(body.name);
    if (existing) {
      throw new AppError(409, 'A prompt with this name already exists');
    }

    const prompt = promptService.createPrompt(body.name);
    res.status(201).json(prompt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// PUT /api/prompts/:id - Update a prompt
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError(400, 'Invalid prompt ID');
    }

    const body = updatePromptSchema.parse(req.body);

    // Check if new name conflicts with another prompt
    const existing = promptService.getPromptByName(body.name);
    if (existing && existing.id !== id) {
      throw new AppError(409, 'A prompt with this name already exists');
    }

    const updated = promptService.updatePrompt(id, body.name);
    if (!updated) {
      throw new AppError(404, 'Prompt not found');
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// DELETE /api/prompts/:id - Delete a prompt
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError(400, 'Invalid prompt ID');
    }

    const deleted = promptService.deletePrompt(id);
    if (!deleted) {
      throw new AppError(404, 'Prompt not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
