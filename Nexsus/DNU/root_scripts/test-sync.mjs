/**
 * Test script for pipeline sync
 * Usage: node test-sync.mjs [model_name] [test_limit]
 */

import 'dotenv/config';
import { syncPipelineData } from './dist/services/pipeline-data-sync.js';
import { initializeEmbeddingService, isEmbeddingServiceAvailable } from './dist/services/embedding-service.js';
import { initializeVectorClient, isVectorClientAvailable } from './dist/services/vector-client.js';

const modelName = process.argv[2] || 'account.account';
const testLimit = parseInt(process.argv[3] || '10', 10);

// Initialize services
console.log('Initializing services...');
const embeddingReady = initializeEmbeddingService();
console.log('Embedding service:', embeddingReady ? 'Ready' : 'Not available (check VOYAGE_API_KEY)');

const vectorReady = initializeVectorClient();
console.log('Vector client:', vectorReady ? 'Ready' : 'Not available (check QDRANT_HOST)');

if (!embeddingReady || !vectorReady) {
  console.error('\nServices not ready. Please check your .env file.');
  process.exit(1);
}
console.log('');

console.log('='.repeat(60));
console.log(`Testing Pipeline Sync: ${modelName}`);
console.log(`Test Limit: ${testLimit} records`);
console.log('='.repeat(60));
console.log('');

try {
  const result = await syncPipelineData(modelName, {
    test_limit: testLimit,
    include_archived: true,
    force_full: true,  // Force full sync for testing
  });

  console.log('\n--- Sync Result ---');
  console.log('Success:', result.success);
  console.log('Model:', result.model_name);
  console.log('Model ID:', result.model_id);
  console.log('Sync Type:', result.sync_type);
  console.log('Records Fetched:', result.records_fetched);
  console.log('Records Uploaded:', result.records_uploaded);
  console.log('Records Failed:', result.records_failed);
  console.log('Duration:', (result.duration_ms / 1000).toFixed(2) + 's');

  if (result.errors && result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(e => console.log('  -', e));
  }

  if (result.restricted_fields && result.restricted_fields.length > 0) {
    console.log('\nRestricted Fields:');
    result.restricted_fields.forEach(f => console.log('  -', f));
  }

} catch (error) {
  console.error('Sync failed:', error.message);
  console.error(error.stack);
}

console.log('\n' + '='.repeat(60));
