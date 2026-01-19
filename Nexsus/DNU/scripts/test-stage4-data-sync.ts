#!/usr/bin/env npx tsx
/**
 * Stage 4 Verification Tests
 *
 * Tests data sync to unified collection:
 * 1. Sync 10 crm.lead records
 * 2. Data UUIDs are V2 format
 * 3. All have point_type='data'
 * 4. FK references use V2 format
 * 5. Graph relationships created
 * 6. Graph UUIDs are V2 format
 * 7. Data points have graph_refs
 * 8. Semantic search works
 * 9. Idempotent (second sync = same count)
 * 10. Schema unchanged
 *
 * Run with: npx tsx scripts/test-stage4-data-sync.ts
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
  syncDataToUnified,
  getUnifiedDataSyncStatus,
  clearUnifiedDataPoints,
} from '../src/services/unified-data-sync.js';
import {
  getUnifiedGraphCount,
  clearUnifiedGraphPoints,
} from '../src/services/unified-graph-sync.js';
import { getUnifiedSchemaSyncStatus } from '../src/services/unified-schema-sync.js';
import {
  isValidDataUuidV2,
  parseDataUuidV2,
  isValidGraphUuidV2,
} from '../src/utils/uuid-v2.js';
import { UNIFIED_CONFIG } from '../src/constants.js';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_MODEL = 'crm.lead';
const TEST_MODEL_ID = 344;
const TEST_LIMIT = 10;

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
  console.log('Stage 4: Data Sync to Unified Collection - Tests');
  console.log('='.repeat(55));
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

  // Get initial schema count for comparison
  const initialSchemaStatus = await getUnifiedSchemaSyncStatus();
  const initialSchemaCount = initialSchemaStatus.schemaCount;
  console.log(`Initial schema points: ${initialSchemaCount}`);
  console.log('');

  // ==========================================================================
  // CLEANUP: Clear existing data and graph points for clean test
  // ==========================================================================
  console.log('🧹 Cleanup Phase');
  console.log('-'.repeat(30));
  console.log('Clearing existing data and graph points for clean test...');

  const dataCleared = await clearUnifiedDataPoints(TEST_MODEL);
  console.log(`  Cleared ${dataCleared} data points for ${TEST_MODEL}`);

  const graphCleared = await clearUnifiedGraphPoints();
  console.log(`  Cleared ${graphCleared} graph points`);
  console.log('');

  // ==========================================================================
  // TEST GROUP 1: SYNC EXECUTION
  // ==========================================================================
  console.log('📦 Sync Execution Tests');
  console.log('-'.repeat(30));

  let syncResult: Awaited<ReturnType<typeof syncDataToUnified>> | null = null;

  await test(`T4.1: syncDataToUnified() syncs ${TEST_LIMIT} ${TEST_MODEL} records`, async () => {
    syncResult = await syncDataToUnified({
      modelName: TEST_MODEL,
      limit: TEST_LIMIT,
      forceRecreate: true,
    });

    console.log(`       Fetched: ${syncResult.records_fetched}, Uploaded: ${syncResult.records_uploaded}`);
    console.log(`       Graph created: ${syncResult.graph_created}, Graph refs: ${syncResult.graph_refs_total}`);
    console.log(`       Duration: ${(syncResult.duration_ms / 1000).toFixed(1)}s`);

    if (syncResult.errors && syncResult.errors.length > 0) {
      console.log(`       Errors: ${syncResult.errors.slice(0, 3).join('; ')}...`);
    }

    return syncResult.success && syncResult.records_uploaded >= TEST_LIMIT;
  });

  // ==========================================================================
  // TEST GROUP 2: DATA UUID FORMAT VERIFICATION
  // ==========================================================================
  console.log('');
  console.log('🔤 V2 Data UUID Format Tests');
  console.log('-'.repeat(30));

  await test('T4.2: Data point UUIDs are V2 format', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: TEST_MODEL } },
        ],
      },
      limit: 10,
      with_payload: false,
    });

    let allValid = true;
    for (const point of scroll.points) {
      const uuid = String(point.id);
      if (!isValidDataUuidV2(uuid)) {
        console.log(`       Invalid Data UUID: ${uuid}`);
        allValid = false;
        break;
      }
    }

    if (allValid) {
      console.log(`       Checked ${scroll.points.length} UUIDs - all valid V2 Data format`);
      console.log(`       Example: ${scroll.points[0]?.id}`);
    }
    return allValid;
  });

  await test('T4.3: UUID model_id matches payload model_id', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: TEST_MODEL } },
        ],
      },
      limit: 10,
      with_payload: true,
    });

    for (const point of scroll.points) {
      const uuid = String(point.id);
      const parsed = parseDataUuidV2(uuid);
      const payloadModelId = point.payload?.model_id;

      if (!parsed || parsed.modelId !== payloadModelId) {
        console.log(`       Mismatch: UUID ${uuid} → model_id ${parsed?.modelId} vs payload ${payloadModelId}`);
        return false;
      }
    }

    console.log(`       Checked 10 points - UUID model_id matches payload`);
    return true;
  });

  // ==========================================================================
  // TEST GROUP 3: POINT TYPE VERIFICATION
  // ==========================================================================
  console.log('');
  console.log('🏷️ Point Type Tests');
  console.log('-'.repeat(30));

  await test('T4.4: All synced data points have point_type=data', async () => {
    // Count data points for this model
    const dataResult = await client.count(collectionName, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: TEST_MODEL } },
        ],
      },
      exact: true,
    });

    // Verify a sample point has correct point_type
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: TEST_MODEL } },
        ],
      },
      limit: 5,
      with_payload: true,
    });

    let allHaveCorrectType = true;
    for (const point of scroll.points) {
      if (point.payload?.point_type !== 'data') {
        allHaveCorrectType = false;
        console.log(`       Point ${point.id} has point_type=${point.payload?.point_type}`);
      }
    }

    console.log(`       Data points for ${TEST_MODEL}: ${dataResult.count}`);
    console.log(`       All sampled points have correct point_type: ${allHaveCorrectType}`);
    return dataResult.count >= TEST_LIMIT && allHaveCorrectType;
  });

  // ==========================================================================
  // TEST GROUP 4: FK REFERENCE TESTS
  // ==========================================================================
  console.log('');
  console.log('🔗 FK Reference Tests');
  console.log('-'.repeat(30));

  await test('T4.5: FK *_qdrant fields use V2 Data UUID format', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: TEST_MODEL } },
        ],
      },
      limit: 5,
      with_payload: true,
    });

    let fkFieldsFound = 0;
    let fkFieldsValid = 0;

    for (const point of scroll.points) {
      const payload = point.payload as Record<string, unknown>;

      // Check common FK fields
      const fkQdrantFields = ['partner_id_qdrant', 'stage_id_qdrant', 'user_id_qdrant', 'team_id_qdrant'];

      for (const fkField of fkQdrantFields) {
        const fkValue = payload[fkField];
        if (fkValue && typeof fkValue === 'string') {
          fkFieldsFound++;
          if (isValidDataUuidV2(fkValue)) {
            fkFieldsValid++;
          } else {
            console.log(`       Invalid FK UUID: ${fkField} = ${fkValue}`);
          }
        }
      }
    }

    console.log(`       FK fields found: ${fkFieldsFound}, Valid V2: ${fkFieldsValid}`);
    return fkFieldsFound > 0 && fkFieldsFound === fkFieldsValid;
  });

  // ==========================================================================
  // TEST GROUP 5: GRAPH RELATIONSHIP TESTS
  // ==========================================================================
  console.log('');
  console.log('📊 Graph Relationship Tests');
  console.log('-'.repeat(30));

  await test('T4.6: Graph relationships were created', async () => {
    const graphCount = await getUnifiedGraphCount();
    console.log(`       Graph points in collection: ${graphCount}`);
    return graphCount > 0;
  });

  await test('T4.7: Graph point UUIDs are V2 format', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'graph' } }],
      },
      limit: 10,
      with_payload: false,
    });

    if (scroll.points.length === 0) {
      console.log('       No graph points found');
      return false;
    }

    let allValid = true;
    for (const point of scroll.points) {
      const uuid = String(point.id);
      if (!isValidGraphUuidV2(uuid)) {
        console.log(`       Invalid Graph UUID: ${uuid}`);
        allValid = false;
        break;
      }
    }

    if (allValid) {
      console.log(`       Checked ${scroll.points.length} Graph UUIDs - all valid V2 format`);
      console.log(`       Example: ${scroll.points[0]?.id}`);
    }
    return allValid;
  });

  await test('T4.8: Data points have graph_refs arrays', async () => {
    const scroll = await client.scroll(collectionName, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: TEST_MODEL } },
        ],
      },
      limit: 5,
      with_payload: true,
    });

    let pointsWithRefs = 0;
    let totalRefs = 0;

    for (const point of scroll.points) {
      const graphRefs = point.payload?.graph_refs;
      if (Array.isArray(graphRefs) && graphRefs.length > 0) {
        pointsWithRefs++;
        totalRefs += graphRefs.length;
      }
    }

    console.log(`       Points with graph_refs: ${pointsWithRefs}/${scroll.points.length}`);
    console.log(`       Total graph_refs: ${totalRefs}`);

    return pointsWithRefs > 0;
  });

  // ==========================================================================
  // TEST GROUP 6: SEMANTIC SEARCH
  // ==========================================================================
  console.log('');
  console.log('🔍 Semantic Search Tests');
  console.log('-'.repeat(30));

  await test('T4.9: Semantic search returns data results', async () => {
    const queryVector = await embed('hospital project construction tender', 'query');

    const results = await client.search(collectionName, {
      vector: queryVector,
      limit: 5,
      filter: {
        must: [{ key: 'point_type', match: { value: 'data' } }],
      },
      with_payload: true,
    });

    console.log(`       Found ${results.length} data results`);
    if (results.length > 0) {
      const top = results[0];
      console.log(`       Top: record_id=${top.payload?.record_id} (score: ${top.score.toFixed(3)})`);
    }

    return results.length >= 1;
  });

  // ==========================================================================
  // TEST GROUP 7: IDEMPOTENCY
  // ==========================================================================
  console.log('');
  console.log('🔄 Idempotency Tests');
  console.log('-'.repeat(30));

  await test('T4.10: Second sync updates same points (no duplicates)', async () => {
    const beforeStatus = await getUnifiedDataSyncStatus();
    const beforeDataCount = beforeStatus.dataCount;
    const beforeGraphCount = beforeStatus.graphCount;

    // Run sync again WITHOUT forceRecreate (upsert mode)
    const result = await syncDataToUnified({
      modelName: TEST_MODEL,
      limit: TEST_LIMIT,
      forceRecreate: false,
    });

    const afterStatus = await getUnifiedDataSyncStatus();
    const afterDataCount = afterStatus.dataCount;
    const afterGraphCount = afterStatus.graphCount;

    console.log(`       Data: Before=${beforeDataCount}, After=${afterDataCount}`);
    console.log(`       Graph: Before=${beforeGraphCount}, After=${afterGraphCount}`);
    console.log(`       Uploaded this run: ${result.records_uploaded}`);

    // Counts should remain the same (upsert updates existing)
    return afterDataCount === beforeDataCount && afterGraphCount === beforeGraphCount;
  });

  // ==========================================================================
  // TEST GROUP 8: SCHEMA UNCHANGED
  // ==========================================================================
  console.log('');
  console.log('🔒 Schema Preservation Tests');
  console.log('-'.repeat(30));

  await test('T4.11: Schema points unchanged after data sync', async () => {
    const finalSchemaStatus = await getUnifiedSchemaSyncStatus();
    const finalSchemaCount = finalSchemaStatus.schemaCount;

    console.log(`       Initial: ${initialSchemaCount}, Final: ${finalSchemaCount}`);
    return finalSchemaCount === initialSchemaCount;
  });

  // ==========================================================================
  // TEST GROUP 9: LEGACY COLLECTION VERIFICATION
  // ==========================================================================
  console.log('');
  console.log('🏛️ Legacy Collection Tests');
  console.log('-'.repeat(30));

  await test('T4.12: Legacy nexsus collection still exists', async () => {
    const exists = await collectionExists('nexsus');
    console.log(`       nexsus collection: ${exists ? 'exists' : 'NOT FOUND'}`);
    return exists === true;
  });

  await test('T4.13: Legacy nexsus_data collection still exists', async () => {
    const exists = await collectionExists('nexsus_data');
    console.log(`       nexsus_data collection: ${exists ? 'exists' : 'NOT FOUND'}`);
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
    console.log('🎉 All Stage 4 tests passed!');
    console.log('');
    console.log('The unified collection now contains:');
    const finalStatus = await getUnifiedDataSyncStatus();
    console.log(`  - ${finalStatus.schemaCount} schema points (point_type: "schema")`);
    console.log(`  - ${finalStatus.dataCount} data points (point_type: "data")`);
    console.log(`  - ${finalStatus.graphCount} graph points (point_type: "graph")`);
    console.log('');
    console.log('Ready for Stage 5: Full Cascade Data Sync');
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
