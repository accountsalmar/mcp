import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_PATH: z.string().default('./data/prompt-wizard.db'),
  ANTHROPIC_API_KEY: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  EVALUATION_RATE_LIMIT_MAX: z.string().default('10'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  databasePath: env.DATABASE_PATH,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  rateLimitWindowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
  rateLimitMaxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  evaluationRateLimitMax: parseInt(env.EVALUATION_RATE_LIMIT_MAX, 10),
} as const;

export type Config = typeof config;
