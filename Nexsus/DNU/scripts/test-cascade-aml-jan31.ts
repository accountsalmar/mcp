/**
 * Test Cascade Sync: account.move.line from 31-Jan-2025
 *
 * Fetches account.move.line records created on 31-Jan-2025
 * and runs cascade sync to discover all FK relationships.
 *
 * Run: npx tsx scripts/test-cascade-aml-jan31.ts
 */

import 'dotenv/config';
import {
  syncWithCascade,
  formatCascadeResult,
  type CascadeSyncOptions,
} from '../src/services/cascade-sync.js';
import { getGraphStats } from '../src/services/knowledge-graph.js';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { initializeEmbeddingService } from '../src/services/embedding-service.js';
import { loadPipelineSchema } from '../src/services/excel-pipeline-loader.js';
import { getOdooClient } from '../src/services/odoo-client.js';

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Cascade Sync Test: account.move.line (31-Jan-2025)');
  console.log('='.repeat(60) + '\n');

  // Initialize services
  console.log('[INIT] Loading pipeline schema...');
  loadPipelineSchema();

  console.log('[INIT] Initializing vector client...');
  const vectorReady = initializeVectorClient();
  if (!vectorReady) {
    console.error('Failed to initialize vector client. Check QDRANT_HOST.');
    process.exit(1);
  }

  console.log('[INIT] Initializing embedding service...');
  const embeddingReady = initializeEmbeddingService();
  if (!embeddingReady) {
    console.error('Failed to initialize embedding service. Check VOYAGE_API_KEY.');
    process.exit(1);
  }

  console.log('[INIT] Connecting to Odoo...');
  const odooClient = getOdooClient();

  // Fetch account.move.line records from 31-Jan-2025
  const dateFilter = '2025-01-31';
  console.log(`\n[FETCH] Fetching account.move.line records from ${dateFilter}...`);

  const records = await odooClient.searchRead<{ id: number; name: string; create_date: string }>(
    'account.move.line',
    [
      ['create_date', '>=', `${dateFilter} 00:00:00`],
      ['create_date', '<=', `${dateFilter} 23:59:59`],
    ],
    ['id', 'name', 'create_date'],
    { limit: 100 }  // Test with 100 records
  );

  console.log(`[FETCH] Found ${records.length} records from ${dateFilter}`);

  if (records.length === 0) {
    console.log('\nNo records found for this date. Try a different date.');
    process.exit(0);
  }

  // Show sample records
  console.log('\nSample records:');
  for (const r of records.slice(0, 5)) {
    console.log(`  - ID ${r.id}: ${r.name || '(no name)'} (${r.create_date})`);
  }
  if (records.length > 5) {
    console.log(`  ... and ${records.length - 5} more`);
  }

  // Extract record IDs
  const recordIds = records.map(r => r.id);

  // Ask for confirmation
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Ready to cascade sync ${recordIds.length} account.move.line records`);
  console.log(`This will discover and sync all FK targets (partners, accounts, etc.)`);
  console.log(`${'='.repeat(60)}`);

  // Get graph stats before
  console.log('\n[GRAPH] Current knowledge graph stats:');
  const statsBefore = await getGraphStats();
  console.log(`  - Relationships: ${statsBefore.total_relationships}`);
  console.log(`  - Source models: ${statsBefore.unique_source_models}`);
  console.log(`  - Target models: ${statsBefore.unique_target_models}`);

  // Run cascade sync
  console.log('\n[CASCADE] Starting cascade sync...');
  console.log('[CASCADE] This may take a few minutes for large datasets...\n');

  const startTime = performance.now();

  const options: CascadeSyncOptions = {
    skipExisting: true,      // Skip already-synced records
    parallelTargets: 3,      // Sync 3 FK targets in parallel
    dryRun: false,           // Actually sync (set to true for dry run)
    updateGraph: true,       // Update knowledge graph
  };

  const result = await syncWithCascade('account.move.line', options, recordIds);

  const duration = performance.now() - startTime;

  // Show results
  console.log('\n' + '='.repeat(60));
  console.log('CASCADE SYNC COMPLETE');
  console.log('='.repeat(60));

  console.log(formatCascadeResult(result));

  // Summary stats
  const totalCascaded = result.cascadedModels.reduce((sum, m) => sum + m.records_synced, 0);
  const totalSkipped = result.cascadedModels.reduce((sum, m) => sum + m.records_skipped, 0);
  const maxDepth = result.cascadedModels.reduce((max, m) => Math.max(max, m.cascade_depth), 0);

  console.log('\n## Summary');
  console.log(`- Primary records synced: ${result.primaryModel.records_synced}`);
  console.log(`- FK dependencies found: ${result.primaryModel.fk_dependencies.length}`);
  console.log(`- Cascaded models: ${result.cascadedModels.length}`);
  console.log(`- Total cascaded records: ${totalCascaded}`);
  console.log(`- Total skipped (already synced): ${totalSkipped}`);
  console.log(`- Max cascade depth: ${maxDepth}`);
  console.log(`- Total duration: ${(duration / 1000).toFixed(2)}s`);

  // Show top cascaded models
  if (result.cascadedModels.length > 0) {
    console.log('\n## Top Cascaded Models (by records synced)');
    const sorted = [...result.cascadedModels].sort((a, b) => b.records_synced - a.records_synced);
    for (const m of sorted.slice(0, 10)) {
      console.log(`  - ${m.model_name}: ${m.records_synced} synced, ${m.records_skipped} skipped (depth ${m.cascade_depth})`);
    }
  }

  // Get graph stats after
  console.log('\n## Knowledge Graph Update');
  const statsAfter = await getGraphStats();
  console.log(`  - Relationships: ${statsBefore.total_relationships} → ${statsAfter.total_relationships} (+${statsAfter.total_relationships - statsBefore.total_relationships})`);
  console.log(`  - Source models: ${statsBefore.unique_source_models} → ${statsAfter.unique_source_models}`);
  console.log(`  - Target models: ${statsBefore.unique_target_models} → ${statsAfter.unique_target_models}`);

  console.log('\n✅ Cascade sync complete!');
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
