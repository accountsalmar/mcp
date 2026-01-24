import type { ComplexityLevel, ComplexityResult } from '../types/evaluation.types.js';

/**
 * Indicators for different complexity levels
 */
const COMPLEXITY_INDICATORS = {
  complex: [
    /multi[-\s]?step/i,
    /comprehensive/i,
    /integration/i,
    /system/i,
    /architecture/i,
    /framework/i,
    /workflow/i,
    /enterprise/i,
    /scalable/i,
    /distributed/i,
    /complex/i,
    /advanced/i,
    /multiple\s+(?:components?|parts?|phases?)/i,
  ],
  moderate: [
    /template/i,
    /format/i,
    /structure/i,
    /analysis/i,
    /report/i,
    /document/i,
    /review/i,
    /compare/i,
    /evaluate/i,
    /assess/i,
  ],
  simple: [
    /simple/i,
    /quick/i,
    /brief/i,
    /short/i,
    /basic/i,
    /single/i,
    /one/i,
    /just/i,
  ],
};

/**
 * Question counts for each complexity level
 * Based on 4D Framework adaptive depth:
 * - Product: always 5 questions (full depth)
 * - Process: 2-5 questions (adaptive)
 * - Performance: 2-5 questions (adaptive)
 */
const QUESTION_COUNTS: Record<ComplexityLevel, number> = {
  simple: 9,     // 5 + 2 + 2
  moderate: 12,  // 5 + 3-4 + 3-4
  complex: 15,   // 5 + 5 + 5
};

/**
 * Calculate complexity score based on text analysis
 */
function calculateComplexityScore(text: string): {
  score: number;
  indicators: string[];
} {
  const indicators: string[] = [];
  let score = 5; // Start at middle

  // Check for complex indicators (increase score)
  for (const pattern of COMPLEXITY_INDICATORS.complex) {
    const match = text.match(pattern);
    if (match) {
      score += 1;
      indicators.push(`Complex: "${match[0]}"`);
    }
  }

  // Check for moderate indicators (slight increase)
  for (const pattern of COMPLEXITY_INDICATORS.moderate) {
    const match = text.match(pattern);
    if (match) {
      score += 0.5;
      indicators.push(`Moderate: "${match[0]}"`);
    }
  }

  // Check for simple indicators (decrease score)
  for (const pattern of COMPLEXITY_INDICATORS.simple) {
    const match = text.match(pattern);
    if (match) {
      score -= 1;
      indicators.push(`Simple: "${match[0]}"`);
    }
  }

  // Factor in text length
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 100) {
    score += 1;
    indicators.push(`Long text: ${wordCount} words`);
  } else if (wordCount < 20) {
    score -= 1;
    indicators.push(`Short text: ${wordCount} words`);
  }

  // Clamp score to 0-10 range
  score = Math.min(10, Math.max(0, score));

  return { score, indicators };
}

/**
 * Convert score to complexity level
 */
function scoreToLevel(score: number): ComplexityLevel {
  if (score <= 3) return 'simple';
  if (score <= 6) return 'moderate';
  return 'complex';
}

/**
 * Detect the complexity level of a prompt
 *
 * Complexity affects adaptive depth:
 * - Simple (0-3): 9 total questions
 * - Moderate (4-6): 11-13 total questions
 * - Complex (7-10): 15 total questions
 */
export function detectComplexity(text: string): ComplexityResult {
  const { score, indicators } = calculateComplexityScore(text);
  const level = scoreToLevel(score);

  console.log(`[Complexity] Detected: ${level} (score: ${score})`);

  return {
    level,
    score,
    indicators,
    recommendedQuestions: QUESTION_COUNTS[level],
  };
}

/**
 * Get question count for a complexity level
 */
export function getQuestionCount(level: ComplexityLevel): number {
  return QUESTION_COUNTS[level];
}

/**
 * Validate and normalize a complexity level
 */
export function normalizeComplexity(input: string): ComplexityLevel {
  const normalized = input.toLowerCase().trim();
  if (normalized === 'simple' || normalized === 'moderate' || normalized === 'complex') {
    return normalized;
  }
  return 'moderate'; // Default
}
