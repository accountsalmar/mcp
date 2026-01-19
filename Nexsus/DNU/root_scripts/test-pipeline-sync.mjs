/**
 * Test Pipeline Sync with Streaming Batch Processing
 *
 * Tests the memory-efficient streaming sync implementation.
 * Usage: node test-pipeline-sync.mjs [model_name] [test_limit]
 *
 * Examples:
 *   node test-pipeline-sync.mjs crm.lead 10     # Test with 10 records
 *   node test-pipeline-sync.mjs crm.lead 100    # Test with 100 records
 */

import 'dotenv/config';

import { initializeEmbeddingService } from './dist/services/embedding-service.js';
import { initializeVectorClient, getPipelineCollectionInfo } from './dist/services/vector-client.js';
import { syncPipelineData, previewPipelineTransform } from './dist/services/pipeline-data-sync.js';

async function testPipelineSync() {
  // Parse arguments
  const modelName = process.argv[2] || 'crm.lead';
  const testLimit = parseInt(process.argv[3]) || 10;

  console.log('='.repeat(60));
  console.log('TEST: Pipeline Sync with Streaming (Bug 4 Fix Verification)');
  console.log('='.repeat(60));
  console.log();
  console.log(`  Model: ${modelName}`);
  console.log(`  Test Limit: ${testLimit} records`);
  console.log(`  Batch Size: 500 (streaming)`);
  console.log();

  // Initialize services
  console.log('Initializing services...');
  const embeddingReady = initializeEmbeddingService();
  const vectorReady = initializeVectorClient();

  if (!embeddingReady || !vectorReady) {
    console.error('Services not ready. Check .env configuration.');
    process.exit(1);
  }
  console.log('  Services: READY\n');

  // Preview model config
  console.log('Validating model configuration...');
  const preview = previewPipelineTransform(modelName);
  if (!preview.valid) {
    console.error(`  Model validation failed: ${preview.errors.join(', ')}`);
    process.exit(1);
  }
  console.log(`  Model ID: ${preview.model_config.model_id}`);
  console.log(`  Total Fields: ${preview.model_config.total_fields}`);
  console.log(`  Payload Fields: ${preview.model_config.payload_fields}`);
  console.log(`  Odoo Fields: ${preview.model_config.odoo_fields.length}`);
  console.log();

  // Run sync
  console.log('='.repeat(60));
  console.log('STARTING STREAMING SYNC...');
  console.log('='.repeat(60));
  console.log();

  const startTime = Date.now();
  const result = await syncPipelineData(modelName, {
    test_limit: testLimit,
    fetch_batch_size: 500, // Use 500 record batches
  });

  console.log();
  console.log('='.repeat(60));
  console.log('SYNC RESULT');
  console.log('='.repeat(60));
  console.log(`  Success: ${result.success ? 'YES' : 'NO'}`);
  console.log(`  Records Fetched: ${result.records_fetched}`);
  console.log(`  Records Uploaded: ${result.records_uploaded}`);
  console.log(`  Records Failed: ${result.records_failed}`);
  console.log(`  Duration: ${(result.duration_ms / 1000).toFixed(1)} seconds`);
  console.log(`  Sync Type: ${result.sync_type}`);

  if (result.errors && result.errors.length > 0) {
    console.log('\n  Errors:');
    result.errors.forEach(e => console.log(`    - ${e}`));
  }

  // Check collection status
  console.log('\nCollection Status:');
  const collectionInfo = await getPipelineCollectionInfo();
  console.log(`  Collection: ${collectionInfo.collectionName}`);
  console.log(`  Exists: ${collectionInfo.exists}`);
  console.log(`  Vector Count: ${collectionInfo.vectorCount}`);
  console.log();

  if (result.success && result.records_uploaded > 0) {
    console.log('STATUS: PASS ✓ - Streaming sync completed successfully');
  } else if (result.success && result.records_uploaded === 0) {
    console.log('STATUS: OK - No records to sync (model may be empty or test limit too low)');
  } else {
    console.log('STATUS: FAIL - Sync had errors');
    process.exit(1);
  }
}

testPipelineSync().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
