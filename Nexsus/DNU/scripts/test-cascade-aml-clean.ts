/**
 * Test Script: Clean Slate Cascade Sync for account.move.line
 *
 * This script:
 * 1. Deletes ALL data points (keeps schema)
 * 2. Deletes ALL graph points (keeps schema)
 * 3. Verifies schema has FK metadata for move_id
 * 4. Runs cascade sync for account.move.line (2024-12-31 to 2025-02-01)
 * 5. Monitors FK cascade to ensure account.move is synced
 *
 * Run with: npx tsx scripts/test-cascade-aml-clean.ts
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { UNIFIED_CONFIG } from '../src/constants.js';
import { getModelFieldsFromSchema, clearSchemaCache } from '../src/services/schema-query-service.js';
import { syncWithCascade } from '../src/services/cascade-sync.js';
import { initializeVectorClient, getQdrantClient } from '../src/services/vector-client.js';
import { initializeEmbeddingService, isEmbeddingServiceAvailable } from '../src/services/embedding-service.js';

const COLLECTION_NAME = UNIFIED_CONFIG.COLLECTION_NAME;

async function main() {
  console.log('='.repeat(60));
  console.log('CLEAN SLATE CASCADE SYNC TEST');
  console.log('Model: account.move.line');
  console.log('Date Range: 2024-12-31 to 2025-02-01');
  console.log('='.repeat(60));
  console.log();

  // Initialize services
  console.log('[Step 0] Initializing services...');
  await initializeVectorClient();
  const client = getQdrantClient();

  // Initialize embedding service
  const embeddingInitialized = initializeEmbeddingService();
  if (!embeddingInitialized) {
    console.log('  ERROR: Failed to initialize embedding service. Check VOYAGE_API_KEY.');
    process.exit(1);
  }
  console.log('  Embedding service initialized:', isEmbeddingServiceAvailable());

  // Get initial counts
  console.log('[Step 0] Getting initial counts...');
  const initialCounts = await getCounts(client);
  console.log(`  Schema points: ${initialCounts.schema}`);
  console.log(`  Data points: ${initialCounts.data}`);
  console.log(`  Graph points: ${initialCounts.graph}`);
  console.log();

  // Step 1: Delete ALL data points
  console.log('[Step 1] Deleting ALL data points (keeping schema)...');
  try {
    await client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [{ key: 'point_type', match: { value: 'data' } }],
      },
    });
    console.log('  Data points deleted successfully');
  } catch (error) {
    console.log('  No data points to delete or error:', error);
  }

  // Step 2: Delete ALL graph points
  console.log('[Step 2] Deleting ALL graph points (keeping schema)...');
  try {
    await client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [{ key: 'point_type', match: { value: 'graph' } }],
      },
    });
    console.log('  Graph points deleted successfully');
  } catch (error) {
    console.log('  No graph points to delete or error:', error);
  }

  // Verify deletion
  console.log('[Step 2b] Verifying deletion...');
  const afterDeleteCounts = await getCounts(client);
  console.log(`  Schema points: ${afterDeleteCounts.schema} (should be unchanged)`);
  console.log(`  Data points: ${afterDeleteCounts.data} (should be 0)`);
  console.log(`  Graph points: ${afterDeleteCounts.graph} (should be 0)`);
  console.log();

  // Step 3: Verify schema has FK metadata for move_id
  console.log('[Step 3] Verifying schema FK metadata for move_id...');
  clearSchemaCache(); // Clear cache to get fresh data

  const amlFields = await getModelFieldsFromSchema('account.move.line');
  const moveIdField = amlFields.find(f => f.field_name === 'move_id');

  if (moveIdField) {
    console.log('  Found move_id field:');
    console.log(`    field_id: ${moveIdField.field_id}`);
    console.log(`    field_type: ${moveIdField.field_type}`);
    console.log(`    stored: ${moveIdField.stored}`);
    console.log(`    fk_location_model: ${moveIdField.fk_location_model || 'NOT SET'}`);
    console.log(`    fk_location_model_id: ${moveIdField.fk_location_model_id || 'NOT SET'}`);

    if (!moveIdField.fk_location_model) {
      console.log();
      console.log('  WARNING: FK metadata is missing! Run schema_sync first.');
      console.log('  Command: schema_sync { "source": "excel", "action": "full_sync", "force_recreate": true }');
      process.exit(1);
    }
  } else {
    console.log('  ERROR: move_id field not found in schema!');
    process.exit(1);
  }
  console.log();

  // Count FK fields for account.move.line
  const fkFields = amlFields.filter(f => f.fk_location_model);
  console.log(`  Total FK fields for account.move.line: ${fkFields.length}`);
  console.log('  FK fields:');
  for (const f of fkFields.slice(0, 10)) {
    console.log(`    - ${f.field_name} -> ${f.fk_location_model}`);
  }
  if (fkFields.length > 10) {
    console.log(`    ... and ${fkFields.length - 10} more`);
  }
  console.log();

  // Step 4: Run cascade sync
  console.log('[Step 4] Running cascade sync for account.move.line...');
  console.log('  Date range: 2024-12-31 to 2025-02-01');
  console.log();
  console.log('  Starting sync... (this may take a while)');
  console.log('  Monitor the logs below for:');
  console.log('    - [FkDiscovery] Found X FK fields for account.move.line');
  console.log('    - [FkDiscovery] account.move: X synced, Y missing');
  console.log('    - [CascadeSync] Syncing X specific records from account.move');
  console.log();
  console.log('-'.repeat(60));

  const startTime = Date.now();

  try {
    const result = await syncWithCascade('account.move.line', {
      skipExisting: false, // Sync all records even if they exist
      includeArchived: false,
      dateFrom: '2024-12-31',
      dateTo: '2025-02-01',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('-'.repeat(60));
    console.log();
    console.log('[Step 5] Cascade sync completed!');
    console.log(`  Duration: ${duration}s`);
    console.log(`  Primary records synced: ${result.primarySynced || 0}`);
    console.log(`  FK targets synced: ${result.fkTargetsSynced || 0}`);
    console.log(`  Total records: ${result.totalSynced || 0}`);

    if (result.errors && result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
      for (const err of result.errors.slice(0, 5)) {
        console.log(`    - ${err}`);
      }
    }
  } catch (error) {
    console.log('-'.repeat(60));
    console.log();
    console.log('ERROR during cascade sync:', error);
    process.exit(1);
  }

  console.log();

  // Step 6: Verify results
  console.log('[Step 6] Verifying results...');
  const finalCounts = await getCounts(client);
  console.log(`  Total data points: ${finalCounts.data}`);
  console.log(`  Total graph points: ${finalCounts.graph}`);

  // Check account.move.line count
  const amlCount = await client.count(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: 'account.move.line' } },
      ],
    },
    exact: true,
  });
  console.log(`  account.move.line records: ${amlCount.count}`);

  // Check account.move count (THIS IS THE KEY TEST)
  const amCount = await client.count(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: 'account.move' } },
      ],
    },
    exact: true,
  });
  console.log(`  account.move records: ${amCount.count} (from cascade)`);

  console.log();
  console.log('='.repeat(60));
  if (amCount.count > 0) {
    console.log('SUCCESS: account.move was synced via FK cascade!');
  } else {
    console.log('FAILURE: account.move was NOT synced. Check logs above for errors.');
  }
  console.log('='.repeat(60));
}

async function getCounts(client: QdrantClient): Promise<{ schema: number; data: number; graph: number }> {
  const [schemaResult, dataResult, graphResult] = await Promise.all([
    client.count(COLLECTION_NAME, {
      filter: { must: [{ key: 'point_type', match: { value: 'schema' } }] },
      exact: true,
    }),
    client.count(COLLECTION_NAME, {
      filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
      exact: true,
    }),
    client.count(COLLECTION_NAME, {
      filter: { must: [{ key: 'point_type', match: { value: 'graph' } }] },
      exact: true,
    }),
  ]);

  return {
    schema: schemaResult.count,
    data: dataResult.count,
    graph: graphResult.count,
  };
}

main().catch(console.error);
