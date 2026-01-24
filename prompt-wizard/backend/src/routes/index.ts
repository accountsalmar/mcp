import { Router } from 'express';
import promptsRouter from './prompts.js';
import versionsRouter from './versions.js';
import evaluationRouter from './evaluation.js';
import complexityRouter from './complexity.js';

const router = Router();

// Mount route modules
router.use('/prompts', promptsRouter);
router.use('/prompts', versionsRouter); // Nested under /prompts/:promptId/versions
router.use('/', evaluationRouter);       // /evaluate, /generate
router.use('/', complexityRouter);       // /detect-complexity, /complexity-levels

export default router;
