/**
 * Direct Odoo-to-Qdrant Schema Sync Service
 *
 * Enables schema refresh directly from Odoo API to Qdrant,
 * bypassing the Excel intermediate file. Critical for Railway
 * deployments where the Excel file cannot be easily updated.
 *
 * Pipeline:
 * Odoo API → OdooSchemaFetcher → V2SchemaRow → NexsusSchemaRow → Qdrant
 *
 * Format Preservation:
 * - V2 UUID: 00000003-0004-0000-0000-FFFFFFFFFFFF
 * - Semantic Text: 9-component format for Voyage AI embedding
 * - Payload: Key-value pairs with FK metadata
 *
 * Created as part of: Direct Odoo-to-Vector Schema Refresh
 * See docs/plans/core-pipeline-separation.md
 */

import chalk from 'chalk';
import { UNIFIED_CONFIG, SYNC_CONFIG } from '../../common/constants.js';
import { embedBatch, isEmbeddingServiceAvailable } from './embedding-service.js';
import { getQdrantClient, isVectorClientAvailable, collectionExists } from '../../common/services/vector-client.js';
import { buildSchemaUuidV2, buildSchemaFkRefUuidV2 } from '../../common/utils/uuid-v2.js';
import { clearSchemaCache } from '../../common/services/schema-query-service.js';
import { OdooSchemaFetcher, createOdooSchemaFetcher, type V2SchemaRow } from './odoo-schema-fetcher.js';
import type { NexsusSchemaRow, NexsusSyncResult } from '../../common/types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result from direct Odoo schema sync
 */
export interface OdooSchemaSyncResult extends NexsusSyncResult {
  /** Number of models found in Odoo */
  models_found: number;
  /** Number of FK fields found */
  fk_fields_found: number;
  /** Source of sync (always 'odoo' for this service) */
  source: 'odoo';
}

// ============================================================================
// V2SchemaRow → NexsusSchemaRow TRANSFORMATION
// ============================================================================

/**
 * Transform V2SchemaRow to NexsusSchemaRow
 *
 * Maps field names between the two interfaces:
 * - V2SchemaRow uses fk_target_* naming
 * - NexsusSchemaRow uses fk_location_* naming
 *
 * Both formats are preserved for complete compatibility with the Excel pipeline.
 *
 * @param v2Row - V2SchemaRow from OdooSchemaFetcher
 * @returns NexsusSchemaRow for unified-schema-sync
 */
function transformV2ToNexsus(v2Row: V2SchemaRow): NexsusSchemaRow {
  // Map V2SchemaRow → NexsusSchemaRow
  const nexsusRow: NexsusSchemaRow = {
    // Core fields (same names)
    qdrant_id: v2Row.qdrant_id,
    semantic_text: v2Row.semantic_text,
    raw_payload: v2Row.raw_payload,
    field_id: v2Row.field_id,
    model_id: v2Row.model_id,
    field_name: v2Row.field_name,
    field_label: v2Row.field_label,
    field_type: v2Row.field_type,
    model_name: v2Row.model_name,
    stored: v2Row.stored,

    // FK fields (name mapping: fk_target_* → fk_location_*)
    fk_location_model: v2Row.fk_target_model,
    fk_location_model_id: v2Row.fk_target_model_id,
    // fk_location_record_id comes from the target model's 'id' field's field_id
    // This is computed in OdooSchemaFetcher's modelIdFieldMap
    fk_location_record_id: undefined, // Will be set below if available
    fk_qdrant_id: undefined, // Will be set below if available
  };

  // Generate FK Qdrant ID if we have target model info
  // The Excel format uses fk_location_record_id for the target field's 'id' field_id
  // But V2SchemaRow doesn't store this directly - it's used for graph_ref generation
  // For compatibility, we extract it from the payload if available
  if (v2Row.fk_target_model_id !== undefined) {
    // Parse fk_location_record_id from raw_payload if present
    const recordIdMatch = v2Row.raw_payload.match(/FK location record Id - (\d+)/);
    if (recordIdMatch) {
      nexsusRow.fk_location_record_id = parseInt(recordIdMatch[1], 10);
    }

    // Generate FK Qdrant ID
    if (nexsusRow.fk_location_record_id !== undefined) {
      nexsusRow.fk_qdrant_id = buildSchemaFkRefUuidV2(
        v2Row.fk_target_model_id,
        nexsusRow.fk_location_record_id
      );
    }
  }

  return nexsusRow;
}

// ============================================================================
// PAYLOAD BUILDER (same as unified-schema-sync.ts)
// ============================================================================

/**
 * Build V2 payload for unified schema point
 *
 * Key fields:
 * - point_type: 'schema' (CRITICAL discriminator)
 * - point_id: V2 UUID for querying/filtering
 *
 * @param schema - Schema row
 * @param pointId - V2 UUID
 * @returns Payload object for Qdrant
 */
function buildUnifiedSchemaPayload(schema: NexsusSchemaRow, pointId: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    // ========================================
    // DISCRIMINATOR - CRITICAL FOR UNIFIED
    // ========================================
    point_id: pointId,
    point_type: 'schema',

    // ========================================
    // CORE FIELDS
    // ========================================
    field_id: schema.field_id,
    model_id: schema.model_id,
    field_name: schema.field_name,
    field_label: schema.field_label,
    field_type: schema.field_type,
    model_name: schema.model_name,
    stored: schema.stored,

    // Embedding source
    semantic_text: schema.semantic_text,
    raw_payload: schema.raw_payload,

    // Sync metadata
    sync_timestamp: new Date().toISOString(),
    sync_source: 'odoo', // Mark as synced from Odoo (not Excel)
  };

  // ========================================
  // FK FIELDS (OPTIONAL) - V2 FORMAT
  // ========================================
  if (schema.fk_location_model) {
    payload.fk_location_model = schema.fk_location_model;
    payload.primary_data_location = schema.fk_location_model + '.id';
  }

  if (schema.fk_location_model_id !== undefined) {
    payload.fk_location_model_id = schema.fk_location_model_id;
  }

  if (schema.fk_location_record_id !== undefined) {
    payload.fk_location_record_id = schema.fk_location_record_id;

    if (schema.fk_location_model_id !== undefined) {
      payload.fk_qdrant_id = buildSchemaFkRefUuidV2(
        schema.fk_location_model_id,
        schema.fk_location_record_id
      );
    }
  }

  return payload;
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

/**
 * Sync Options for direct Odoo sync
 */
export interface SyncSchemaFromOdooOptions {
  /** Clear existing schema points before syncing */
  forceRecreate?: boolean;
  /** Progress callback */
  onProgress?: (phase: string, current: number, total: number) => void;
  /** Dry run - fetch but don't upload */
  dryRun?: boolean;
}

/**
 * Sync schema directly from Odoo to Qdrant
 *
 * This function:
 * 1. Connects to Odoo via OdooSchemaFetcher
 * 2. Fetches all models and fields from ir.model / ir.model.fields
 * 3. Transforms V2SchemaRow[] to NexsusSchemaRow[]
 * 4. Generates V2 UUIDs for each field
 * 5. Batches embeddings and uploads with point_type='schema'
 *
 * @param options - Sync options
 * @returns Sync result with statistics
 *
 * @example
 * // Basic sync from Odoo
 * const result = await syncSchemaFromOdoo();
 *
 * @example
 * // Force recreate (clears existing schema points first)
 * const result = await syncSchemaFromOdoo({ forceRecreate: true });
 *
 * @example
 * // Dry run (fetch but don't upload)
 * const result = await syncSchemaFromOdoo({ dryRun: true });
 */
export async function syncSchemaFromOdoo(
  options?: SyncSchemaFromOdooOptions
): Promise<OdooSchemaSyncResult> {
  const startTime = Date.now();
  const { forceRecreate = false, onProgress, dryRun = false } = options || {};

  // ========================================
  // PREREQUISITES CHECK
  // ========================================
  if (!isVectorClientAvailable()) {
    return {
      success: false,
      uploaded: 0,
      failed: 0,
      durationMs: Date.now() - startTime,
      models_found: 0,
      fk_fields_found: 0,
      source: 'odoo',
      errors: ['Vector client not available. Check QDRANT_HOST and QDRANT_API_KEY.'],
    };
  }

  if (!isEmbeddingServiceAvailable()) {
    return {
      success: false,
      uploaded: 0,
      failed: 0,
      durationMs: Date.now() - startTime,
      models_found: 0,
      fk_fields_found: 0,
      source: 'odoo',
      errors: ['Embedding service not available. Check VOYAGE_API_KEY.'],
    };
  }

  const collectionName = UNIFIED_CONFIG.COLLECTION_NAME;
  const exists = await collectionExists(collectionName);
  if (!exists) {
    return {
      success: false,
      uploaded: 0,
      failed: 0,
      durationMs: Date.now() - startTime,
      models_found: 0,
      fk_fields_found: 0,
      source: 'odoo',
      errors: [`Unified collection '${collectionName}' does not exist.`],
    };
  }

  const errors: string[] = [];
  let uploaded = 0;
  let failed = 0;
  let modelsFound = 0;
  let fkFieldsFound = 0;

  try {
    const client = getQdrantClient();

    // ========================================
    // PHASE 1: FETCH FROM ODOO
    // ========================================
    onProgress?.('fetching', 0, 1);
    console.error(chalk.cyan('[OdooSchemaSync] Connecting to Odoo...'));

    let fetcher: OdooSchemaFetcher;
    try {
      fetcher = createOdooSchemaFetcher();
    } catch (configError) {
      const errorMsg = configError instanceof Error ? configError.message : String(configError);
      return {
        success: false,
        uploaded: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
        models_found: 0,
        fk_fields_found: 0,
        source: 'odoo',
        errors: [`Odoo configuration error: ${errorMsg}`],
      };
    }

    console.error(chalk.cyan('[OdooSchemaSync] Fetching schema from Odoo...'));
    const v2Rows = await fetcher.fetchAllSchemaV2();

    if (v2Rows.length === 0) {
      return {
        success: false,
        uploaded: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
        models_found: 0,
        fk_fields_found: 0,
        source: 'odoo',
        errors: ['No schema data returned from Odoo'],
      };
    }

    console.error(chalk.green(`[OdooSchemaSync] Fetched ${v2Rows.length} fields from Odoo`));

    // Count models and FK fields
    const uniqueModels = new Set<string>();
    for (const row of v2Rows) {
      uniqueModels.add(row.model_name);
      if (row.fk_target_model) {
        fkFieldsFound++;
      }
    }
    modelsFound = uniqueModels.size;
    console.error(chalk.cyan(`[OdooSchemaSync] Found ${modelsFound} models, ${fkFieldsFound} FK fields`));

    // ========================================
    // PHASE 2: TRANSFORM TO NEXSUS FORMAT
    // ========================================
    onProgress?.('transforming', 0, v2Rows.length);
    console.error(chalk.cyan('[OdooSchemaSync] Transforming to NexsusSchemaRow format...'));

    const schemas: NexsusSchemaRow[] = v2Rows.map(transformV2ToNexsus);
    console.error(chalk.green(`[OdooSchemaSync] Transformed ${schemas.length} schema rows`));

    // ========================================
    // DRY RUN EXIT POINT
    // ========================================
    if (dryRun) {
      console.error(chalk.yellow('[OdooSchemaSync] DRY RUN - Skipping upload'));
      return {
        success: true,
        uploaded: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
        models_found: modelsFound,
        fk_fields_found: fkFieldsFound,
        source: 'odoo',
      };
    }

    // ========================================
    // PHASE 3: OPTIONAL CLEANUP
    // ========================================
    if (forceRecreate) {
      onProgress?.('clearing', 0, 1);
      console.error(chalk.yellow('[OdooSchemaSync] Clearing existing schema points...'));

      try {
        await client.delete(collectionName, {
          wait: true,
          filter: {
            must: [{ key: 'point_type', match: { value: 'schema' } }],
          },
        });
        console.error(chalk.green('[OdooSchemaSync] Cleared existing schema points'));
      } catch (deleteError) {
        console.error('[OdooSchemaSync] No existing schema points to clear');
      }
    }

    // ========================================
    // PHASE 4: EMBED AND UPLOAD IN BATCHES
    // ========================================
    const batchSize = SYNC_CONFIG.BATCH_SIZE;
    const totalBatches = Math.ceil(schemas.length / batchSize);
    console.error(chalk.cyan(`[OdooSchemaSync] Processing ${totalBatches} batches (batch size: ${batchSize})...`));

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, schemas.length);
      const batch = schemas.slice(batchStart, batchEnd);

      onProgress?.('embedding', batchStart, schemas.length);

      try {
        // Use semantic text for embeddings
        const semanticTexts = batch.map(s => s.semantic_text);

        // Generate embeddings via Voyage AI
        const embeddings = await embedBatch(semanticTexts, 'document');

        // Log embedding dimensions for first batch
        if (batchIndex === 0 && embeddings.length > 0) {
          console.error(`[OdooSchemaSync] Embedding dimensions: ${embeddings[0].length}`);
        }

        // Build points with V2 UUIDs
        const points: Array<{
          id: string;
          vector: number[];
          payload: Record<string, unknown>;
        }> = [];

        for (let i = 0; i < batch.length; i++) {
          const schema = batch[i];
          const embedding = embeddings[i];

          if (embedding && embedding.length > 0) {
            // V2 UUID: 00000003-0004-0000-0000-FFFFFFFFFFFF
            const pointId = buildSchemaUuidV2(schema.field_id);

            points.push({
              id: pointId,
              vector: embedding,
              payload: buildUnifiedSchemaPayload(schema, pointId),
            });
          } else {
            failed++;
            errors.push(`Failed to embed: ${schema.model_name}.${schema.field_name} (field_id: ${schema.field_id})`);
          }
        }

        // Upsert to unified collection
        if (points.length > 0) {
          onProgress?.('uploading', batchStart, schemas.length);
          await client.upsert(collectionName, {
            wait: true,
            points,
          });
          uploaded += points.length;
        }

        // Log progress every 5 batches
        if ((batchIndex + 1) % 5 === 0 || batchIndex === totalBatches - 1) {
          const progress = ((batchEnd / schemas.length) * 100).toFixed(1);
          console.error(`[OdooSchemaSync] Progress: ${progress}% (${uploaded} uploaded, ${failed} failed)`);
        }
      } catch (batchError) {
        const errorMsg = batchError instanceof Error ? batchError.message : String(batchError);
        console.error(chalk.red(`[OdooSchemaSync] Batch ${batchIndex + 1} error: ${errorMsg}`));
        errors.push(`Batch ${batchIndex + 1} error: ${errorMsg}`);
        failed += batch.length;
      }
    }

    console.error(chalk.green(`[OdooSchemaSync] Sync complete: ${uploaded} uploaded, ${failed} failed`));

    // Clear schema query cache so queries use fresh data
    clearSchemaCache();
    console.error(chalk.cyan('[OdooSchemaSync] Schema cache cleared'));

    return {
      success: errors.length === 0,
      uploaded,
      failed,
      durationMs: Date.now() - startTime,
      models_found: modelsFound,
      fk_fields_found: fkFieldsFound,
      source: 'odoo',
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`[OdooSchemaSync] Sync failed: ${errorMsg}`));
    return {
      success: false,
      uploaded,
      failed,
      durationMs: Date.now() - startTime,
      models_found: modelsFound,
      fk_fields_found: fkFieldsFound,
      source: 'odoo',
      errors: [errorMsg],
    };
  }
}
