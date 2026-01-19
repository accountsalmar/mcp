/**
 * JSON FK Detector Service
 *
 * Discovers JSON fields that may contain foreign key references.
 * Uses naming convention analysis and data sampling to calculate confidence scores.
 *
 * Detection Strategies:
 * 1. Naming patterns: *_distribution, *_ids suggest FK fields
 * 2. Non-FK patterns: *_search, *_settings excluded
 * 3. Data sampling: Analyze actual JSON data for numeric keys
 *
 * Usage:
 *   const results = await detectJsonFkFields({ modelFilter: 'crm.lead' });
 *   const configEntries = generateConfigEntries(results.candidates, 0.85);
 */

import { OdooClient, getOdooClient } from './odoo-client.js';
import { getQdrantClient, initializeVectorClient } from '../../common/services/vector-client.js';
import { hasJsonFkMapping } from '../../common/services/json-fk-config.js';
import type { JsonFkMapping } from '../../common/types.js';
import type { QdrantClient } from '@qdrant/js-client-rest';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectionCandidate {
  /** Source model name (e.g., "account.move.line") */
  sourceModel: string;
  /** Field name (e.g., "analytic_distribution") */
  fieldName: string;
  /** Detection confidence (0.0 - 1.0) */
  confidence: number;
  /** How the field was detected */
  detectionMethod: 'naming' | 'data_sampling' | 'both';
  /** Likely target model for FK keys (if detected) */
  likelyTargetModel?: string;
  /** Whether this is likely metadata (not FK) */
  isLikelyMetadata: boolean;
  /** Reasons for the classification */
  reasons: string[];
  /** Sample data analyzed (if any) */
  sampleData?: Record<string, unknown>[];
}

export interface DetectionOptions {
  /** Filter to specific model (optional) */
  modelFilter?: string;
  /** Minimum confidence to include (default: 0.0) */
  minConfidence?: number;
  /** Skip data sampling (faster, less accurate) */
  skipDataSampling?: boolean;
  /** Number of records to sample (default: 5) */
  sampleSize?: number;
  /** Include fields already in config */
  includeExisting?: boolean;
}

export interface DetectionResult {
  /** All detected candidates */
  candidates: DetectionCandidate[];
  /** Count of FK candidates */
  fkCount: number;
  /** Count of metadata candidates */
  metadataCount: number;
  /** Fields skipped (already in config) */
  skippedCount: number;
  /** Errors encountered */
  errors: string[];
}

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

/**
 * Patterns that strongly suggest FK fields
 * Higher weight = higher confidence boost
 */
const FK_PATTERNS: Array<{ pattern: RegExp; confidence: number; likelyTarget?: string }> = [
  // analytic_distribution fields -> account.analytic.account
  {
    pattern: /^analytic_distribution$/,
    confidence: 0.95,
    likelyTarget: 'account.analytic.account',
  },
  // Generic distribution patterns
  {
    pattern: /_distribution$/,
    confidence: 0.85,
    likelyTarget: 'account.analytic.account',
  },
  // _ids suffix often indicates M2M stored as JSON
  {
    pattern: /_ids$/,
    confidence: 0.7,
  },
  // tag-related fields
  {
    pattern: /_tag_ids$/,
    confidence: 0.8,
  },
];

/**
 * Patterns that indicate NON-FK fields (metadata, computed, UI)
 * These should be classified as metadata or excluded
 */
const NON_FK_PATTERNS: Array<{ pattern: RegExp; reason: string; exclude?: boolean }> = [
  // Computed search index fields - exclude entirely
  { pattern: /_search$/, reason: 'Computed search index', exclude: true },
  // UI/display fields
  { pattern: /^display_/, reason: 'Display helper field' },
  // Settings/config fields
  { pattern: /_settings$/, reason: 'Settings field' },
  { pattern: /_config$/, reason: 'Configuration field' },
  // Tracking/history fields
  { pattern: /_tracking$/, reason: 'Time tracking field' },
  { pattern: /_history$/, reason: 'History field' },
  { pattern: /_history_metadata$/, reason: 'History metadata field' },
  // UI widget state
  { pattern: /_widget$/, reason: 'UI widget state' },
  { pattern: /_command$/, reason: 'Widget command' },
  { pattern: /_values$/, reason: 'UI values/preferences' },
  // Error/state fields
  { pattern: /_errors$/, reason: 'Error details' },
  { pattern: /_state_details$/, reason: 'State details' },
  { pattern: /_info$/, reason: 'Info/metadata field' },
  // Address fields (JSON but not FK)
  { pattern: /_address$/, reason: 'Address details' },
];

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Check if a field name matches FK patterns
 */
function matchFkPattern(
  fieldName: string
): { confidence: number; likelyTarget?: string } | null {
  for (const { pattern, confidence, likelyTarget } of FK_PATTERNS) {
    if (pattern.test(fieldName)) {
      return { confidence, likelyTarget };
    }
  }
  return null;
}

/**
 * Check if a field name matches non-FK patterns
 */
function matchNonFkPattern(
  fieldName: string
): { reason: string; exclude: boolean } | null {
  for (const { pattern, reason, exclude } of NON_FK_PATTERNS) {
    if (pattern.test(fieldName)) {
      return { reason, exclude: exclude ?? false };
    }
  }
  return null;
}

/**
 * Analyze JSON data structure to determine if keys are likely record IDs
 *
 * FK patterns:
 * - Keys are numeric strings: {"5029": 100, "5030": 50}
 * - Values are percentages, amounts, or booleans
 *
 * Non-FK patterns:
 * - Keys are stage names: {"new": 1000, "qualified": 2000}
 * - Values are complex objects
 */
function analyzeDataStructure(
  samples: Record<string, unknown>[]
): { isFk: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let fkScore = 0;
  let nonFkScore = 0;

  if (samples.length === 0) {
    return { isFk: false, confidence: 0, reasons: ['No data samples available'] };
  }

  // Analyze each sample
  for (const sample of samples) {
    if (!sample || typeof sample !== 'object') {
      continue;
    }

    const keys = Object.keys(sample);
    if (keys.length === 0) {
      continue;
    }

    // Check if keys are numeric
    const numericKeys = keys.filter((k) => /^\d+$/.test(k));
    const numericRatio = numericKeys.length / keys.length;

    if (numericRatio > 0.8) {
      fkScore += 30;
      reasons.push(`Keys are numeric (${numericKeys.length}/${keys.length})`);
    } else if (numericRatio === 0) {
      nonFkScore += 30;
      reasons.push(`Keys are non-numeric (likely stage names or field names)`);
    }

    // Check value types
    const values = Object.values(sample);
    const numericValues = values.filter((v) => typeof v === 'number');
    const numericValueRatio = numericValues.length / values.length;

    if (numericValueRatio > 0.8) {
      // Numeric values suggest percentages or amounts
      const allPositive = numericValues.every((v) => (v as number) >= 0);
      const maxVal = Math.max(...(numericValues as number[]));

      if (maxVal <= 100 && allPositive) {
        fkScore += 20;
        reasons.push(`Values look like percentages (max: ${maxVal})`);
      } else if (allPositive) {
        fkScore += 10;
        reasons.push(`Values are positive numbers (could be amounts)`);
      }
    }

    // Check for complex nested objects (suggests metadata)
    const complexValues = values.filter(
      (v) => typeof v === 'object' && v !== null
    );
    if (complexValues.length > 0) {
      nonFkScore += 20;
      reasons.push(`Contains nested objects (suggests metadata)`);
    }
  }

  // Normalize scores to confidence
  const totalScore = fkScore + nonFkScore;
  if (totalScore === 0) {
    return { isFk: false, confidence: 0.5, reasons: ['Inconclusive data'] };
  }

  const fkConfidence = fkScore / totalScore;
  return {
    isFk: fkConfidence > 0.6,
    confidence: Math.max(fkConfidence, 1 - fkConfidence),
    reasons,
  };
}

/**
 * Fetch sample data from Odoo for a specific JSON field
 */
async function fetchSampleData(
  odooClient: OdooClient,
  modelName: string,
  fieldName: string,
  sampleSize: number
): Promise<Record<string, unknown>[]> {
  try {
    // Search for records where the field is not empty/null
    const records = await odooClient.searchRead<Record<string, unknown>>(
      modelName,
      [[fieldName, '!=', false]],
      [fieldName],
      { limit: sampleSize }
    );

    const samples: Record<string, unknown>[] = [];
    for (const record of records) {
      const value = record[fieldName];
      if (value && typeof value === 'object') {
        samples.push(value as Record<string, unknown>);
      } else if (typeof value === 'string') {
        try {
          samples.push(JSON.parse(value) as Record<string, unknown>);
        } catch {
          // Not valid JSON
        }
      }
    }

    return samples;
  } catch (error) {
    console.error(
      `[JsonFkDetector] Failed to sample ${modelName}.${fieldName}: ${error}`
    );
    return [];
  }
}

/**
 * Get all JSON fields from schema in Qdrant
 */
async function getJsonFieldsFromSchema(
  qdrantClient: QdrantClient,
  modelFilter?: string
): Promise<Array<{ modelName: string; fieldName: string }>> {
  const jsonFields: Array<{ modelName: string; fieldName: string }> = [];

  // Query schema points for field_type = 'json'
  // Build filter array
  const mustConditions = [
    { key: 'point_type', match: { value: 'schema' } },
    { key: 'field_type', match: { value: 'json' } },
  ];

  if (modelFilter) {
    mustConditions.push({
      key: 'model_name',
      match: { value: modelFilter },
    });
  }

  // Scroll through all JSON fields
  let offset: string | number | undefined;
  const limit = 100;

  while (true) {
    const result = await qdrantClient.scroll('nexsus_unified', {
      filter: { must: mustConditions },
      limit,
      offset,
      with_payload: true,
    });

    for (const point of result.points) {
      const payload = point.payload as Record<string, unknown>;
      if (payload.model_name && payload.field_name) {
        jsonFields.push({
          modelName: payload.model_name as string,
          fieldName: payload.field_name as string,
        });
      }
    }

    if (!result.next_page_offset) {
      break;
    }
    // next_page_offset can be string, number, or PointId record
    const nextOffset = result.next_page_offset;
    if (typeof nextOffset === 'string' || typeof nextOffset === 'number') {
      offset = nextOffset;
    } else {
      // PointId record - use as-is, will break the loop if invalid
      break;
    }
  }

  return jsonFields;
}

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

/**
 * Detect JSON fields that may contain FK references
 *
 * @param options - Detection options
 * @returns Detection results with candidates and statistics
 */
export async function detectJsonFkFields(
  options: DetectionOptions = {}
): Promise<DetectionResult> {
  const {
    modelFilter,
    minConfidence = 0,
    skipDataSampling = false,
    sampleSize = 5,
    includeExisting = false,
  } = options;

  const candidates: DetectionCandidate[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  // Initialize Qdrant client
  initializeVectorClient();
  const qdrantClient = getQdrantClient();

  // Initialize Odoo client (optional)
  let odooClient: OdooClient | null = null;
  if (!skipDataSampling) {
    try {
      odooClient = getOdooClient();
    } catch (error) {
      errors.push(`Failed to initialize Odoo client: ${error}`);
    }
  }

  try {
    // Get all JSON fields from schema
    console.error(`[JsonFkDetector] Fetching JSON fields from schema...`);
    const jsonFields = await getJsonFieldsFromSchema(qdrantClient, modelFilter);
    console.error(`[JsonFkDetector] Found ${jsonFields.length} JSON fields`);

    // Process each field
    for (const { modelName, fieldName } of jsonFields) {
      // Skip if already in config (unless includeExisting)
      if (!includeExisting && hasJsonFkMapping(modelName, fieldName)) {
        skippedCount++;
        continue;
      }

      // Check non-FK patterns first (may exclude entirely)
      const nonFkMatch = matchNonFkPattern(fieldName);
      if (nonFkMatch?.exclude) {
        // Completely exclude (e.g., *_search computed fields)
        continue;
      }

      // Check FK patterns
      const fkMatch = matchFkPattern(fieldName);

      // Initialize candidate
      const candidate: DetectionCandidate = {
        sourceModel: modelName,
        fieldName,
        confidence: 0,
        detectionMethod: 'naming',
        isLikelyMetadata: false,
        reasons: [],
      };

      // Apply naming pattern analysis
      if (nonFkMatch) {
        candidate.isLikelyMetadata = true;
        candidate.confidence = 0.7;
        candidate.reasons.push(`Non-FK pattern: ${nonFkMatch.reason}`);
      } else if (fkMatch) {
        candidate.confidence = fkMatch.confidence;
        candidate.likelyTargetModel = fkMatch.likelyTarget;
        candidate.reasons.push(
          `FK pattern matched (confidence: ${fkMatch.confidence})`
        );
      } else {
        // Unknown pattern - needs data sampling
        candidate.confidence = 0.5;
        candidate.reasons.push('Unknown pattern - requires data sampling');
      }

      // Data sampling (if enabled and Odoo client available)
      if (!skipDataSampling && odooClient) {
        try {
          const samples = await fetchSampleData(
            odooClient,
            modelName,
            fieldName,
            sampleSize
          );

          if (samples.length > 0) {
            candidate.sampleData = samples;
            const analysis = analyzeDataStructure(samples);

            // Update confidence based on data analysis
            if (fkMatch && analysis.isFk) {
              // Both naming and data agree -> high confidence
              candidate.confidence = Math.min(
                0.98,
                candidate.confidence + 0.1
              );
              candidate.detectionMethod = 'both';
            } else if (!fkMatch && !analysis.isFk) {
              // Both agree it's not FK
              candidate.isLikelyMetadata = true;
              candidate.confidence = analysis.confidence;
              candidate.detectionMethod = 'both';
            } else if (analysis.isFk) {
              // Data suggests FK but naming didn't match
              candidate.confidence = analysis.confidence * 0.8;
              candidate.isLikelyMetadata = false;
              candidate.detectionMethod = 'data_sampling';
            } else {
              // Data suggests non-FK
              candidate.isLikelyMetadata = true;
              candidate.confidence = analysis.confidence * 0.9;
              candidate.detectionMethod = 'data_sampling';
            }

            candidate.reasons.push(...analysis.reasons);
          }
        } catch (error) {
          candidate.reasons.push(`Data sampling failed: ${error}`);
        }
      }

      // Add if meets minimum confidence
      if (candidate.confidence >= minConfidence) {
        candidates.push(candidate);
      }
    }

    // Sort by confidence (descending)
    candidates.sort((a, b) => b.confidence - a.confidence);
  } finally {
    // Cleanup
  }

  // Calculate statistics
  const fkCount = candidates.filter((c) => !c.isLikelyMetadata).length;
  const metadataCount = candidates.filter((c) => c.isLikelyMetadata).length;

  return {
    candidates,
    fkCount,
    metadataCount,
    skippedCount,
    errors,
  };
}

// =============================================================================
// CONFIG GENERATION
// =============================================================================

/**
 * Generate JSON FK config entries from detected candidates
 *
 * @param candidates - Detection candidates
 * @param minConfidence - Minimum confidence to include (default: 0.85)
 * @returns Array of JsonFkMapping objects ready for config
 */
export function generateConfigEntries(
  candidates: DetectionCandidate[],
  minConfidence: number = 0.85
): JsonFkMapping[] {
  const entries: JsonFkMapping[] = [];

  for (const candidate of candidates) {
    if (candidate.confidence < minConfidence) {
      continue;
    }

    if (candidate.isLikelyMetadata) {
      // Generate metadata entry
      entries.push({
        source_model: candidate.sourceModel,
        field_name: candidate.fieldName,
        mapping_type: 'metadata',
        description: candidate.reasons.join('; '),
        key_type: 'string',
        value_type: 'mixed',
      });
    } else {
      // Generate FK entry
      entries.push({
        source_model: candidate.sourceModel,
        field_name: candidate.fieldName,
        mapping_type: 'fk',
        key_target_model: candidate.likelyTargetModel || 'unknown',
        key_target_model_id: 0, // Needs manual lookup
        key_type: 'record_id',
        value_type: 'percentage', // Most common for analytic_distribution
      });
    }
  }

  return entries;
}

/**
 * Get a summary of detection results for display
 */
export function summarizeDetectionResults(result: DetectionResult): string {
  const lines: string[] = [
    `JSON FK Detection Results`,
    `========================`,
    `Total candidates: ${result.candidates.length}`,
    `  FK fields: ${result.fkCount}`,
    `  Metadata fields: ${result.metadataCount}`,
    `  Skipped (already configured): ${result.skippedCount}`,
  ];

  if (result.errors.length > 0) {
    lines.push(``, `Errors:`, ...result.errors.map((e) => `  - ${e}`));
  }

  if (result.candidates.length > 0) {
    lines.push(``, `Top candidates:`);

    for (const c of result.candidates.slice(0, 10)) {
      const type = c.isLikelyMetadata ? 'metadata' : 'FK';
      lines.push(
        `  ${c.sourceModel}.${c.fieldName}`,
        `    Type: ${type}, Confidence: ${(c.confidence * 100).toFixed(1)}%`,
        `    Reasons: ${c.reasons.slice(0, 2).join('; ')}`
      );
    }

    if (result.candidates.length > 10) {
      lines.push(`  ... and ${result.candidates.length - 10} more`);
    }
  }

  return lines.join('\n');
}
