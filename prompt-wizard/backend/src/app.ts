import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/environment.js';
import { errorHandler } from './middleware/error-handler.js';
import { generalLimiter } from './middleware/rate-limiter.js';
import routes from './routes/index.js';

export const app = express();

// Middleware
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(generalLimiter);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// API info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Prompt Wizard API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      prompts: 'GET/POST /api/prompts',
      versions: 'GET/POST /api/prompts/:id/versions',
      evaluate: 'POST /api/evaluate',
      generate: 'POST /api/generate',
      complexity: 'POST /api/detect-complexity'
    }
  });
});

// Mount API routes
app.use('/api', routes);

// Serve frontend static files in production
if (config.nodeEnv === 'production') {
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = join(fileURLToPath(import.meta.url), '..');
  const frontendPath = join(__dirname, '..', '..', 'frontend', 'dist');

  app.use(express.static(frontendPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      next();
    } else {
      res.sendFile(join(frontendPath, 'index.html'));
    }
  });
}

// 404 handler for API routes
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler (must be last)
app.use(errorHandler);
