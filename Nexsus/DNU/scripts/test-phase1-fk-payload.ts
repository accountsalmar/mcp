/**
 * Phase 1 Test: Verify FK Qdrant IDs in Payload
 *
 * This script verifies that FK Qdrant UUIDs are correctly generated
 * and stored in the payload for many2one fields.
 *
 * Tests:
 * 1. UUID format validation (unit test for buildFkQdrantId)
 * 2. FK fields in synced record payload
 *
 * Run with:
 *   npx tsx scripts/test-phase1-fk-payload.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
import { buildFkQdrantId, parseFkQdrantId, isValidFkQdrantId } from '../src/utils/fk-id-builder.js';

// Load environment variables
dotenv.config();

// Configuration
const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const DATA_COLLECTION = 'nexsus_data';

// Test results
let passedTests = 0;
let failedTests = 0;

function logPass(message: string): void {
  passedTests++;
  console.log(`  [PASS] ${message}`);
}

function logFail(message: string): void {
  failedTests++;
  console.log(`  [FAIL] ${message}`);
}

function logWarn(message: string): void {
  console.log(`  [WARN] ${message}`);
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('PHASE 1 TEST: FK Qdrant IDs in Payload');
  console.log('='.repeat(60));
  console.log();
  console.log(`Qdrant Host: ${QDRANT_HOST}`);
  console.log(`API Key: ${QDRANT_API_KEY ? '(configured)' : '(not set)'}`);
  console.log();

  // =========================================================================
  // TEST 1: UUID Format Validation (Unit Tests)
  // =========================================================================
  console.log('-'.repeat(60));
  console.log('TEST 1: UUID Format Validation');
  console.log('-'.repeat(60));

  const testCases = [
    { modelId: 78, recordId: 282161, expected: '00000078-0000-0000-0000-000000282161', name: 'res.partner' },
    { modelId: 312, recordId: 688535, expected: '00000312-0000-0000-0000-000000688535', name: 'account.move.line' },
    { modelId: 9, recordId: 1, expected: '00000009-0000-0000-0000-000000000001', name: 'small IDs' },
    { modelId: 344, recordId: 12345, expected: '00000344-0000-0000-0000-000000012345', name: 'crm.lead' },
    { modelId: 90, recordId: 45, expected: '00000090-0000-0000-0000-000000000045', name: 'res.users' },
  ];

  for (const tc of testCases) {
    const result = buildFkQdrantId(tc.modelId, tc.recordId);
    if (result === tc.expected) {
      logPass(`${tc.name}: ${tc.modelId}^${tc.recordId} -> ${result}`);
    } else {
      logFail(`${tc.name}: ${tc.modelId}^${tc.recordId} -> ${result} (expected: ${tc.expected})`);
    }
  }

  // Test parsing
  console.log();
  console.log('Testing UUID parsing...');
  const parseTest = parseFkQdrantId('00000078-0000-0000-0000-000000282161');
  if (parseTest && parseTest.modelId === 78 && parseTest.recordId === 282161) {
    logPass(`Parse UUID: modelId=78, recordId=282161`);
  } else {
    logFail(`Parse UUID: got ${JSON.stringify(parseTest)}`);
  }

  // Test validation
  console.log();
  console.log('Testing UUID validation...');
  if (isValidFkQdrantId('00000078-0000-0000-0000-000000282161')) {
    logPass('Valid UUID recognized');
  } else {
    logFail('Valid UUID not recognized');
  }

  if (!isValidFkQdrantId('invalid-uuid-format')) {
    logPass('Invalid UUID rejected');
  } else {
    logFail('Invalid UUID accepted');
  }

  console.log();

  // =========================================================================
  // TEST 2: FK Fields in Synced Record Payload
  // =========================================================================
  console.log('-'.repeat(60));
  console.log('TEST 2: FK Fields in Synced Record Payload');
  console.log('-'.repeat(60));

  // Initialize Qdrant client
  const config: { url: string; apiKey?: string; checkCompatibility?: boolean } = {
    url: QDRANT_HOST,
    checkCompatibility: false,
  };
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);
  console.log('[Init] Qdrant client initialized');
  console.log();

  // Check collection exists
  try {
    const collections = await client.getCollections();
    const dataExists = collections.collections.some(c => c.name === DATA_COLLECTION);

    if (!dataExists) {
      logWarn(`Collection '${DATA_COLLECTION}' does not exist. Run a sync first.`);
      console.log();
      printSummary();
      return;
    }
  } catch (error) {
    logFail(`Failed to connect to Qdrant: ${error}`);
    console.log();
    printSummary();
    return;
  }

  // Try to find a record with FK fields
  const modelsToCheck = ['crm.stage', 'crm.lead', 'account.move.line', 'account.move'];

  for (const modelName of modelsToCheck) {
    console.log(`\nChecking ${modelName}...`);

    try {
      const result = await client.scroll(DATA_COLLECTION, {
        filter: {
          must: [
            { key: 'model_name', match: { value: modelName } },
          ],
        },
        limit: 1,
        with_payload: true,
        with_vector: false,
      });

      if (result.points.length === 0) {
        logWarn(`No ${modelName} records found in Qdrant`);
        continue;
      }

      const point = result.points[0];
      const payload = point.payload as Record<string, unknown>;

      console.log(`  Record ID: ${payload.record_id}`);
      console.log(`  Qdrant ID: ${point.id}`);

      // Find *_qdrant fields
      const fkFields = Object.keys(payload).filter(k => k.endsWith('_qdrant'));

      if (fkFields.length > 0) {
        logPass(`Found ${fkFields.length} FK Qdrant field(s) in ${modelName}:`);
        for (const field of fkFields) {
          const value = payload[field] as string;
          const fieldName = field.replace('_qdrant', '');
          const displayName = payload[fieldName] || '(no name)';

          // Validate UUID format
          if (isValidFkQdrantId(value)) {
            const parsed = parseFkQdrantId(value);
            console.log(`    - ${field}: ${value}`);
            console.log(`      -> ${fieldName}: ${displayName} (model_id: ${parsed?.modelId}, record_id: ${parsed?.recordId})`);
          } else {
            logFail(`    - ${field}: ${value} (INVALID FORMAT)`);
          }
        }
      } else {
        logWarn(`No *_qdrant fields found in ${modelName}. Either:`);
        console.log('    - No FK fields with fk_location_model_id in schema');
        console.log('    - Record not synced after code update');
        console.log('    Run: pipeline_${modelName.replace(".", "_")}_1984 to re-sync');
      }
    } catch (error) {
      logFail(`Error checking ${modelName}: ${error}`);
    }
  }

  console.log();
  printSummary();
}

function printSummary(): void {
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);
  console.log();

  if (failedTests === 0) {
    console.log('Phase 1 Tests: ALL PASSED');
    console.log();
    console.log('Next steps:');
    console.log('  1. Sync a small model: pipeline_crm.stage_1984');
    console.log('  2. Re-run this test to verify FK fields in payload');
    console.log('  3. Proceed to Phase 2: Sync reference models');
  } else {
    console.log('Phase 1 Tests: SOME FAILED');
    console.log();
    console.log('Please review the failed tests above.');
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});
