/**
 * Robust JSON parser with 4 fallback strategies
 * Ported from prompt-wizard.html artifact (lines 432-519)
 */

/**
 * Strategy 1: Find matching closing brace for proper JSON extraction
 */
function findMatchingBrace(str: string, start: number): number {
  if (start === -1) return str.lastIndexOf('}');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const c = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (c === '\\') {
      escape = true;
      continue;
    }

    if (c === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }

  return str.lastIndexOf('}');
}

/**
 * Strategy 4: Fix newlines inside string values
 */
function fixNewlinesInStrings(json: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < json.length; i++) {
    const c = json[i];

    if (escape) {
      result += c;
      escape = false;
      continue;
    }

    if (c === '\\') {
      result += c;
      escape = true;
      continue;
    }

    if (c === '"') {
      inString = !inString;
      result += c;
      continue;
    }

    if (inString && c === '\n') {
      result += '\\n';
      continue;
    }

    result += c;
  }

  return result;
}

/**
 * Fallback: Extract values manually when all parsing strategies fail
 */
function extractValuesManually(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {
    productScore: 5,
    processScore: 5,
    performanceScore: 5,
    totalScore: 15,
    percentageScore: 50,
    strengths: ['Clear intent'],
    criticalMissing: ['More specifics needed'],
    questions: [
      {
        question: 'What specific output format do you need?',
        questionSimple: 'What should the final result look like?',
        why: 'Helps AI understand exact expectations',
        dimension: 'product',
        contextDescription: {
          what: 'Output format defines structure',
          why: 'Reduces revisions needed',
        },
        suggestedAnswers: [
          { technical: 'Structured markdown with headers', simple: 'Organized with clear sections' },
          { technical: 'Conversational prose format', simple: 'Written like a natural conversation' },
          { technical: 'Bullet-point summary', simple: 'Quick scannable list' },
        ],
        answerType: 'mutually_exclusive',
      },
    ],
  };

  // Try to extract scores from the text
  const productMatch = text.match(/"productScore"\s*:\s*(\d+)/);
  if (productMatch) result.productScore = parseInt(productMatch[1], 10);

  const processMatch = text.match(/"processScore"\s*:\s*(\d+)/);
  if (processMatch) result.processScore = parseInt(processMatch[1], 10);

  const performanceMatch = text.match(/"performanceScore"\s*:\s*(\d+)/);
  if (performanceMatch) result.performanceScore = parseInt(performanceMatch[1], 10);

  result.totalScore = (result.productScore as number) + (result.processScore as number) + (result.performanceScore as number);
  result.percentageScore = Math.round((result.totalScore as number) / 30 * 100);

  return result;
}

/**
 * Parse JSON with 4 fallback strategies
 *
 * Strategy 1: Direct JSON.parse
 * Strategy 2: Clean markdown code blocks and find JSON boundaries
 * Strategy 3: Fix common JSON issues (trailing commas, control chars)
 * Strategy 4: Fix newlines in strings
 * Fallback: Extract values manually
 */
export function parseJSON<T = unknown>(text: string): T {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Clean markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Find JSON boundaries
  const start = cleaned.indexOf('{');
  const end = findMatchingBrace(cleaned, start);

  if (start === -1 || end === -1) {
    console.warn('[JSON Parser] No JSON object found, using manual extraction');
    return extractValuesManually(text) as T;
  }

  cleaned = cleaned.substring(start, end + 1);

  // Strategy 3: Fix common issues
  cleaned = cleaned
    .replace(/,\s*}/g, '}')      // Remove trailing commas before }
    .replace(/,\s*]/g, ']')      // Remove trailing commas before ]
    .replace(/[\x00-\x1F]/g, ' '); // Remove control characters

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue to next strategy
  }

  // Strategy 4: Fix newlines in strings
  cleaned = fixNewlinesInStrings(cleaned);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('[JSON Parser] All strategies failed, using manual extraction');
    console.warn('[JSON Parser] Last error:', error);
    return extractValuesManually(cleaned) as T;
  }
}

/**
 * Safe JSON stringify with error handling
 */
export function safeStringify(obj: unknown, pretty = false): string {
  try {
    return JSON.stringify(obj, null, pretty ? 2 : 0);
  } catch (error) {
    console.error('[JSON Parser] Stringify error:', error);
    return '{}';
  }
}
