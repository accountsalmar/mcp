import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  stack?: string;
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Handle specific error types
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    statusCode = 400;
    message = err.message;
    isOperational = true;
  }

  if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON in request body';
    isOperational = true;
  }

  const response: ErrorResponse = {
    error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
    message,
    statusCode,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

// Helper functions to create common errors
export function notFound(resource: string): AppError {
  return new AppError(404, `${resource} not found`);
}

export function badRequest(message: string): AppError {
  return new AppError(400, message);
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(401, message);
}

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError(403, message);
}

export function tooManyRequests(message = 'Too many requests'): AppError {
  return new AppError(429, message);
}
