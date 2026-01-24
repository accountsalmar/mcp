import { api } from './client';
import type { EvaluateRequest, EvaluationResult, GenerateRequest, GenerationResult } from './types';

export const evaluationApi = {
  // Evaluate a prompt using the 30-point rubric
  evaluate: (request: EvaluateRequest) =>
    api.post<EvaluationResult>('/evaluate', request),

  // Generate a polished prompt
  generate: (request: GenerateRequest) =>
    api.post<GenerationResult>('/generate', request),

  // Generate a raw preview (no API call)
  generatePreview: (request: GenerateRequest) =>
    api.post<{ prompt: string }>('/generate/preview', request),

  // Check if evaluation is available
  getStatus: () => api.get<{ available: boolean; message: string }>('/evaluate/status'),
};
