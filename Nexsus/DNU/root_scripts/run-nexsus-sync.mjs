/**
 * Run Nexsus Sync Script
 *
 * Syncs the nexsus Schema.xlsx to the "nexsus" Qdrant collection.
 * Run with: node run-nexsus-sync.mjs
 */

// Must be first import to ensure env vars are loaded before other modules
import 'dotenv/config';

import { initializeEmbeddingService } from './dist/services/embedding-service.js';
import { initializeVectorClient } from './dist/services/vector-client.js';
import { syncNexsusSchema, getNexsusSyncStatus } from './dist/services/nexsus-sync.js';
import { getNexsusSchemaStats } from './dist/services/excel-schema-loader.js';

async function runSync() {
  console.log('='.repeat(60));
  console.log('NEXSUS SYNC - Upload Excel Schema to Qdrant');
  console.log('='.repeat(60));
  console.log();

  // Initialize services
  console.log('Initializing services...');

  const embeddingReady = initializeEmbeddingService();
  console.log('  Embedding service:', embeddingReady ? 'READY' : 'FAILED');

  const vectorReady = initializeVectorClient();
  console.log('  Vector client:', vectorReady ? 'READY' : 'FAILED');

  if (!embeddingReady || !vectorReady) {
    console.error('\nServices not ready. Check .env configuration.');
    process.exit(1);
  }

  // Show Excel stats
  console.log('\nLoading Excel schema...');
  try {
    const stats = getNexsusSchemaStats();
    console.log('  Total Fields:', stats.totalFields.toLocaleString());
    console.log('  Models:', stats.models);
    console.log('  Stored Fields:', stats.storedCount.toLocaleString());
    console.log('  Computed Fields:', stats.computedCount.toLocaleString());
    console.log('  FK Fields:', stats.fkCount.toLocaleString());
  } catch (err) {
    console.error('Failed to load Excel:', err.message);
    process.exit(1);
  }

  // Run sync
  console.log('\n' + '='.repeat(60));
  console.log('STARTING SYNC...');
  console.log('='.repeat(60));
  console.log();

  let lastPhase = '';
  const result = await syncNexsusSchema(
    true, // force_recreate
    (phase, current, total) => {
      if (phase !== lastPhase) {
        if (lastPhase) console.log(); // newline after previous phase
        lastPhase = phase;
      }
      const percent = ((current / total) * 100).toFixed(1);
      process.stdout.write(`\r  [${phase}] ${current}/${total} (${percent}%)   `);
    }
  );

  console.log('\n');
  console.log('='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('  Success:', result.success ? 'YES' : 'NO');
  console.log('  Uploaded:', result.uploaded.toLocaleString());
  console.log('  Failed:', result.failed);
  console.log('  Duration:', (result.durationMs / 1000).toFixed(1), 'seconds');

  if (result.errors && result.errors.length > 0) {
    console.log('\n  Errors (first 5):');
    result.errors.slice(0, 5).forEach(e => console.log('    -', e));
  }

  // Show final status
  console.log('\nFinal collection status:');
  const status = await getNexsusSyncStatus();
  console.log('  Collection:', status.collection);
  console.log('  Vectors in DB:', status.vectorCount.toLocaleString());
  console.log('  Last Sync:', status.lastSync);
  console.log();
}

runSync().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
