import { callClaude } from './claude-api.js';
import { parseJSON } from '../utils/json-parser.js';
import type { PromptInput, EvaluationResult } from '../types/evaluation.types.js';

/**
 * Build the evaluation prompt with the 30-point rubric
 * Ported from prompt-wizard.html artifact (lines 564-577)
 */
function buildEvaluationPrompt(
  input: PromptInput,
  isReevaluation: boolean,
  previousScore?: number
): string {
  // Build the current prompt text
  let additionalContext = '';
  if (input.answers) {
    for (const [key, value] of Object.entries(input.answers)) {
      additionalContext += `Q: ${key}\nA: ${value}\n\n`;
    }
  }

  const currentPrompt = `ORIGINAL PROMPT:
Product Description: ${input.product}
Process Description: ${input.process || '(Not specified)'}
Performance Description: ${input.performance || '(Not specified)'}${additionalContext ? `\n\nREFINEMENTS FROM USER ANSWERS:\n${additionalContext}` : ''}`;

  const iterationNumber = input.answers
    ? Math.floor(Object.keys(input.answers).length / 3) + 1
    : 1;

  let evaluationPrompt = `You are evaluating a prompt using the 4D Framework's Description competency with a 30-point scoring system.

PROMPT TO EVALUATE:
"""
${currentPrompt}
"""

IMPORTANT: Evaluate the COMPLETE prompt including both the original descriptions AND any refinements provided.

ITERATION CONTEXT: This is iteration ${iterationNumber} of refinement.`;

  // Add re-evaluation instructions if this is a re-evaluation
  if (isReevaluation && previousScore !== undefined) {
    evaluationPrompt += `

CRITICAL RE-EVALUATION INSTRUCTIONS:
PREVIOUS TOTAL SCORE: ${previousScore}/30

RE-EVALUATION RULES:
1. RECOGNIZE IMPROVEMENTS: If the user added relevant information, INCREASE the score
2. BE FAIR: Compare to previous version - if improved, score MUST go up
3. ONLY MAINTAIN OR INCREASE: Scores should NEVER decrease unless contradictory info added
4. MINIMUM IMPROVEMENT: If substantive answers provided, total should increase by 2-4 points
5. EXPLAIN CHANGES: In changeExplanation, state what improved and why`;
  }

  // Add the full 30-point rubric
  evaluationPrompt += `

EVALUATION RUBRIC (30 points total):

PRODUCT DESCRIPTION (10 points max):
- Output Format (2 pts): 0=absent, 1=implied, 2=explicit
- Length/Scope (2 pts): 0=open-ended, 1=general, 2=specific bounds
- Audience (2 pts): 0=unspecified, 1=implied, 2=explicit with context
- Style/Tone (2 pts): 0=absent, 1=generic, 2=specific requirements
- Context (2 pts): 0=minimal, 1=basic, 2=comprehensive

PROCESS DESCRIPTION (10 points max):
- Methodology (2 pts): 0=none, 1=implied approach, 2=explicit framework
- Sequential Steps (2 pts): 0=none, 1=general, 2=clear sequence
- Reasoning (2 pts): 0=none, 1=basic, 2=explicit reasoning instructions
- Tools/Resources (2 pts): 0=none, 1=implied, 2=explicitly specified
- Validation (2 pts): 0=none, 1=general, 2=specific quality checks

PERFORMANCE DESCRIPTION (10 points max):
- Role/Expertise (2 pts): 0=generic AI, 1=general role, 2=specific persona
- Interaction Style (2 pts): 0=unspecified, 1=basic tone, 2=detailed style
- Detail Level (2 pts): 0=unspecified, 1=general, 2=explicit depth
- Adaptability (2 pts): 0=rigid, 1=some flexibility, 2=clear adaptation guidance
- Constraints (2 pts): 0=none, 1=general, 2=specific behavioral boundaries

`;

  // Add response format
  evaluationPrompt += `Respond with ONLY valid JSON (no markdown, no backticks):

{
  "productScore": 0-10,
  "processScore": 0-10,
  "performanceScore": 0-10,
  "totalScore": 0-30,
  "percentageScore": 0-100,
  "strengths": ["strength 1", "strength 2"],
  "criticalMissing": ["missing 1", "missing 2"],${isReevaluation ? '\n  "changeExplanation": "What improved and why scores changed",' : ''}
  "questions": [
    {
      "question": "Technical question using prompt engineering terms",
      "questionSimple": "Same question in plain English",
      "why": "Why this matters",
      "dimension": "product|process|performance",
      "contextDescription": {
        "what": "Brief concept explanation (max 25 words)",
        "why": "Direct impact on outcomes (max 25 words)"
      },
      "suggestedAnswers": [
        {"technical": "Technical option", "simple": "Plain English explanation"},
        {"technical": "Technical option", "simple": "Plain English explanation"},
        {"technical": "Technical option", "simple": "Plain English explanation"}
      ],
      "answerType": "mutually_exclusive|independent"
    }
  ]
}

Generate 2-3 questions if score < 25. Empty questions array if score >= 25.
Be strict - most initial prompts score 8-15/30.`;

  return evaluationPrompt;
}

/**
 * Normalize scores to valid ranges
 */
function normalizeResult(result: EvaluationResult): EvaluationResult {
  result.productScore = Math.min(10, Math.max(0, parseInt(String(result.productScore)) || 5));
  result.processScore = Math.min(10, Math.max(0, parseInt(String(result.processScore)) || 5));
  result.performanceScore = Math.min(10, Math.max(0, parseInt(String(result.performanceScore)) || 5));
  result.totalScore = result.productScore + result.processScore + result.performanceScore;
  result.percentageScore = Math.round(result.totalScore / 30 * 100);
  result.strengths = result.strengths || [];
  result.criticalMissing = result.criticalMissing || [];
  result.questions = result.questions || [];

  return result;
}

/**
 * Evaluate a prompt using the 4D Framework's 30-point rubric
 */
export async function evaluatePrompt(
  input: PromptInput,
  options: {
    isReevaluation?: boolean;
    previousScore?: number;
  } = {}
): Promise<EvaluationResult> {
  const { isReevaluation = false, previousScore } = options;

  console.log(`[Evaluation] Starting evaluation (re-eval: ${isReevaluation}, prev: ${previousScore})`);

  const prompt = buildEvaluationPrompt(input, isReevaluation, previousScore);
  const response = await callClaude(prompt, { maxTokens: 3000 });

  const result = parseJSON<EvaluationResult>(response);
  const normalized = normalizeResult(result);

  console.log(`[Evaluation] Complete: ${normalized.totalScore}/30`);
  return normalized;
}
