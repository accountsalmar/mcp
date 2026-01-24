import { api } from './client';
import type { ComplexityResult, ComplexityLevel } from './types';

export const complexityApi = {
  // Detect complexity level
  detect: (text: string) =>
    api.post<ComplexityResult>('/detect-complexity', { text }),

  // Normalize a complexity level
  normalize: (level: string) =>
    api.post<{ level: ComplexityLevel; questionCount: number }>('/normalize-complexity', { level }),

  // Get all complexity levels
  getLevels: () =>
    api.get<{
      levels: Array<{
        level: ComplexityLevel;
        questionCount: number;
        description: string;
      }>;
    }>('/complexity-levels'),
};
