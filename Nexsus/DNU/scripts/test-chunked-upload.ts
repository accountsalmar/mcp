/**
 * Test Chunked Upload for Large Models
 *
 * Tests the fix for "Bad Request" / "Invalid string length" errors
 * when uploading large models like account.move (5,042 records).
 *
 * The fix chunks uploads into batches of 100 points to avoid
 * Qdrant's HTTP body size limits.
 *
 * Run: npx tsx scripts/test-chunked-upload.ts
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { UNIFIED_CONFIG } from '../src/constants.js';
import { getOdooClient } from '../src/services/odoo-client.js';
import { initializeVectorClient, getQdrantClient, upsertToUnifiedCollection } from '../src/services/vector-client.js';
import { initializeEmbeddingService, embedBatch } from '../src/services/embedding-service.js';
import { getModelIdFromSchema, getOdooFieldNamesFromSchema } from '../src/services/schema-query-service.js';
import { transformPipelineRecords } from '../src/services/pipeline-data-transformer.js';
import { buildDataUuidV2 } from '../src/utils/uuid-v2.js';
import type { PipelineDataPoint } from '../src/types.js';

const COLLECTION_NAME = UNIFIED_CONFIG.COLLECTION_NAME;
const TEST_MODEL = 'account.move';  // 5,042 records - previously failed

async function main() {
  console.log('='.repeat(60));
  console.log('CHUNKED UPLOAD TEST');
  console.log(`Model: ${TEST_MODEL}`);
  console.log('='.repeat(60));
  console.log();

  // Initialize services
  console.log('[Step 1] Initializing services...');
  await initializeVectorClient();
  const client = getQdrantClient();

  const embeddingInitialized = initializeEmbeddingService();
  if (!embeddingInitialized) {
    console.log('  ERROR: Failed to initialize embedding service. Check VOYAGE_API_KEY.');
    process.exit(1);
  }
  console.log('  Services initialized.');

  // Check current count
  const beforeCount = await client.count(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: TEST_MODEL } },
      ],
    },
    exact: true,
  });
  console.log(`  Current ${TEST_MODEL} count: ${beforeCount.count}`);
  console.log();

  // Get model ID and fields from schema
  console.log('[Step 2] Getting schema info...');
  const modelId = await getModelIdFromSchema(TEST_MODEL);
  if (!modelId) {
    console.log(`  ERROR: Model ${TEST_MODEL} not found in schema`);
    process.exit(1);
  }
  console.log(`  Model ID: ${modelId}`);

  const odooFields = await getOdooFieldNamesFromSchema(TEST_MODEL);
  console.log(`  Fields to fetch: ${odooFields.length}`);
  console.log();

  // Fetch records from Odoo (limit to first 500 for test)
  console.log('[Step 3] Fetching records from Odoo (first 500 for test)...');
  const odooClient = getOdooClient();

  const records = await odooClient.searchRead<Record<string, unknown>>(
    TEST_MODEL,
    [], // All records
    odooFields,
    { limit: 500, order: 'id' }
  );
  console.log(`  Fetched ${records.length} records from Odoo`);
  console.log();

  // Transform records
  console.log('[Step 4] Transforming records...');
  const transformed = await transformPipelineRecords(records, TEST_MODEL);
  console.log(`  Transformed ${transformed.length} records`);
  console.log();

  // Embed records
  console.log('[Step 5] Embedding records...');
  const texts = transformed.map(r => r.vector_text);
  const embeddings = await embedBatch(texts, 'document');
  console.log(`  Generated ${embeddings.length} embeddings`);
  console.log();

  // Build points
  console.log('[Step 6] Building points for Qdrant...');
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
  console.log(`  Built ${points.length} points`);
  console.log();

  // Upload with chunking (this is the critical test)
  console.log('[Step 7] Uploading with chunked upsert (100 per chunk)...');
  const startTime = Date.now();

  try {
    await upsertToUnifiedCollection(points, 100);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  SUCCESS: Uploaded ${points.length} points in ${duration}s`);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  FAILED after ${duration}s: ${error}`);
    process.exit(1);
  }
  console.log();

  // Verify
  console.log('[Step 8] Verifying upload...');
  const afterCount = await client.count(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: TEST_MODEL } },
      ],
    },
    exact: true,
  });
  console.log(`  ${TEST_MODEL} count: ${beforeCount.count} -> ${afterCount.count}`);
  console.log(`  Records added: ${afterCount.count - beforeCount.count}`);
  console.log();

  console.log('='.repeat(60));
  if (afterCount.count > beforeCount.count) {
    console.log('SUCCESS: Chunked upload working correctly!');
  } else {
    console.log('WARNING: No new records added (may already exist)');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
