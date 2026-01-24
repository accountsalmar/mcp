import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { promptsApi } from '../api/prompts';
import type { Prompt } from '../api/types';

interface PromptContextType {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  refreshPrompts: () => Promise<void>;
  createPrompt: (name: string) => Promise<Prompt>;
  deletePrompt: (id: number) => Promise<void>;
}

const PromptContext = createContext<PromptContextType | null>(null);

export function PromptProvider({ children }: { children: ReactNode }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await promptsApi.getAll();
      setPrompts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPrompt = useCallback(async (name: string): Promise<Prompt> => {
    const prompt = await promptsApi.create(name);
    setPrompts(prev => [prompt, ...prev]);
    return prompt;
  }, []);

  const deletePrompt = useCallback(async (id: number): Promise<void> => {
    await promptsApi.delete(id);
    setPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  // Load prompts on mount
  useEffect(() => {
    refreshPrompts();
  }, [refreshPrompts]);

  return (
    <PromptContext.Provider
      value={{
        prompts,
        loading,
        error,
        refreshPrompts,
        createPrompt,
        deletePrompt,
      }}
    >
      {children}
    </PromptContext.Provider>
  );
}

export function usePrompts() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error('usePrompts must be used within a PromptProvider');
  }
  return context;
}
