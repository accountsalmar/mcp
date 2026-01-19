/**
 * Pattern Service - Context-Aware Embedding Narratives
 *
 * Loads, caches, and applies narrative patterns for embedding generation.
 * Replaces generic field-dump encoding with business-context-aware narratives.
 *
 * Example:
 *   Current: "In model customer, record 42: name=Acme Corp, country_id=5, revenue=450000"
 *   New:     "Customer 'Acme Corp' based in Australia with $450,000.00 revenue."
 *
 * Usage:
 *   const result = applyPatternToRecord(record, fields, modelName);
 *   if (result.applied) {
 *     const narrative = result.narrative;  // Use for embedding
 *   } else {
 *     // Fall back to legacy encoding
 *   }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  NarrativePattern,
  FieldFormatter,
  PatternApplicationResult,
  PipelineField,
} from '../types.js';
import { PATTERN_CONFIG } from '../constants.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// MODULE STATE
// =============================================================================

/** Track which models have had pattern load attempted */
const patternsLoadAttempted = new Map<string, boolean>();

/** Cache loaded patterns (null means file didn't exist or was invalid) */
const patternCache = new Map<string, NarrativePattern | null>();

// =============================================================================
// PATH RESOLUTION
// =============================================================================

/**
 * Get the directory where pattern files are stored
 */
function getPatternsDir(): string {
  const paths = [
    join(process.cwd(), PATTERN_CONFIG.PATTERNS_DIR),
    join(process.cwd(), '..', PATTERN_CONFIG.PATTERNS_DIR),
    join(__dirname, '..', '..', '..', PATTERN_CONFIG.PATTERNS_DIR),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Return default path (will be created if needed during save)
  return paths[0];
}

/**
 * Get the path to a pattern file for a specific model
 *
 * @param modelName - Model name (e.g., "customer", "actual")
 * @returns Full path to the pattern JSON file
 */
export function getPatternFilePath(modelName: string): string {
  const patternsDir = getPatternsDir();
  // Normalize model name: replace dots with underscores
  const normalizedName = modelName.replace(/\./g, '_');
  return join(patternsDir, `${normalizedName}.json`);
}

/**
 * Check if a pattern file exists for a model
 *
 * @param modelName - Model name to check
 * @returns True if pattern file exists
 */
export function patternExists(modelName: string): boolean {
  const patternPath = getPatternFilePath(modelName);
  return existsSync(patternPath);
}

// =============================================================================
// PATTERN LOADING
// =============================================================================

/**
 * Load narrative pattern for a model
 *
 * Lazily loaded on first access. Returns null if file doesn't exist
 * or is invalid (this is not a fatal error - just means legacy
 * encoding will be used).
 *
 * @param modelName - Model name (e.g., "customer")
 * @returns Pattern if found and valid, null otherwise
 */
export function loadPattern(modelName: string): NarrativePattern | null {
  // Check if already attempted
  if (patternsLoadAttempted.get(modelName)) {
    return patternCache.get(modelName) ?? null;
  }

  patternsLoadAttempted.set(modelName, true);

  const patternPath = getPatternFilePath(modelName);

  if (!existsSync(patternPath)) {
    // Silent - pattern not existing is normal (uses legacy encoding)
    patternCache.set(modelName, null);
    return null;
  }

  try {
    const content = readFileSync(patternPath, 'utf-8');
    const pattern = JSON.parse(content) as NarrativePattern;

    // Basic validation
    if (!pattern.model || !pattern.core_narrative?.template) {
      console.error(
        `[PatternService] Invalid pattern for ${modelName}: missing required fields`
      );
      patternCache.set(modelName, null);
      return null;
    }

    patternCache.set(modelName, pattern);
    console.error(
      `[PatternService] Loaded pattern for ${modelName} (${pattern.core_narrative.key_fields.length} key fields)`
    );
    return pattern;
  } catch (error) {
    console.error(
      `[PatternService] Failed to load pattern for ${modelName}: ${error}`
    );
    patternCache.set(modelName, null);
    return null;
  }
}

/**
 * Force reload a pattern (useful after pattern file changes)
 *
 * @param modelName - Model name to reload
 * @returns Reloaded pattern or null
 */
export function reloadPattern(modelName: string): NarrativePattern | null {
  patternsLoadAttempted.delete(modelName);
  patternCache.delete(modelName);
  return loadPattern(modelName);
}

/**
 * Clear all cached patterns (useful for testing)
 */
export function clearPatternCache(): void {
  patternsLoadAttempted.clear();
  patternCache.clear();
}

// =============================================================================
// FIELD FORMATTERS
// =============================================================================

/**
 * Apply a formatter to a value
 *
 * @param value - Raw value from record
 * @param fieldType - Field type from schema (for context)
 * @param formatter - Formatter to apply
 * @returns Formatted string
 */
export function applyFormatter(
  value: unknown,
  fieldType: string,
  formatter: FieldFormatter
): string {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return '';
  }

  switch (formatter) {
    case 'currency':
      return formatCurrency(value);

    case 'readable_date':
      return formatReadableDate(value);

    case 'name':
      return extractName(value);

    case 'percentage':
      return formatPercentage(value);

    case 'count_with_summary':
      return formatCountWithSummary(value);

    case 'boolean_yes_no':
      return formatBoolean(value);

    case 'truncate_50':
      return truncateText(value, 50);

    case 'truncate_100':
      return truncateText(value, 100);

    case 'default':
    default:
      return formatDefault(value);
  }
}

/**
 * Format as currency (e.g., 20000 → "$20,000.00")
 */
function formatCurrency(value: unknown): string {
  const num = parseNumericValue(value);
  if (num === null) return String(value);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format as readable date (e.g., 2026-01-01 → "January 1, 2026")
 */
function formatReadableDate(value: unknown): string {
  let date: Date | null = null;

  // Handle different input formats
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Could be Unix timestamp (ms) or Excel serial date
    if (value > 2000000000) {
      // Likely milliseconds
      date = new Date(value);
    } else if (value > 25569) {
      // Excel serial date (days since 1900-01-01, with 25569 being 1970-01-01)
      date = new Date((value - 25569) * 86400 * 1000);
    } else {
      date = new Date(value);
    }
  } else if (typeof value === 'string') {
    date = new Date(value);
  }

  if (!date || isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Extract name from FK tuple (e.g., [123, "Ben Ross"] → "Ben Ross")
 */
function extractName(value: unknown): string {
  // Array format: [id, "name"]
  if (Array.isArray(value) && value.length >= 2) {
    return String(value[1]);
  }

  // Object with name property
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return String((value as { name: unknown }).name);
  }

  // Already a string
  if (typeof value === 'string') {
    return value;
  }

  return String(value);
}

/**
 * Format as percentage (e.g., 75 → "75%")
 */
function formatPercentage(value: unknown): string {
  const num = parseNumericValue(value);
  if (num === null) return String(value);
  return `${num}%`;
}

/**
 * Format array with count and summary (e.g., [{name: "Widget"}, ...] → "3 items: Widget, Gadget, Tool")
 */
function formatCountWithSummary(value: unknown): string {
  if (!Array.isArray(value)) {
    return String(value);
  }

  const count = value.length;
  if (count === 0) return 'none';

  // Extract names from objects
  const names = value.slice(0, 5).map((item) => {
    if (typeof item === 'object' && item !== null && 'name' in item) {
      return String((item as { name: unknown }).name);
    }
    return String(item);
  });

  const summary = names.join(', ');
  const suffix = count > 5 ? ` (and ${count - 5} more)` : '';

  return `${count} items: ${summary}${suffix}`;
}

/**
 * Format boolean as Yes/No
 */
function formatBoolean(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['true', 'yes', '1', 'y'].includes(lower)) return 'Yes';
    if (['false', 'no', '0', 'n'].includes(lower)) return 'No';
  }
  if (typeof value === 'number') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

/**
 * Truncate text to specified length
 */
function truncateText(value: unknown, maxLength: number): string {
  const text = String(value);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Default string conversion
 */
function formatDefault(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Parse a value as a number (handles strings with currency symbols, commas, etc.)
 */
function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and spaces
    const cleaned = value.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

// =============================================================================
// TEMPLATE APPLICATION
// =============================================================================

/**
 * Apply a template to a record, replacing placeholders with formatted values
 *
 * Template syntax: {field_name} or {field_name:formatter}
 * Examples:
 *   - {name} → Uses default formatter
 *   - {revenue:currency} → Uses currency formatter
 *   - {partner_id:name} → Extracts name from FK tuple
 *
 * @param template - Template string with placeholders
 * @param record - Record data
 * @param fields - Field definitions from schema
 * @param formatters - Map of field names to formatters
 * @returns Applied template with formatted values and metadata
 */
export function applyTemplate(
  template: string,
  record: Record<string, unknown>,
  fields: PipelineField[],
  formatters: Record<string, FieldFormatter>
): { result: string; fieldsUsed: string[]; fieldsSkipped: string[] } {
  const fieldsUsed: string[] = [];
  const fieldsSkipped: string[] = [];

  // Build field type lookup
  const fieldTypes = new Map<string, string>();
  for (const field of fields) {
    fieldTypes.set(field.field_name, field.field_type);
  }

  // Match {field_name} or {field_name:formatter}
  const placeholderRegex = /\{([^}:]+)(?::([^}]+))?\}/g;

  const result = template.replace(placeholderRegex, (match, fieldName, inlineFormatter) => {
    const value = record[fieldName];

    // Handle missing values
    if (value === null || value === undefined || value === '') {
      fieldsSkipped.push(fieldName);
      return ''; // Remove placeholder entirely
    }

    fieldsUsed.push(fieldName);

    // Determine formatter: inline > pattern-defined > default
    let formatter: FieldFormatter = 'default';
    if (inlineFormatter && isValidFormatter(inlineFormatter)) {
      formatter = inlineFormatter as FieldFormatter;
    } else if (formatters[fieldName]) {
      formatter = formatters[fieldName];
    }

    const fieldType = fieldTypes.get(fieldName) || 'unknown';
    return applyFormatter(value, fieldType, formatter);
  });

  // Clean up multiple spaces and trim
  const cleanedResult = result.replace(/\s+/g, ' ').trim();

  return { result: cleanedResult, fieldsUsed, fieldsSkipped };
}

/**
 * Check if a string is a valid formatter name
 */
function isValidFormatter(name: string): name is FieldFormatter {
  return [
    'currency',
    'readable_date',
    'name',
    'percentage',
    'count_with_summary',
    'truncate_50',
    'truncate_100',
    'boolean_yes_no',
    'default',
  ].includes(name);
}

// =============================================================================
// PATTERN APPLICATION
// =============================================================================

/**
 * Apply a narrative pattern to a record
 *
 * This is the main entry point for pattern-based encoding.
 * Returns a PatternApplicationResult indicating whether the pattern was applied
 * and the generated narrative.
 *
 * @param record - Record data
 * @param fields - Field definitions from schema
 * @param modelName - Model name to load pattern for
 * @returns Result with narrative or fallback indication
 */
export function applyPatternToRecord(
  record: Record<string, unknown>,
  fields: PipelineField[],
  modelName: string
): PatternApplicationResult {
  // Check if patterns are enabled
  if (!PATTERN_CONFIG.ENABLED) {
    return {
      applied: false,
      narrative: '',
      fieldsUsed: [],
      fieldsSkipped: [],
      warnings: ['Pattern encoding disabled via PATTERN_ENCODING_ENABLED=false'],
    };
  }

  // Load pattern
  const pattern = loadPattern(modelName);
  if (!pattern) {
    return {
      applied: false,
      narrative: '',
      fieldsUsed: [],
      fieldsSkipped: [],
      warnings: [`No pattern found for model ${modelName}`],
    };
  }

  const warnings: string[] = [];

  // Apply core narrative template
  const { result: coreNarrative, fieldsUsed, fieldsSkipped } = applyTemplate(
    pattern.core_narrative.template,
    record,
    fields,
    pattern.core_narrative.field_formatters
  );

  // Build dynamic appendix (non-template fields)
  const dynamicParts: string[] = [];
  const excludeFields = new Set([
    ...pattern.core_narrative.key_fields,
    ...pattern.dynamic_appendix.exclude,
    'id',
    'record_id',
    '__last_update',
    'create_uid',
    'create_date',
    'write_uid',
    'write_date',
  ]);

  for (const field of fields) {
    if (excludeFields.has(field.field_name)) continue;

    const value = record[field.field_name];
    if (value === null || value === undefined || value === '') continue;

    // Format the value (use default formatter)
    const formattedValue = applyFormatter(value, field.field_type, 'default');
    if (formattedValue) {
      // Use field label if available, otherwise field name
      const label = field.field_label || field.field_name;
      dynamicParts.push(`${label}: ${formattedValue}`);
      fieldsUsed.push(field.field_name);
    }
  }

  // Combine narrative parts
  let fullNarrative = coreNarrative;

  if (dynamicParts.length > 0) {
    const appendixPrefix = pattern.dynamic_appendix.prefix || 'Additional details:';
    fullNarrative += ` ${appendixPrefix} ${dynamicParts.join(', ')}`;
  }

  // Truncate if needed
  if (fullNarrative.length > PATTERN_CONFIG.MAX_NARRATIVE_LENGTH) {
    fullNarrative = fullNarrative.substring(0, PATTERN_CONFIG.MAX_NARRATIVE_LENGTH - 3) + '...';
    warnings.push(`Narrative truncated to ${PATTERN_CONFIG.MAX_NARRATIVE_LENGTH} characters`);
  }

  return {
    applied: true,
    narrative: fullNarrative,
    fieldsUsed,
    fieldsSkipped,
    warnings,
  };
}

// =============================================================================
// PATTERN SAVING
// =============================================================================

/**
 * Save a pattern to file
 *
 * Creates the patterns directory if it doesn't exist.
 *
 * @param pattern - Pattern to save
 */
export function savePattern(pattern: NarrativePattern): void {
  const patternsDir = getPatternsDir();

  // Ensure directory exists
  if (!existsSync(patternsDir)) {
    mkdirSync(patternsDir, { recursive: true });
    console.error(`[PatternService] Created patterns directory: ${patternsDir}`);
  }

  const patternPath = getPatternFilePath(pattern.model);

  // Add metadata if not present
  if (!pattern.generated_at) {
    pattern.generated_at = new Date().toISOString();
  }
  if (!pattern.version) {
    pattern.version = PATTERN_CONFIG.VERSION;
  }

  const content = JSON.stringify(pattern, null, 2);
  writeFileSync(patternPath, content, 'utf-8');

  // Update cache
  patternCache.set(pattern.model, pattern);
  patternsLoadAttempted.set(pattern.model, true);

  console.error(
    `[PatternService] Saved pattern for ${pattern.model} to ${patternPath}`
  );
}

// =============================================================================
// STATUS / DEBUGGING
// =============================================================================

/**
 * Get pattern service status (for debugging)
 */
export function getPatternServiceStatus(): {
  enabled: boolean;
  patternsDir: string;
  loadedPatterns: string[];
  cachedNulls: string[];
} {
  const loadedPatterns: string[] = [];
  const cachedNulls: string[] = [];

  for (const [model, pattern] of patternCache) {
    if (pattern) {
      loadedPatterns.push(model);
    } else {
      cachedNulls.push(model);
    }
  }

  return {
    enabled: PATTERN_CONFIG.ENABLED,
    patternsDir: getPatternsDir(),
    loadedPatterns,
    cachedNulls,
  };
}
