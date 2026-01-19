#!/usr/bin/env npx tsx
/**
 * Stage 3 Verification Tests
 *
 * Tests schema sync to unified collection:
 * 1. Sync completes successfully
 * 2. Correct number of points (~17,932)
 * 3. V2 UUID format verified
 * 4. point_type = 'schema' on all points
 * 5. FK references use V2 format
 * 6. Semantic search works
 * 7. Idempotent (second sync = same count)
 *
 * Run with: npx tsx scripts/test-stage3-schema-sync.ts
 */

import 'dotenv/config';
import {
  initializeVectorClient,
  getQdrantClient,
  getUnifiedCollectionInfo,
  collectionExists,
} from '../src/services/vector-client.js';
import { initializeEmbeddingService, embed } from '../src/services/embedding-service.js';
import {
  syncSchemaToUnified,
  getUnifiedSchemaSyncStatus,
} from '../src/services/unified-schema-sync.js';
import { isValidSchemaUuidV2, parseSchemaUuidV2 } from '../src/utils/uuid-v2.js';
import { UNIFIED_CONFIG } from '../src/constants.js';

// =============================================================================
// TEST RUNNER
// =============================================================================

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<boolean>): Promise<void> {
  try {
    const result = await fn();
    if (result) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.error(`  ❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.error(`  ❌ ${name} - Exception: ${error}`);
    failed++;
  }
}

// =============================================================================
// TESTS
// =============================================================================

async function runTests(): Promise<void> {
  console.log('');
  console.log('Stage 3: Schema Sync to Unified Collection - Tests');
  console.log('=' .repeat(55));
  console.log('');

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  console.log('Initializing services...');

  const vectorInitialized = initializeVectorClient();
  if (!vectorInitialized) {
    console.error('Failed to initialize vector client. Check QDRANT_HOST.');
    process.exit(1);
  }

  initializeEmbeddingService();

  const client = getQdrantClient();
  const collectionName = UNIFIED_CONFIG.COLLECTION_NAME;

  // Check unified collection exists (from Stage 2)
  const unifiedExists = await collectionExists(collectionName);
  if (!unifiedExists) {
    console.error(`Unified collection '${collectionName}' does not exist.`);
    console.error('Run Stage 2 first: npx tsx scripts/create-unified-collection.ts');
    process.exit(1);
  }

  console.log(`Unified collection '${collectionName}' found.`);
  console.log('');

  // ==========================================================================
  // TEST GROUP 1: SYNC EXECUTION
  // ==========================================================================
  console.log('📦 Sync Execution Tests');
  console.log('-'.repeat(30));

  await test('T3.1: syncSchemaToUnified() completes without error', async () => {
    // Use V2 generated schema from Stage 0
    const result = await syncSchemaToUnified({ forceRecreate: true, excelSource: 'v2' });
    console.log(`       Uploaded: ${result.uploaded}, Failed: ${result.failed}, Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    if (result.errors && result.errors.length > 0) {
      console.log(`       Errors: ${result.errors.slice(0, 3).join('; ')}...`);
    }
    return result.success && result.uploaded > 17000;
  });

  // ==========================================================================
  // TEST GROUP 2: POINT COUNT VERIFICATION
  // ==========================================================================
  console.log('');
  console.log('📊 Point Count Tests');
  console.log('-'.repeat(30));

  await test('T3.2: Schema point count is ~17,932', async () => {
    const status = await getUnifiedSchemaSyncStatus();
    console.log(`       Schema points: ${status.schemaCount}`);
    return status.schemaCount >= 17900 && status.schemaCount <= 18000;
  });

  await test('T3.3: All unified points have point_type=schema (for now)', async () => {
    // In Stage 3, only schema points exist
    const schemaResult = await client.count(collectionName, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }],
      },
      exact: true,
    });

    const info = await getUnifiedCollectionInfo();
    console.log(`       Schema: ${schemaResult.count}, Total: ${info.vectorCount}`);

    // All points should be schema (no data/graph yet)
    return schemaResult.count === info.vectorCount;
  });

  // ==========================================================================
  // TEST GROUP 3: V2 UUID FORMAT VERIFICATION
  // ==========================================================================
  console.log('');
  console.log('🔤 V2 UUID Format Tests');
  console.log('-'.repeat(30));

  await test('T3.4: Sample points have valid V2 UUID format', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }],
      },
      limit: 10,
      with_payload: false,
    });

    let allValid = true;
    for (const point of scroll.points) {
      const uuid = String(point.id);
      if (!isValidSchemaUuidV2(uuid)) {
        console.log(`       Invalid UUID: ${uuid}`);
        allValid = false;
        break;
      }
    }

    if (allValid) {
      console.log(`       Checked ${scroll.points.length} UUIDs - all valid V2 format`);
    }
    return allValid;
  });

  await test('T3.5: UUID field_id matches payload field_id', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }],
      },
      limit: 10,
      with_payload: true,
    });

    for (const point of scroll.points) {
      const uuid = String(point.id);
      const parsed = parseSchemaUuidV2(uuid);
      const payloadFieldId = point.payload?.field_id;

      if (!parsed || parsed.fieldId !== payloadFieldId) {
        console.log(`       Mismatch: UUID ${uuid} → ${parsed?.fieldId} vs payload ${payloadFieldId}`);
        return false;
      }
    }

    console.log(`       Checked 10 points - UUID field_id matches payload`);
    return true;
  });

  // ==========================================================================
  // TEST GROUP 4: FK REFERENCE TESTS
  // ==========================================================================
  console.log('');
  console.log('🔗 FK Reference Tests');
  console.log('-'.repeat(30));

  await test('T3.6: FK field has V2 format fk_qdrant_id', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'schema' } },
          { key: 'field_type', match: { value: 'many2one' } },
        ],
      },
      limit: 10,
      with_payload: true,
    });

    let fkCount = 0;
    for (const point of scroll.points) {
      const fkQdrantId = point.payload?.fk_qdrant_id;
      if (fkQdrantId && typeof fkQdrantId === 'string') {
        fkCount++;
        // V2 FK refs start with 00000003-MMMM (variable model ID)
        if (!fkQdrantId.startsWith('00000003-')) {
          console.log(`       FK ref not V2 format: ${fkQdrantId}`);
          return false;
        }
      }
    }

    console.log(`       Checked ${fkCount} FK fields - all use V2 format`);
    return fkCount > 0;
  });

  // ==========================================================================
  // TEST GROUP 5: SEMANTIC SEARCH
  // ==========================================================================
  console.log('');
  console.log('🔍 Semantic Search Tests');
  console.log('-'.repeat(30));

  await test('T3.7: Semantic search returns schema results', async () => {
    const queryVector = await embed('partner customer contact name', 'query');

    const results = await client.search(collectionName, {
      vector: queryVector,
      limit: 5,
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }],
      },
      with_payload: true,
    });

    console.log(`       Found ${results.length} results`);
    if (results.length > 0) {
      const top = results[0];
      console.log(`       Top: ${top.payload?.model_name}.${top.payload?.field_name} (score: ${top.score.toFixed(3)})`);
    }

    return results.length >= 3;
  });

  await test('T3.8: Search results have expected payload fields', async () => {
    const queryVector = await embed('expected revenue monetary amount', 'query');

    const results = await client.search(collectionName, {
      vector: queryVector,
      limit: 1,
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }],
      },
      with_payload: true,
    });

    if (results.length === 0) {
      console.log('       No results found');
      return false;
    }

    const payload = results[0].payload;
    const hasRequired =
      payload?.field_id !== undefined &&
      payload?.model_name !== undefined &&
      payload?.point_type === 'schema';

    console.log(`       Top result: ${payload?.model_name}.${payload?.field_name}`);
    console.log(`       Has required fields: ${hasRequired}`);

    return hasRequired;
  });

  // ==========================================================================
  // TEST GROUP 6: IDEMPOTENCY
  // ==========================================================================
  console.log('');
  console.log('🔄 Idempotency Tests');
  console.log('-'.repeat(30));

  await test('T3.9: Second sync updates same points (no duplicates)', async () => {
    const beforeStatus = await getUnifiedSchemaSyncStatus();
    const beforeCount = beforeStatus.schemaCount;

    // Run sync again WITHOUT forceRecreate (upsert mode)
    const result = await syncSchemaToUnified({ forceRecreate: false, excelSource: 'v2' });

    const afterStatus = await getUnifiedSchemaSyncStatus();
    const afterCount = afterStatus.schemaCount;

    console.log(`       Before: ${beforeCount}, After: ${afterCount}, Uploaded: ${result.uploaded}`);

    // Count should remain the same (upsert updates existing)
    return afterCount === beforeCount;
  });

  // ==========================================================================
  // TEST GROUP 7: LEGACY COLLECTION VERIFICATION
  // ==========================================================================
  console.log('');
  console.log('🔒 Legacy Collection Tests');
  console.log('-'.repeat(30));

  await test('T3.10: Legacy nexsus collection still exists', async () => {
    const exists = await collectionExists('nexsus');
    console.log(`       nexsus collection: ${exists ? 'exists' : 'NOT FOUND'}`);
    return exists === true;
  });

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('');
  console.log('='.repeat(55));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(55));

  if (failed > 0) {
    console.log('');
    console.log('Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 All Stage 3 tests passed!');
    console.log('');
    console.log('The unified collection now contains:');
    const finalStatus = await getUnifiedSchemaSyncStatus();
    console.log(`  - ${finalStatus.schemaCount} schema points (point_type: "schema")`);
    console.log('');
    console.log('Ready for Stage 4: Small Batch Data Sync');
    console.log('');
  }
}

// =============================================================================
// MAIN
// =============================================================================

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
