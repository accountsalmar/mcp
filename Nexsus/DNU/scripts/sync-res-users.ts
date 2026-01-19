/**
 * Sync res.users - Phase 2 Reference Model
 *
 * This script syncs res.users to enable graph traversal from:
 * - crm.stage.create_uid_qdrant
 * - crm.stage.write_uid_qdrant
 * - Any other model with user FK references
 *
 * IMPORTANT: Uses dynamic imports to ensure dotenv loads before constants.ts
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

console.log('='.repeat(60));
console.log('PHASE 2: Sync res.users (Reference Model)');
console.log('='.repeat(60));
console.log();

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
  console.log();

  if (!embeddingOk) {
    console.error('ERROR: Embedding service failed to initialize.');
    return;
  }

  // Sync res.users
  console.log('Syncing res.users...');
  console.log('-'.repeat(40));

  try {
    const startTime = Date.now();
    const result = await syncPipelineData('res.users', {
      force_full: true,
    });

    console.log();
    console.log('Sync Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Records fetched: ${result.records_fetched}`);
    console.log(`  Records uploaded: ${result.records_uploaded}`);
    console.log(`  Records failed: ${result.records_failed}`);
    console.log(`  Duration: ${result.duration_ms}ms`);

    if (result.errors && result.errors.length > 0) {
      console.log('  Errors:', result.errors);
    }

    if (!result.success) {
      console.error('Sync failed!');
      return;
    }
  } catch (error) {
    console.error('Sync error:', error);
    return;
  }

  console.log();

  // Verify synced records
  console.log('Verifying synced res.users records...');
  console.log('-'.repeat(40));

  const config: { url: string; apiKey?: string; checkCompatibility?: boolean } = {
    url: QDRANT_HOST,
    checkCompatibility: false,
  };
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);

  try {
    // Count res.users records
    const countResult = await client.count(DATA_COLLECTION, {
      filter: {
        must: [
          { key: 'model_name', match: { value: 'res.users' } },
        ],
      },
      exact: true,
    });

    console.log(`Total res.users records in Qdrant: ${countResult.count}`);
    console.log();

    // Get sample records
    const sampleResult = await client.scroll(DATA_COLLECTION, {
      filter: {
        must: [
          { key: 'model_name', match: { value: 'res.users' } },
        ],
      },
      limit: 5,
      with_payload: true,
      with_vector: false,
    });

    console.log('Sample res.users records:');
    for (const point of sampleResult.points) {
      const payload = point.payload as Record<string, unknown>;
      console.log(`  - ID: ${payload.record_id}, Name: ${payload.name || payload.login || '(unnamed)'}`);
      console.log(`    Qdrant UUID: ${point.id}`);

      // Show FK fields if any
      const fkFields = Object.keys(payload).filter(k => k.endsWith('_qdrant'));
      if (fkFields.length > 0) {
        console.log(`    FK fields: ${fkFields.join(', ')}`);
      }
    }

    console.log();

    // Test graph traversal: Can we find OdooBot (id=1) and Rick Kennard (id=88)?
    console.log('='.repeat(60));
    console.log('GRAPH TRAVERSAL TEST');
    console.log('='.repeat(60));
    console.log();
    console.log('Testing if we can retrieve users referenced by crm.stage...');
    console.log();

    // The UUIDs from crm.stage:
    // create_uid_qdrant: 00000090-0000-0000-0000-000000000001 (OdooBot)
    // write_uid_qdrant: 00000090-0000-0000-0000-000000000088 (Rick Kennard)

    const testUuids = [
      { uuid: '00000090-0000-0000-0000-000000000001', expectedName: 'OdooBot' },
      { uuid: '00000090-0000-0000-0000-000000000088', expectedName: 'Rick Kennard' },
    ];

    for (const test of testUuids) {
      try {
        const retrieved = await client.retrieve(DATA_COLLECTION, {
          ids: [test.uuid],
          with_payload: true,
        });

        if (retrieved.length > 0) {
          const payload = retrieved[0].payload as Record<string, unknown>;
          console.log(`  [OK] UUID ${test.uuid}`);
          console.log(`       -> Found: ${payload.name || payload.login} (record_id: ${payload.record_id})`);
          console.log(`       -> Expected: ${test.expectedName}`);
          console.log();
        } else {
          console.log(`  [FAIL] UUID ${test.uuid} - NOT FOUND`);
          console.log(`       -> Expected: ${test.expectedName}`);
          console.log();
        }
      } catch (error) {
        console.log(`  [ERROR] UUID ${test.uuid}: ${error}`);
      }
    }

    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`  res.users synced: ${countResult.count} records`);
    console.log('  Graph traversal: Ready for testing in Claude.ai');
    console.log();
    console.log('Test prompt for Claude.ai:');
    console.log('  "Look up crm.stage record 1 and then use the create_uid_qdrant');
    console.log('   UUID to retrieve the actual user record who created it."');

  } catch (error) {
    console.error('Verification error:', error);
  }
}

main().catch(console.error);
