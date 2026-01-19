/**
 * Sync crm.stage and verify FK Qdrant IDs
 *
 * This script:
 * 1. Syncs crm.stage model to Qdrant
 * 2. Verifies FK Qdrant IDs are in the payload
 *
 * IMPORTANT: Uses dynamic imports to ensure dotenv loads before constants.ts
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

// Verify VOYAGE_API_KEY is loaded
console.log('Environment check:');
console.log(`  VOYAGE_API_KEY: ${process.env.VOYAGE_API_KEY ? '(set - ' + process.env.VOYAGE_API_KEY.substring(0, 10) + '...)' : '(NOT SET)'}`);
console.log(`  QDRANT_HOST: ${process.env.QDRANT_HOST ? '(set)' : '(NOT SET)'}`);
console.log();

// Use dynamic imports to ensure env vars are loaded first
async function main() {
  console.log('='.repeat(60));
  console.log('SYNC AND VERIFY: crm.stage');
  console.log('='.repeat(60));
  console.log();

  // Dynamic imports - these will now see the env vars
  const { QdrantClient } = await import('@qdrant/js-client-rest');
  const { syncPipelineData } = await import('../src/services/pipeline-data-sync.js');
  const { isValidFkQdrantId, parseFkQdrantId } = await import('../src/utils/fk-id-builder.js');
  const { initializeEmbeddingService } = await import('../src/services/embedding-service.js');
  const { initializeVectorClient } = await import('../src/services/vector-client.js');

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
    console.error('Check that VOYAGE_API_KEY is set in .env file.');
    return;
  }

  // Step 1: Sync crm.stage
  console.log('Step 1: Syncing crm.stage...');
  console.log('-'.repeat(40));

  try {
    const result = await syncPipelineData('crm.stage', {
      force_full: true,  // Force full sync to get new FK fields
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

  // Step 2: Verify FK fields in payload
  console.log('Step 2: Verifying FK Qdrant IDs in payload...');
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
    // Get all crm.stage records
    const result = await client.scroll(DATA_COLLECTION, {
      filter: {
        must: [
          { key: 'model_name', match: { value: 'crm.stage' } },
        ],
      },
      limit: 20,
      with_payload: true,
      with_vector: false,
    });

    console.log(`Found ${result.points.length} crm.stage records`);
    console.log();

    if (result.points.length === 0) {
      console.log('No records found!');
      return;
    }

    // Check each record for FK Qdrant fields
    let recordsWithFk = 0;
    let totalFkFields = 0;

    for (const point of result.points) {
      const payload = point.payload as Record<string, unknown>;
      const fkFields = Object.keys(payload).filter(k => k.endsWith('_qdrant'));

      if (fkFields.length > 0) {
        recordsWithFk++;
        totalFkFields += fkFields.length;

        console.log(`Record #${payload.record_id} (${payload.name || 'unnamed'}):`);
        for (const field of fkFields) {
          const value = payload[field] as string;
          const fieldName = field.replace('_qdrant', '');
          const displayName = payload[fieldName] || '(no name)';
          const id = payload[`${fieldName}_id`] || '(no id)';

          if (isValidFkQdrantId(value)) {
            const parsed = parseFkQdrantId(value);
            console.log(`  [OK] ${field}: ${value}`);
            console.log(`       -> ${fieldName}: ${displayName} (id: ${id})`);
            console.log(`       -> Target: model_id=${parsed?.modelId}, record_id=${parsed?.recordId}`);
          } else {
            console.log(`  [INVALID] ${field}: ${value}`);
          }
        }
        console.log();
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total records checked: ${result.points.length}`);
    console.log(`  Records with FK Qdrant fields: ${recordsWithFk}`);
    console.log(`  Total FK Qdrant fields found: ${totalFkFields}`);
    console.log();

    if (recordsWithFk > 0) {
      console.log('SUCCESS: FK Qdrant IDs are being added to payload!');
      console.log();
      console.log('Expected FK fields for crm.stage:');
      console.log('  - create_uid_qdrant (-> res.users)');
      console.log('  - team_id_qdrant (-> crm.team)');
      console.log('  - write_uid_qdrant (-> res.users)');
    } else {
      console.log('WARNING: No FK Qdrant fields found.');
      console.log('Check if FK metadata is configured in schema.');
    }

  } catch (error) {
    console.error('Verification error:', error);
  }
}

main().catch(console.error);
