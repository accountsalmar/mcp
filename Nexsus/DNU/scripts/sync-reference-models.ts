/**
 * Sync Reference Models - Phase 2.3
 *
 * Syncs res.partner and res.company to complete the graph traversal chain:
 * crm.stage → res.users → res.partner / res.company
 *
 * IMPORTANT: Uses dynamic imports to ensure dotenv loads before constants.ts
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

console.log('='.repeat(60));
console.log('PHASE 2.3: Sync Reference Models');
console.log('='.repeat(60));
console.log();

async function syncModel(modelName: string, syncFn: Function, initDone: boolean): Promise<{ success: boolean; count: number }> {
  console.log(`\nSyncing ${modelName}...`);
  console.log('-'.repeat(40));

  try {
    const result = await syncFn(modelName, {
      force_full: true,
    });

    console.log(`  Success: ${result.success}`);
    console.log(`  Records fetched: ${result.records_fetched}`);
    console.log(`  Records uploaded: ${result.records_uploaded}`);
    console.log(`  Records failed: ${result.records_failed}`);
    console.log(`  Duration: ${result.duration_ms}ms`);

    if (result.errors && result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`);
    }

    return { success: result.success, count: result.records_uploaded };
  } catch (error) {
    console.error(`  Error: ${error}`);
    return { success: false, count: 0 };
  }
}

async function main() {
  // Dynamic imports
  const { syncPipelineData } = await import('../src/services/pipeline-data-sync.js');
  const { initializeEmbeddingService } = await import('../src/services/embedding-service.js');
  const { initializeVectorClient } = await import('../src/services/vector-client.js');
  const { QdrantClient } = await import('@qdrant/js-client-rest');

  const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  const DATA_COLLECTION = 'nexsus_data';

  // Initialize services
  console.log('Initializing services...');
  const embeddingOk = initializeEmbeddingService();
  console.log(`  Embedding service: ${embeddingOk ? 'OK' : 'FAILED'}`);

  const vectorOk = initializeVectorClient();
  console.log(`  Vector client: ${vectorOk ? 'OK' : 'FAILED'}`);

  if (!embeddingOk) {
    console.error('ERROR: Embedding service failed to initialize.');
    return;
  }

  // Models to sync
  const modelsToSync = [
    'res.company',   // Small - sync first (typically 1-5 records)
    'res.partner',   // Larger - sync second (could be 5000+ records)
  ];

  const results: { model: string; success: boolean; count: number }[] = [];

  for (const model of modelsToSync) {
    const result = await syncModel(model, syncPipelineData, true);
    results.push({ model, ...result });
  }

  console.log();
  console.log('='.repeat(60));
  console.log('SYNC SUMMARY');
  console.log('='.repeat(60));

  let totalRecords = 0;
  for (const r of results) {
    const status = r.success ? '✓' : '✗';
    console.log(`  ${status} ${r.model}: ${r.count} records`);
    totalRecords += r.count;
  }
  console.log(`  Total: ${totalRecords} records synced`);
  console.log();

  // Verify graph traversal chain
  console.log('='.repeat(60));
  console.log('GRAPH TRAVERSAL CHAIN VERIFICATION');
  console.log('='.repeat(60));
  console.log();

  const config: { url: string; apiKey?: string; checkCompatibility?: boolean } = {
    url: QDRANT_HOST,
    checkCompatibility: false,
  };
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);

  // Test the full chain: crm.stage → res.users → res.partner/res.company
  const testChain = [
    { uuid: '00000078-0000-0000-0000-000000000002', model: 'res.partner', description: 'OdooBot partner' },
    { uuid: '00000087-0000-0000-0000-000000000001', model: 'res.company', description: 'Duracube company' },
  ];

  console.log('Testing FK chain from res.users:');
  console.log('  res.users #1 (OdooBot) has:');
  console.log('    - partner_id_qdrant: 00000078-0000-0000-0000-000000000002');
  console.log('    - company_id_qdrant: 00000087-0000-0000-0000-000000000001');
  console.log();

  for (const test of testChain) {
    try {
      const retrieved = await client.retrieve(DATA_COLLECTION, {
        ids: [test.uuid],
        with_payload: true,
      });

      if (retrieved.length > 0) {
        const payload = retrieved[0].payload as Record<string, unknown>;
        const name = payload.name || payload.display_name || payload.login || '(unnamed)';
        console.log(`  [OK] ${test.model}: ${test.uuid}`);
        console.log(`       -> Found: ${name} (record_id: ${payload.record_id})`);

        // Show FK fields in this record
        const fkFields = Object.keys(payload).filter(k => k.endsWith('_qdrant'));
        if (fkFields.length > 0) {
          console.log(`       -> FK fields: ${fkFields.join(', ')}`);
        }
      } else {
        console.log(`  [NOT FOUND] ${test.model}: ${test.uuid}`);
        console.log(`       -> Expected: ${test.description}`);
      }
      console.log();
    } catch (error) {
      console.log(`  [ERROR] ${test.model}: ${error}`);
    }
  }

  console.log('='.repeat(60));
  console.log('COMPLETE GRAPH CHAIN');
  console.log('='.repeat(60));
  console.log();
  console.log('  crm.stage #1 (Project Awaiting Plans)');
  console.log('      │');
  console.log('      ├─── create_uid_qdrant ───► res.users #1 (OdooBot)');
  console.log('      │                               │');
  console.log('      │                               ├─── partner_id_qdrant ───► res.partner #2');
  console.log('      │                               │');
  console.log('      │                               └─── company_id_qdrant ───► res.company #1');
  console.log('      │');
  console.log('      └─── write_uid_qdrant ───► res.users #88 (Rick Kennard)');
  console.log();
  console.log('Test in Claude.ai:');
  console.log('  "Starting from crm.stage record 1, traverse the graph to find');
  console.log('   the company that OdooBot belongs to by following the FK chain."');
}

main().catch(console.error);
