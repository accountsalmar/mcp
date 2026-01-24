// Prompt types
export interface Prompt {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: number;
  prompt_id: number;
  version_number: number;
  product: string;
  process?: string;
  performance?: string;
  answers?: string;
  final_prompt?: string;
  product_score?: number;
  process_score?: number;
  performance_score?: number;
  total_score?: number;
  percentage_score?: number;
  strengths?: string;
  critical_missing?: string;
  questions?: string;
  created_at: string;
}

export interface PromptWithVersion {
  prompt: Prompt;
  latestVersion: PromptVersion | null;
}

// Evaluation types
export interface SuggestedAnswer {
  technical: string;
  simple: string;
}

export interface ContextDescription {
  what: string;
  why: string;
}

export interface EvaluationQuestion {
  question: string;
  questionSimple: string;
  why: string;
  dimension: 'product' | 'process' | 'performance';
  contextDescription: ContextDescription;
  suggestedAnswers: SuggestedAnswer[];
  answerType: 'mutually_exclusive' | 'independent';
}

export interface EvaluationResult {
  productScore: number;
  processScore: number;
  performanceScore: number;
  totalScore: number;
  percentageScore: number;
  strengths: string[];
  criticalMissing: string[];
  questions: EvaluationQuestion[];
  changeExplanation?: string;
}

export interface EvaluateRequest {
  product: string;
  process?: string;
  performance?: string;
  answers?: Record<string, string>;
  isReevaluation?: boolean;
  previousScore?: number;
}

export interface GenerateRequest {
  product: string;
  process?: string;
  performance?: string;
  answers?: Record<string, string>;
}

export interface GenerationResult {
  prompt: string;
  metadata: {
    wordCount: number;
    hasProduct: boolean;
    hasProcess: boolean;
    hasPerformance: boolean;
    answerCount: number;
  };
}

// Complexity types
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

export interface ComplexityResult {
  level: ComplexityLevel;
  score: number;
  indicators: string[];
  recommendedQuestions: number;
}

// Score evolution
export interface ScoreEvolutionItem {
  version_number: number;
  total_score: number | null;
  created_at: string;
}
