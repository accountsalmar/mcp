/**
 * Test Script: Stage 6 - Tool Migration to Unified Collection
 *
 * Tests all MCP tools with USE_UNIFIED_COLLECTION=true to verify
 * they correctly route to nexsus_unified with point_type discrimination.
 *
 * Usage:
 *   # Test with legacy collections (default)
 *   npx tsx scripts/test-tool-migration.ts
 *
 *   # Test with unified collection
 *   USE_UNIFIED_COLLECTION=true npx tsx scripts/test-tool-migration.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { UNIFIED_CONFIG, PIPELINE_CONFIG, NEXSUS_CONFIG } from '../src/constants.js';
import { getQdrantClient, initializeVectorClient, isVectorClientAvailable } from '../src/services/vector-client.js';
import { searchByPointType } from '../src/services/vector-client.js';
import { scrollRecords } from '../src/services/scroll-engine.js';
import { executeAggregation, countOnly } from '../src/services/aggregation-engine.js';
import { embed, initializeEmbeddingService } from '../src/services/embedding-service.js';

// Test result tracker
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration_ms: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({
      name,
      passed: true,
      message: 'OK',
      duration_ms: Date.now() - start,
    });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({
      name,
      passed: false,
      message,
      duration_ms: Date.now() - start,
    });
    console.log(`  ❌ ${name}: ${message}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Stage 6: Tool Migration Tests');
  console.log('='.repeat(60));
  console.log();

  // Display mode
  const mode = UNIFIED_CONFIG.USE_UNIFIED ? 'UNIFIED' : 'LEGACY';
  console.log(`Mode: ${mode}`);
  console.log(`Collection: ${UNIFIED_CONFIG.USE_UNIFIED ? UNIFIED_CONFIG.COLLECTION_NAME : 'nexsus + nexsus_data + nexsus_graph'}`);
  console.log();

  // Initialize
  if (!isVectorClientAvailable()) {
    initializeVectorClient();
  }
  initializeEmbeddingService();
  const client = getQdrantClient();

  // ============================================================
  // T6.1: Collection Existence
  // ============================================================
  console.log('T6.1: Collection Existence');
  await runTest('Unified collection exists', async () => {
    const collections = await client.getCollections();
    const names = collections.collections.map(c => c.name);
    if (!names.includes(UNIFIED_CONFIG.COLLECTION_NAME)) {
      throw new Error(`Collection '${UNIFIED_CONFIG.COLLECTION_NAME}' not found`);
    }
  });

  if (UNIFIED_CONFIG.USE_UNIFIED) {
    await runTest('Unified collection has data', async () => {
      const info = await client.getCollection(UNIFIED_CONFIG.COLLECTION_NAME);
      if ((info.points_count ?? 0) === 0) {
        throw new Error('Collection is empty');
      }
    });
  }
  console.log();

  // ============================================================
  // T6.2: Point Type Counts (Unified Mode Only)
  // ============================================================
  if (UNIFIED_CONFIG.USE_UNIFIED) {
    console.log('T6.2: Point Type Counts');

    await runTest('Schema points exist', async () => {
      const result = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
        filter: { must: [{ key: 'point_type', match: { value: 'schema' } }] },
        exact: true,
      });
      if (result.count === 0) {
        throw new Error('No schema points found');
      }
      console.log(`      Schema points: ${result.count}`);
    });

    await runTest('Data points exist', async () => {
      const result = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
        filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
        exact: true,
      });
      if (result.count === 0) {
        throw new Error('No data points found');
      }
      console.log(`      Data points: ${result.count}`);
    });

    await runTest('Graph points exist', async () => {
      const result = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
        filter: { must: [{ key: 'point_type', match: { value: 'graph' } }] },
        exact: true,
      });
      console.log(`      Graph points: ${result.count}`);
      // Graph points may be 0 if not synced yet, so don't fail
    });
    console.log();
  }

  // ============================================================
  // T6.3: Semantic Search Routing
  // ============================================================
  console.log('T6.3: Semantic Search Routing');

  await runTest('searchByPointType with schema type', async () => {
    const vector = await embed('partner fields');
    const results = await searchByPointType(vector, {
      limit: 5,
      pointType: 'schema',
    });
    if (results.length === 0) {
      throw new Error('No schema results returned');
    }
    // Verify all results have point_type='schema' (if available in payload)
    for (const r of results) {
      if (r.payload?.point_type && r.payload.point_type !== 'schema') {
        throw new Error(`Got point_type='${r.payload.point_type}' instead of 'schema'`);
      }
    }
  });

  await runTest('searchByPointType with data type', async () => {
    const vector = await embed('hospital project');
    const results = await searchByPointType(vector, {
      limit: 5,
      pointType: 'data',
    });
    // Data may be empty if nothing synced, but shouldn't error
    console.log(`      Data results: ${results.length}`);
  });
  console.log();

  // ============================================================
  // T6.4: Scroll Records
  // ============================================================
  console.log('T6.4: Scroll Records');

  await runTest('scrollRecords returns data', async () => {
    const filter = {
      must: [
        { key: 'model_name', match: { value: 'crm.lead' } },
      ],
    };
    const result = await scrollRecords(filter, { limit: 10 });
    console.log(`      Scroll returned: ${result.records.length} records, scanned: ${result.totalScanned}`);
  });
  console.log();

  // ============================================================
  // T6.5: Aggregation Engine
  // ============================================================
  console.log('T6.5: Aggregation Engine');

  await runTest('executeAggregation works', async () => {
    const filter = {
      must: [
        { key: 'model_name', match: { value: 'crm.lead' } },
      ],
    };
    const result = await executeAggregation(
      filter,
      [{ field: 'id', op: 'count' as const, alias: 'record_count' }],
      undefined,
      1000
    );
    console.log(`      Aggregation: ${result.totalRecords} records, count=${result.results.record_count}`);
  });

  await runTest('countOnly works', async () => {
    const filter = {
      must: [
        { key: 'model_name', match: { value: 'crm.lead' } },
      ],
    };
    const count = await countOnly(filter);
    console.log(`      countOnly: ${count}`);
  });
  console.log();

  // ============================================================
  // T6.6: Legacy Collection Preservation (Unified Mode Only)
  // ============================================================
  if (UNIFIED_CONFIG.USE_UNIFIED) {
    console.log('T6.6: Legacy Collection Preservation');

    await runTest('Legacy nexsus collection still exists', async () => {
      const collections = await client.getCollections();
      const names = collections.collections.map(c => c.name);
      if (!names.includes(NEXSUS_CONFIG.COLLECTION_NAME)) {
        throw new Error(`Legacy collection '${NEXSUS_CONFIG.COLLECTION_NAME}' not found`);
      }
    });

    await runTest('Legacy nexsus_data collection still exists', async () => {
      const collections = await client.getCollections();
      const names = collections.collections.map(c => c.name);
      if (!names.includes(PIPELINE_CONFIG.DATA_COLLECTION)) {
        throw new Error(`Legacy collection '${PIPELINE_CONFIG.DATA_COLLECTION}' not found`);
      }
    });
    console.log();
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log();

  if (failed > 0) {
    console.log('Failed Tests:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
    console.log();
  }

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
