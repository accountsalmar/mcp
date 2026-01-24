import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { EvaluationResult, ComplexityLevel } from '../api/types';

interface WizardState {
  currentStep: number;
  product: string;
  process: string;
  performance: string;
  answers: Record<string, string>;
  evaluation: EvaluationResult | null;
  finalPrompt: string;
  previousScore: number | null;
  complexity: ComplexityLevel;
  autoDetectedComplexity: ComplexityLevel | null;
}

interface WizardContextType extends WizardState {
  setProduct: (value: string) => void;
  setProcess: (value: string) => void;
  setPerformance: (value: string) => void;
  setAnswer: (question: string, answer: string) => void;
  clearAnswers: () => void;
  setEvaluation: (result: EvaluationResult) => void;
  setFinalPrompt: (prompt: string) => void;
  setPreviousScore: (score: number | null) => void;
  setComplexity: (level: ComplexityLevel) => void;
  setAutoDetectedComplexity: (level: ComplexityLevel | null) => void;
  goToStep: (step: number) => void;
  reset: () => void;
  loadState: (state: Partial<WizardState>) => void;
}

const initialState: WizardState = {
  currentStep: 1,
  product: '',
  process: '',
  performance: '',
  answers: {},
  evaluation: null,
  finalPrompt: '',
  previousScore: null,
  complexity: 'moderate',
  autoDetectedComplexity: null,
};

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(initialState);

  const setProduct = useCallback((value: string) => {
    setState(s => ({ ...s, product: value }));
  }, []);

  const setProcess = useCallback((value: string) => {
    setState(s => ({ ...s, process: value }));
  }, []);

  const setPerformance = useCallback((value: string) => {
    setState(s => ({ ...s, performance: value }));
  }, []);

  const setAnswer = useCallback((question: string, answer: string) => {
    setState(s => ({
      ...s,
      answers: { ...s.answers, [question]: answer },
    }));
  }, []);

  const clearAnswers = useCallback(() => {
    setState(s => ({ ...s, answers: {} }));
  }, []);

  const setEvaluation = useCallback((result: EvaluationResult) => {
    setState(s => ({ ...s, evaluation: result }));
  }, []);

  const setFinalPrompt = useCallback((prompt: string) => {
    setState(s => ({ ...s, finalPrompt: prompt }));
  }, []);

  const setPreviousScore = useCallback((score: number | null) => {
    setState(s => ({ ...s, previousScore: score }));
  }, []);

  const setComplexity = useCallback((level: ComplexityLevel) => {
    setState(s => ({ ...s, complexity: level }));
  }, []);

  const setAutoDetectedComplexity = useCallback((level: ComplexityLevel | null) => {
    setState(s => ({ ...s, autoDetectedComplexity: level }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState(s => ({ ...s, currentStep: step }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const loadState = useCallback((newState: Partial<WizardState>) => {
    setState(s => ({ ...s, ...newState }));
  }, []);

  return (
    <WizardContext.Provider
      value={{
        ...state,
        setProduct,
        setProcess,
        setPerformance,
        setAnswer,
        clearAnswers,
        setEvaluation,
        setFinalPrompt,
        setPreviousScore,
        setComplexity,
        setAutoDetectedComplexity,
        goToStep,
        reset,
        loadState,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
