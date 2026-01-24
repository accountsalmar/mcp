import { callClaude } from './claude-api.js';
import type { PromptInput, GenerationResult } from '../types/evaluation.types.js';

/**
 * Build the generation prompt
 * Ported from prompt-wizard.html artifact (lines 524-546)
 */
function buildGenerationPrompt(input: PromptInput): string {
  let answersText = '';
  if (input.answers) {
    for (const [key, value] of Object.entries(input.answers)) {
      answersText += `Q: ${key}\nA: ${value}\n\n`;
    }
  }

  const rawPrompt = `ORIGINAL CONTEXT:
Product Description: ${input.product}
Process Description: ${input.process || '(Not specified)'}
Performance Description: ${input.performance || '(Not specified)'}${answersText ? `\n\nUSER REFINEMENTS:\n${answersText}` : ''}`;

  return `Create a polished prompt in MARKDOWN format based on this information.

INPUT:
"""
${rawPrompt}
"""

REQUIREMENTS:
1. Format as clean markdown with headers (##, ###)
2. Integrate all information naturally
3. Structure: Context → Task → Requirements → Output Specifications
4. Use markdown: **bold**, bullets, numbered lists
5. If information is missing, work with what's provided
6. Clear, specific, actionable
7. Ready for any LLM

Return ONLY the markdown prompt.`;
}

/**
 * Generate a polished prompt from the 4P Framework inputs
 */
export async function generatePrompt(input: PromptInput): Promise<GenerationResult> {
  console.log('[Generation] Starting prompt generation');

  const prompt = buildGenerationPrompt(input);

  let generatedPrompt: string;
  try {
    generatedPrompt = await callClaude(prompt, { maxTokens: 2000 });
    generatedPrompt = generatedPrompt.trim();
  } catch (error) {
    console.error('[Generation] Claude API error, using raw input:', error);
    // Fallback to raw format
    generatedPrompt = `## Product
${input.product}

${input.process ? `## Process\n${input.process}\n\n` : ''}${input.performance ? `## Performance\n${input.performance}` : ''}`;
  }

  const metadata = {
    wordCount: generatedPrompt.split(/\s+/).length,
    hasProduct: !!input.product,
    hasProcess: !!input.process,
    hasPerformance: !!input.performance,
    answerCount: input.answers ? Object.keys(input.answers).length : 0,
  };

  console.log(`[Generation] Complete: ${metadata.wordCount} words`);

  return {
    prompt: generatedPrompt,
    metadata,
  };
}

/**
 * Generate a simple raw prompt without Claude API (for preview)
 */
export function generateRawPrompt(input: PromptInput): string {
  let parts: string[] = [];

  if (input.product) {
    parts.push(`**Product:** ${input.product}`);
  }
  if (input.process) {
    parts.push(`**Process:** ${input.process}`);
  }
  if (input.performance) {
    parts.push(`**Performance:** ${input.performance}`);
  }

  if (input.answers) {
    parts.push('\n**Refinements:**');
    for (const [question, answer] of Object.entries(input.answers)) {
      parts.push(`- ${question}: ${answer}`);
    }
  }

  return parts.join('\n\n');
}
