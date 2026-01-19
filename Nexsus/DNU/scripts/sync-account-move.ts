/**
 * Sync All account.move Records
 *
 * Syncs all account.move records to fix FK integrity issues.
 * Uses chunked uploads (100 per batch) to avoid HTTP body size limits.
 *
 * Run: npx tsx scripts/sync-account-move.ts
 */

import 'dotenv/config';
import { UNIFIED_CONFIG } from '../src/constants.js';
import { getOdooClient } from '../src/services/odoo-client.js';
import { initializeVectorClient, getQdrantClient, upsertToUnifiedCollection } from '../src/services/vector-client.js';
import { initializeEmbeddingService, embedBatch } from '../src/services/embedding-service.js';
import { getModelIdFromSchema, getOdooFieldNamesFromSchema } from '../src/services/schema-query-service.js';
import { transformPipelineRecords } from '../src/services/pipeline-data-transformer.js';
import { buildDataUuidV2 } from '../src/utils/uuid-v2.js';
import type { PipelineDataPoint } from '../src/types.js';

const COLLECTION_NAME = UNIFIED_CONFIG.COLLECTION_NAME;
const MODEL_NAME = 'account.move';
const FETCH_BATCH_SIZE = 500;  // Records to fetch from Odoo at once

async function main() {
  console.log('='.repeat(60));
  console.log(`SYNC ALL ${MODEL_NAME} RECORDS`);
  console.log('='.repeat(60));
  console.log();

  const startTime = Date.now();

  // Initialize services
  console.log('[Step 1] Initializing services...');
  await initializeVectorClient();
  const client = getQdrantClient();

  const embeddingInitialized = initializeEmbeddingService();
  if (!embeddingInitialized) {
    console.log('  ERROR: Failed to initialize embedding service. Check VOYAGE_API_KEY.');
    process.exit(1);
  }

  // Get model info
  const modelId = await getModelIdFromSchema(MODEL_NAME);
  if (!modelId) {
    console.log(`  ERROR: Model ${MODEL_NAME} not found in schema`);
    process.exit(1);
  }
  console.log(`  Model ID: ${modelId}`);

  const odooFields = await getOdooFieldNamesFromSchema(MODEL_NAME);
  console.log(`  Fields to fetch: ${odooFields.length}`);

  // Get current count
  const beforeCount = await client.count(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: MODEL_NAME } },
      ],
    },
    exact: true,
  });
  console.log(`  Current count in Qdrant: ${beforeCount.count}`);
  console.log();

  // Get total count from Odoo
  console.log('[Step 2] Counting records in Odoo...');
  const odooClient = getOdooClient();
  const totalInOdoo = await odooClient.searchCount(MODEL_NAME, []);
  console.log(`  Total in Odoo: ${totalInOdoo}`);
  console.log();

  // Fetch and sync in batches
  console.log('[Step 3] Syncing records in batches...');
  let totalSynced = 0;
  let offset = 0;

  while (offset < totalInOdoo) {
    const batchNum = Math.floor(offset / FETCH_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalInOdoo / FETCH_BATCH_SIZE);

    console.log(`\n[Batch ${batchNum}/${totalBatches}] Fetching records ${offset + 1} to ${Math.min(offset + FETCH_BATCH_SIZE, totalInOdoo)}...`);

    // Fetch from Odoo
    const records = await odooClient.searchRead<Record<string, unknown>>(
      MODEL_NAME,
      [],
      odooFields,
      { limit: FETCH_BATCH_SIZE, offset, order: 'id' }
    );

    if (records.length === 0) {
      console.log('  No more records to fetch');
      break;
    }

    console.log(`  Fetched ${records.length} records`);

    // Transform
    const transformed = await transformPipelineRecords(records, MODEL_NAME);
    console.log(`  Transformed ${transformed.length} records`);

    // Embed
    const texts = transformed.map(r => r.vector_text);
    const embeddings = await embedBatch(texts, 'document');
    console.log(`  Embedded ${embeddings.length} records`);

    // Build points
    const points: PipelineDataPoint[] = transformed.map((record, idx) => {
      const pointId = buildDataUuidV2(record.model_id, record.record_id);
      return {
        id: pointId,
        vector: embeddings[idx],
        payload: {
          point_id: pointId,
          record_id: record.record_id,
          model_name: record.model_name,
          model_id: record.model_id,
          sync_timestamp: new Date().toISOString(),
          point_type: 'data' as const,
          vector_text: record.vector_text,
          ...record.payload,
        },
      };
    });

    // Upload with chunking
    await upsertToUnifiedCollection(points, 100);
    console.log(`  Uploaded ${points.length} points`);

    totalSynced += points.length;
    offset += FETCH_BATCH_SIZE;
  }

  // Final count
  console.log('\n' + '='.repeat(60));
  const afterCount = await client.count(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: MODEL_NAME } },
      ],
    },
    exact: true,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Duration: ${duration}s`);
  console.log(`Records synced: ${totalSynced}`);
  console.log(`Qdrant count: ${beforeCount.count} -> ${afterCount.count}`);
  console.log(`Net change: +${afterCount.count - beforeCount.count}`);
  console.log();
}

main().catch(console.error);
