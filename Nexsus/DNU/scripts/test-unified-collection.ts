/**
 * Test Unified Collection
 *
 * Validates Stage 2 implementation by testing:
 * 1. Collection creation success
 * 2. All indexes present
 * 3. Idempotency (second create returns false)
 * 4. Legacy collections untouched
 * 5. V2 UUID point insertion works
 *
 * Run with: npx tsx scripts/test-unified-collection.ts
 */

import 'dotenv/config';
import {
  initializeVectorClient,
  createUnifiedCollection,
  getUnifiedCollectionInfo,
  getUnifiedCollectionIndexes,
  deleteUnifiedCollection,
  collectionExists,
  getQdrantClient,
} from '../src/services/vector-client.js';
import { buildDataUuidV2 } from '../src/utils/uuid-v2.js';

// =============================================================================
// TEST RUNNER
// =============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<boolean> | boolean): Promise<void> {
  return Promise.resolve(fn())
    .then((result) => {
      if (result) {
        console.log(`  ✅ ${name}`);
        passed++;
      } else {
        console.error(`  ❌ ${name}`);
        failed++;
      }
    })
    .catch((error) => {
      console.error(`  ❌ ${name} - Exception: ${error}`);
      failed++;
    });
}

// =============================================================================
// TESTS
// =============================================================================

async function runTests(): Promise<void> {
  console.log('');
  console.log('Stage 2 Verification Tests');
  console.log('==========================');
  console.log('');

  // Initialize client
  console.log('Initializing Qdrant client...');
  const initialized = initializeVectorClient();
  if (!initialized) {
    console.error('Failed to initialize client');
    process.exit(1);
  }

  // Check if collection exists for test planning
  const existsBefore = await collectionExists('nexsus_unified');

  // Clean up for fresh test if needed
  if (existsBefore) {
    console.log('Cleaning up existing unified collection for fresh test...');
    await deleteUnifiedCollection();
  }

  // ==========================================================================
  // Test Group 1: Collection Creation
  // ==========================================================================
  console.log('');
  console.log('📦 Collection Creation Tests');
  console.log('----------------------------');

  await test('T2.1: createUnifiedCollection() first time returns true', async () => {
    const created = await createUnifiedCollection();
    return created === true;
  });

  await test('T2.2: createUnifiedCollection() second time returns false (idempotent)', async () => {
    const created = await createUnifiedCollection();
    return created === false;
  });

  await test('T2.3: Collection exists after creation', async () => {
    const exists = await collectionExists('nexsus_unified');
    return exists === true;
  });

  // ==========================================================================
  // Test Group 2: Index Verification
  // ==========================================================================
  console.log('');
  console.log('📇 Index Verification Tests');
  console.log('---------------------------');

  await test('T2.4: point_type index exists (primary discriminator)', async () => {
    const indexes = await getUnifiedCollectionIndexes();
    return indexes.includes('point_type');
  });

  await test('T2.5: model_name index exists', async () => {
    const indexes = await getUnifiedCollectionIndexes();
    return indexes.includes('model_name');
  });

  await test('T2.6: record_id index exists (data-specific)', async () => {
    const indexes = await getUnifiedCollectionIndexes();
    return indexes.includes('record_id');
  });

  await test('T2.7: source_model index exists (graph-specific)', async () => {
    const indexes = await getUnifiedCollectionIndexes();
    return indexes.includes('source_model');
  });

  await test('T2.8: At least 25 indexes created', async () => {
    const info = await getUnifiedCollectionInfo();
    return info.indexCount >= 25;
  });

  // ==========================================================================
  // Test Group 3: Legacy Collections Untouched
  // ==========================================================================
  console.log('');
  console.log('🔒 Legacy Collections Tests');
  console.log('---------------------------');

  await test('T2.9: nexsus collection still exists', async () => {
    const exists = await collectionExists('nexsus');
    return exists === true;
  });

  await test('T2.10: nexsus_data collection still exists', async () => {
    const exists = await collectionExists('nexsus_data');
    return exists === true;
  });

  await test('T2.11: nexsus_graph collection still exists', async () => {
    const exists = await collectionExists('nexsus_graph');
    return exists === true;
  });

  // ==========================================================================
  // Test Group 4: V2 UUID Insertion
  // ==========================================================================
  console.log('');
  console.log('🆔 V2 UUID Insertion Tests');
  console.log('--------------------------');

  await test('T2.12: Insert test point with V2 Data UUID', async () => {
    const client = getQdrantClient();
    const testUuid = buildDataUuidV2(1, 1); // "00000002-0001-0000-000000000001"

    // Create a test vector (1024 dimensions)
    const testVector = new Array(1024).fill(0).map(() => Math.random() * 0.1);

    await client.upsert('nexsus_unified', {
      wait: true,
      points: [
        {
          id: testUuid,
          vector: testVector,
          payload: {
            point_type: 'pipeline_data',
            model_name: 'test.model',
            model_id: 1,
            record_id: 1,
            test_marker: 'stage2_test',
          },
        },
      ],
    });

    // Verify it was inserted
    const result = await client.retrieve('nexsus_unified', {
      ids: [testUuid],
      with_payload: true,
    });

    return result.length === 1 && result[0].payload?.test_marker === 'stage2_test';
  });

  await test('T2.13: Retrieve test point by V2 UUID', async () => {
    const client = getQdrantClient();
    const testUuid = buildDataUuidV2(1, 1);

    const result = await client.retrieve('nexsus_unified', {
      ids: [testUuid],
      with_payload: true,
    });

    return result.length === 1;
  });

  await test('T2.14: Delete test point', async () => {
    const client = getQdrantClient();
    const testUuid = buildDataUuidV2(1, 1);

    await client.delete('nexsus_unified', {
      wait: true,
      points: [testUuid],
    });

    // Verify deletion
    const result = await client.retrieve('nexsus_unified', {
      ids: [testUuid],
    });

    return result.length === 0;
  });

  await test('T2.15: Collection vector count is 0 after cleanup', async () => {
    const info = await getUnifiedCollectionInfo();
    return info.vectorCount === 0;
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('');
  console.log('='.repeat(50));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('');
    console.log('Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 All Stage 2 tests passed!');
    console.log('');
    console.log('The unified collection is ready for:');
    console.log('  - Stage 3: Schema sync to unified collection');
    console.log('  - Stage 4: Small batch data sync');
    console.log('  - Stage 5: Full cascade sync');
    console.log('');
  }
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
