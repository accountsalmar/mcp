import rateLimit from 'express-rate-limit';
import { config } from '../config/environment.js';

// General rate limiter for all endpoints
export const generalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs, // 1 minute default
  max: config.rateLimitMaxRequests,    // 100 requests per window default
  message: {
    error: 'Too many requests',
    message: 'Please slow down. You can make up to 100 requests per minute.',
    statusCode: 429,
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if behind a proxy, otherwise use IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           req.ip ||
           'unknown';
  },
});

// Stricter rate limiter for evaluation endpoints (Claude API calls)
export const evaluationLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs, // 1 minute default
  max: config.evaluationRateLimitMax,  // 10 evaluations per minute default
  message: {
    error: 'Too many evaluation requests',
    message: 'Evaluation requests are limited to 10 per minute to manage API costs.',
    statusCode: 429,
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           req.ip ||
           'unknown';
  },
});
