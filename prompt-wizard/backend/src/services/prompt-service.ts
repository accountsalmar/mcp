import { getDatabase } from '../config/database.js';
import type { Prompt, PromptVersion } from '../types/evaluation.types.js';

/**
 * Create a new prompt
 */
export function createPrompt(name: string): Prompt {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO prompts (name) VALUES (?)
    RETURNING id, name, created_at, updated_at
  `);

  return stmt.get(name) as Prompt;
}

/**
 * Get all prompts
 */
export function getAllPrompts(): Prompt[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT id, name, created_at, updated_at
    FROM prompts
    ORDER BY updated_at DESC
  `);

  return stmt.all() as Prompt[];
}

/**
 * Get a prompt by ID
 */
export function getPromptById(id: number): Prompt | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT id, name, created_at, updated_at
    FROM prompts
    WHERE id = ?
  `);

  return (stmt.get(id) as Prompt) || null;
}

/**
 * Get a prompt by name
 */
export function getPromptByName(name: string): Prompt | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT id, name, created_at, updated_at
    FROM prompts
    WHERE name = ?
  `);

  return (stmt.get(name) as Prompt) || null;
}

/**
 * Update a prompt name
 */
export function updatePrompt(id: number, name: string): Prompt | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE prompts
    SET name = ?
    WHERE id = ?
    RETURNING id, name, created_at, updated_at
  `);

  return (stmt.get(name, id) as Prompt) || null;
}

/**
 * Delete a prompt (cascade deletes versions)
 */
export function deletePrompt(id: number): boolean {
  const db = getDatabase();

  const stmt = db.prepare('DELETE FROM prompts WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Search prompts using full-text search
 */
export function searchPrompts(query: string): Prompt[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT p.id, p.name, p.created_at, p.updated_at
    FROM prompts p
    JOIN prompts_fts fts ON p.id = fts.rowid
    WHERE prompts_fts MATCH ?
    ORDER BY rank
  `);

  return stmt.all(query) as Prompt[];
}

/**
 * Get prompt with its latest version
 */
export function getPromptWithLatestVersion(id: number): {
  prompt: Prompt;
  latestVersion: PromptVersion | null;
} | null {
  const db = getDatabase();

  const prompt = getPromptById(id);
  if (!prompt) return null;

  const versionStmt = db.prepare(`
    SELECT *
    FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version_number DESC
    LIMIT 1
  `);

  const latestVersion = (versionStmt.get(id) as PromptVersion) || null;

  return { prompt, latestVersion };
}
