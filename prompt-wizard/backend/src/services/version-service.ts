import { getDatabase } from '../config/database.js';
import type { PromptVersion, EvaluationResult } from '../types/evaluation.types.js';

export interface CreateVersionInput {
  promptId: number;
  product: string;
  process?: string;
  performance?: string;
  answers?: Record<string, string>;
  finalPrompt?: string;
  evaluation?: EvaluationResult;
}

/**
 * Create a new version for a prompt
 * Auto-increments version_number
 */
export function createVersion(input: CreateVersionInput): PromptVersion {
  const db = getDatabase();

  // Get the next version number
  const maxVersionStmt = db.prepare(`
    SELECT COALESCE(MAX(version_number), 0) as max_version
    FROM prompt_versions
    WHERE prompt_id = ?
  `);
  const { max_version } = maxVersionStmt.get(input.promptId) as { max_version: number };
  const newVersionNumber = max_version + 1;

  const insertStmt = db.prepare(`
    INSERT INTO prompt_versions (
      prompt_id, version_number,
      product, process, performance,
      answers, final_prompt,
      product_score, process_score, performance_score,
      total_score, percentage_score,
      strengths, critical_missing, questions
    ) VALUES (
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?
    )
    RETURNING *
  `);

  const eval_ = input.evaluation;

  return insertStmt.get(
    input.promptId,
    newVersionNumber,
    input.product,
    input.process || null,
    input.performance || null,
    input.answers ? JSON.stringify(input.answers) : null,
    input.finalPrompt || null,
    eval_?.productScore ?? null,
    eval_?.processScore ?? null,
    eval_?.performanceScore ?? null,
    eval_?.totalScore ?? null,
    eval_?.percentageScore ?? null,
    eval_?.strengths ? JSON.stringify(eval_.strengths) : null,
    eval_?.criticalMissing ? JSON.stringify(eval_.criticalMissing) : null,
    eval_?.questions ? JSON.stringify(eval_.questions) : null
  ) as PromptVersion;
}

/**
 * Get all versions for a prompt
 */
export function getVersionsByPromptId(promptId: number): PromptVersion[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT *
    FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version_number DESC
  `);

  return stmt.all(promptId) as PromptVersion[];
}

/**
 * Get a specific version
 */
export function getVersion(promptId: number, versionNumber: number): PromptVersion | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT *
    FROM prompt_versions
    WHERE prompt_id = ? AND version_number = ?
  `);

  return (stmt.get(promptId, versionNumber) as PromptVersion) || null;
}

/**
 * Get the latest version for a prompt
 */
export function getLatestVersion(promptId: number): PromptVersion | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT *
    FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version_number DESC
    LIMIT 1
  `);

  return (stmt.get(promptId) as PromptVersion) || null;
}

/**
 * Get score evolution for a prompt
 */
export function getScoreEvolution(promptId: number): Array<{
  version_number: number;
  total_score: number | null;
  created_at: string;
}> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT version_number, total_score, created_at
    FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version_number ASC
  `);

  return stmt.all(promptId) as Array<{
    version_number: number;
    total_score: number | null;
    created_at: string;
  }>;
}

/**
 * Delete a specific version
 */
export function deleteVersion(promptId: number, versionNumber: number): boolean {
  const db = getDatabase();

  const stmt = db.prepare(`
    DELETE FROM prompt_versions
    WHERE prompt_id = ? AND version_number = ?
  `);

  const result = stmt.run(promptId, versionNumber);
  return result.changes > 0;
}

/**
 * Parse JSON fields in a version record
 */
export function parseVersionFields(version: PromptVersion): PromptVersion & {
  answersObj?: Record<string, string>;
  strengthsArr?: string[];
  criticalMissingArr?: string[];
  questionsArr?: unknown[];
} {
  return {
    ...version,
    answersObj: version.answers ? JSON.parse(version.answers) : undefined,
    strengthsArr: version.strengths ? JSON.parse(version.strengths) : undefined,
    criticalMissingArr: version.critical_missing ? JSON.parse(version.critical_missing) : undefined,
    questionsArr: version.questions ? JSON.parse(version.questions) : undefined,
  };
}
