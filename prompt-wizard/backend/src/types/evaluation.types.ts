// Input types for the 4P Framework
export interface PromptInput {
  product: string;
  process?: string;
  performance?: string;
  answers?: Record<string, string>;
}

// Suggested answer with technical and plain English versions
export interface SuggestedAnswer {
  technical: string;
  simple: string;
}

// Context description for why a question matters
export interface ContextDescription {
  what: string;
  why: string;
}

// Rich question format with learning-friendly explanations
export interface EvaluationQuestion {
  question: string;
  questionSimple: string;
  why: string;
  dimension: 'product' | 'process' | 'performance';
  contextDescription: ContextDescription;
  suggestedAnswers: SuggestedAnswer[];
  answerType: 'mutually_exclusive' | 'independent';
}

// Full evaluation result from Claude
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

// Complexity levels for adaptive depth
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

// Complexity detection result
export interface ComplexityResult {
  level: ComplexityLevel;
  score: number;
  indicators: string[];
  recommendedQuestions: number;
}

// Prompt generation result
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

// Database models
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
