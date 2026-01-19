/**
 * Schema Vector Loader
 *
 * Loads schema directly from Qdrant vector database instead of Excel file.
 * This enables dynamic schema refresh after direct Odoo-to-Qdrant sync
 * without requiring Excel file updates.
 *
 * Returns the same NexsusSchemaRow format as excel-schema-loader.ts
 * for compatibility with existing schema-lookup.ts.
 */

import { getQdrantClient, isVectorClientAvailable } from './vector-client.js';
import { UNIFIED_CONFIG } from '../constants.js';
import type { NexsusSchemaRow } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Schema point payload structure in Qdrant
 */
interface SchemaPointPayload {
  point_type: 'schema';
  field_id: number;
  model_id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  model_name: string;
  stored: boolean;
  fk_target_model?: string;
  fk_target_model_id?: number;
  graph_ref?: string;
}

// =============================================================================
// LOADER
// =============================================================================

/**
 * Load all schema from Qdrant vector database
 *
 * Scrolls through all schema points (point_type='schema') and converts
 * payload to NexsusSchemaRow format for compatibility with schema-lookup.ts.
 *
 * @returns Promise<NexsusSchemaRow[]> - All schema rows from Qdrant
 */
export async function loadSchemaFromQdrant(): Promise<NexsusSchemaRow[]> {
  if (!isVectorClientAvailable()) {
    console.error('[SchemaVectorLoader] Vector client not initialized');
    return [];
  }

  const client = getQdrantClient();
  const schemaRows: NexsusSchemaRow[] = [];

  console.error('[SchemaVectorLoader] Loading schema from Qdrant...');

  let offset: string | number | undefined = undefined;
  let totalLoaded = 0;
  const batchSize = 1000;

  try {
    // Scroll through all schema points
    while (true) {
      const response = await client.scroll(UNIFIED_CONFIG.COLLECTION_NAME, {
        filter: {
          must: [{ key: 'point_type', match: { value: 'schema' } }]
        },
        with_payload: true,
        with_vector: false,
        limit: batchSize,
        offset: offset,
      });

      if (!response.points || response.points.length === 0) {
        break;
      }

      // Convert each point payload to NexsusSchemaRow
      for (const point of response.points) {
        const payload = point.payload as unknown as SchemaPointPayload;

        if (!payload || payload.point_type !== 'schema') {
          continue;
        }

        const row: NexsusSchemaRow = {
          qdrant_id: point.id as string,
          semantic_text: '', // Not needed for lookups
          raw_payload: '',   // Not needed for lookups
          field_id: payload.field_id,
          model_id: payload.model_id,
          field_name: payload.field_name,
          field_label: payload.field_label || payload.field_name,
          field_type: payload.field_type,
          model_name: payload.model_name,
          stored: payload.stored,
          fk_location_model: payload.fk_target_model,
          fk_location_model_id: payload.fk_target_model_id,
        };

        schemaRows.push(row);
      }

      totalLoaded += response.points.length;

      // Check for next page
      const nextOffset = response.next_page_offset;
      if (nextOffset === null || nextOffset === undefined) {
        break;
      }

      // next_page_offset can be string or number depending on Qdrant version
      offset = typeof nextOffset === 'object' ? undefined : nextOffset;
    }

    console.error(`[SchemaVectorLoader] Loaded ${schemaRows.length} schema rows from Qdrant`);

    // Log model count
    const uniqueModels = new Set(schemaRows.map(r => r.model_name));
    console.error(`[SchemaVectorLoader] Found ${uniqueModels.size} unique models`);

    return schemaRows;

  } catch (error) {
    console.error('[SchemaVectorLoader] Error loading schema from Qdrant:', error);
    return [];
  }
}

/**
 * Get schema statistics from Qdrant
 *
 * Quick count without loading all data.
 */
export async function getSchemaStats(): Promise<{ count: number; models: number } | null> {
  if (!isVectorClientAvailable()) {
    return null;
  }

  const client = getQdrantClient();

  try {
    const countResult = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }]
      },
      exact: true,
    });

    // Get unique model count (sample first 100 to estimate)
    const sampleResponse = await client.scroll(UNIFIED_CONFIG.COLLECTION_NAME, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }]
      },
      with_payload: ['model_name'],
      with_vector: false,
      limit: 10000, // Get enough to count models
    });

    const uniqueModels = new Set<string>();
    for (const point of sampleResponse.points) {
      const modelName = (point.payload as { model_name?: string })?.model_name;
      if (modelName) {
        uniqueModels.add(modelName);
      }
    }

    return {
      count: countResult.count,
      models: uniqueModels.size,
    };
  } catch (error) {
    console.error('[SchemaVectorLoader] Error getting schema stats:', error);
    return null;
  }
}

/**
 * Check if schema exists in Qdrant
 */
export async function hasSchemaInQdrant(): Promise<boolean> {
  const stats = await getSchemaStats();
  return stats !== null && stats.count > 0;
}
