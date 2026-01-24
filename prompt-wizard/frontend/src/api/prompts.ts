import { api } from './client';
import type { Prompt, PromptWithVersion, PromptVersion, ScoreEvolutionItem } from './types';

export const promptsApi = {
  // Get all prompts
  getAll: () => api.get<Prompt[]>('/prompts'),

  // Get a prompt by ID
  getById: (id: number) => api.get<PromptWithVersion>(`/prompts/${id}`),

  // Create a new prompt
  create: (name: string) => api.post<Prompt>('/prompts', { name }),

  // Update a prompt
  update: (id: number, name: string) => api.put<Prompt>(`/prompts/${id}`, { name }),

  // Delete a prompt
  delete: (id: number) => api.delete<void>(`/prompts/${id}`),

  // Search prompts
  search: (query: string) => api.get<Prompt[]>(`/prompts/search?q=${encodeURIComponent(query)}`),

  // Get all versions for a prompt
  getVersions: (promptId: number) => api.get<PromptVersion[]>(`/prompts/${promptId}/versions`),

  // Get a specific version
  getVersion: (promptId: number, versionNumber: number) =>
    api.get<PromptVersion>(`/prompts/${promptId}/versions/${versionNumber}`),

  // Create a new version
  createVersion: (promptId: number, data: {
    product: string;
    process?: string;
    performance?: string;
    answers?: Record<string, string>;
    finalPrompt?: string;
    evaluation?: {
      productScore: number;
      processScore: number;
      performanceScore: number;
      totalScore: number;
      percentageScore: number;
      strengths: string[];
      criticalMissing: string[];
      questions: unknown[];
    };
  }) => api.post<PromptVersion>(`/prompts/${promptId}/versions`, data),

  // Get score evolution
  getScoreEvolution: (promptId: number) =>
    api.get<ScoreEvolutionItem[]>(`/prompts/${promptId}/versions/evolution`),

  // Delete a version
  deleteVersion: (promptId: number, versionNumber: number) =>
    api.delete<void>(`/prompts/${promptId}/versions/${versionNumber}`),
};
