import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/environment.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }
  return client;
}

export interface ClaudeOptions {
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_OPTIONS: Required<ClaudeOptions> = {
  maxTokens: 4000,
  temperature: 0.7,
};

export async function callClaude(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const anthropic = getClient();

  console.log(`[Claude API] Calling with ${prompt.length} chars, maxTokens=${opts.maxTokens}`);

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: opts.maxTokens,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  console.log(`[Claude API] Response received: ${content.text.length} chars`);
  return content.text;
}

export function isApiConfigured(): boolean {
  return !!config.anthropicApiKey;
}
