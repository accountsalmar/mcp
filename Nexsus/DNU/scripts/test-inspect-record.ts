/**
 * Test Script: Verify inspect_record tool functionality
 *
 * This script tests that we can retrieve row data from Qdrant.
 *
 * Run with:
 *   npx tsx scripts/test-inspect-record.ts          # Test data records (default)
 *   npx tsx scripts/test-inspect-record.ts schema   # Test schema records
 *   npx tsx scripts/test-inspect-record.ts both     # Test both
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const SCHEMA_COLLECTION = 'nexsus';
const DATA_COLLECTION = 'nexsus_data';

// Test mode - 'schema', 'data', or 'both'
const TEST_MODE = process.argv[2] || 'data';

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('TEST: inspect_record Functionality');
  console.log('='.repeat(60));
  console.log();
  console.log(`Mode: ${TEST_MODE.toUpperCase()}`);
  console.log(`Qdrant Host: ${QDRANT_HOST}`);
  console.log(`API Key: ${QDRANT_API_KEY ? '(configured)' : '(not set)'}`);
  console.log();

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

  // Check collections exist
  console.log('Step 1: Checking collections...');
  console.log('-'.repeat(40));

  try {
    const collections = await client.getCollections();
    const collectionNames = collections.collections.map(c => c.name);

    const hasSchema = collectionNames.includes(SCHEMA_COLLECTION);
    const hasData = collectionNames.includes(DATA_COLLECTION);

    console.log(`  - ${SCHEMA_COLLECTION}: ${hasSchema ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - ${DATA_COLLECTION}: ${hasData ? 'EXISTS' : 'MISSING'}`);

    if (TEST_MODE === 'data' || TEST_MODE === 'both') {
      if (!hasData) {
        console.log('\nERROR: Data collection not found. Run pipeline_sync first.');
        return;
      }
    }
    if (TEST_MODE === 'schema' || TEST_MODE === 'both') {
      if (!hasSchema) {
        console.log('\nERROR: Schema collection not found. Run nexsus_sync first.');
        return;
      }
    }
  } catch (error) {
    console.error('ERROR: Cannot connect to Qdrant:', error);
    return;
  }
  console.log();

  // Get collection stats
  console.log('Step 2: Collection Statistics...');
  console.log('-'.repeat(40));

  if (TEST_MODE === 'data' || TEST_MODE === 'both') {
    try {
      const dataInfo = await client.getCollection(DATA_COLLECTION);
      console.log(`${DATA_COLLECTION}:`);
      console.log(`  Points: ${dataInfo.points_count}`);
    } catch (error) {
      console.error('ERROR getting data collection info:', error);
    }
  }

  if (TEST_MODE === 'schema' || TEST_MODE === 'both') {
    try {
      const schemaInfo = await client.getCollection(SCHEMA_COLLECTION);
      console.log(`${SCHEMA_COLLECTION}:`);
      console.log(`  Points: ${schemaInfo.points_count}`);
    } catch (error) {
      console.error('ERROR getting schema collection info:', error);
    }
  }
  console.log();

  let passed = 0;
  let failed = 0;

  // Test DATA records
  if (TEST_MODE === 'data' || TEST_MODE === 'both') {
    console.log('Step 3: Testing DATA Record Retrieval...');
    console.log('-'.repeat(40));
    console.log();

    // First, discover some real data points using scroll
    console.log('Discovering data records...');
    try {
      const scrollResult = await client.scroll(DATA_COLLECTION, {
        limit: 5,
        with_payload: true,
        with_vector: false,
      });

      if (scrollResult.points.length === 0) {
        console.log('WARNING: No data records found in collection.');
        console.log('Run pipeline_sync to import data first.');
      } else {
        console.log(`Found ${scrollResult.points.length} data records to test.`);
        console.log();

        for (const point of scrollResult.points) {
          const pointId = String(point.id);
          const payload = point.payload as Record<string, unknown>;

          console.log(`Test: Data Record`);
          console.log(`  Point ID: ${pointId}`);
          console.log(`  Collection: ${DATA_COLLECTION}`);

          // Check payload
          const payloadKeys = Object.keys(payload);
          if (payloadKeys.length > 0) {
            console.log(`  Result: FOUND`);
            console.log(`  Payload Fields (${payloadKeys.length}): ${payloadKeys.slice(0, 8).join(', ')}${payloadKeys.length > 8 ? '...' : ''}`);

            // Show key payload values
            console.log('  Payload Values:');

            // Common data fields to show
            const importantFields = ['model_name', 'record_id', 'name', 'expected_revenue', 'stage_id', 'partner_id', 'user_id', 'create_date'];
            for (const key of importantFields) {
              if (payload[key] !== undefined) {
                let value = payload[key];
                if (typeof value === 'string' && value.length > 60) {
                  value = value.substring(0, 60) + '...';
                }
                console.log(`    ${key}: ${value}`);
              }
            }

            // Show first few other fields if important ones not found
            if (!importantFields.some(f => payload[f] !== undefined)) {
              for (const key of payloadKeys.slice(0, 5)) {
                let value = payload[key];
                if (typeof value === 'string' && value.length > 60) {
                  value = value.substring(0, 60) + '...';
                }
                console.log(`    ${key}: ${value}`);
              }
            }

            console.log('  Status: PASSED');
            passed++;
          } else {
            console.log('  Result: EMPTY PAYLOAD');
            console.log('  Status: FAILED');
            failed++;
          }
          console.log();
        }
      }
    } catch (error) {
      console.error('ERROR scrolling data collection:', error);
      failed++;
    }
  }

  // Test SCHEMA records
  if (TEST_MODE === 'schema' || TEST_MODE === 'both') {
    console.log('Step 4: Testing SCHEMA Record Retrieval...');
    console.log('-'.repeat(40));
    console.log();

    // Test specific schema records
    const schemaTestIds = [
      '00000004-0000-0000-0000-000000051561',
      '00000004-0000-0000-0000-000000051556',
    ];

    for (const pointId of schemaTestIds) {
      console.log(`Test: Schema Record`);
      console.log(`  Point ID: ${pointId}`);
      console.log(`  Collection: ${SCHEMA_COLLECTION}`);

      try {
        const points = await client.retrieve(SCHEMA_COLLECTION, {
          ids: [pointId],
          with_payload: true,
          with_vector: false,
        });

        if (points.length === 0) {
          console.log('  Result: NOT FOUND');
          console.log('  Status: FAILED');
          failed++;
        } else {
          const payload = points[0].payload as Record<string, unknown>;
          const payloadKeys = Object.keys(payload);

          console.log(`  Result: FOUND`);
          console.log(`  Payload Fields: ${payloadKeys.join(', ')}`);
          console.log('  Payload Values:');
          console.log(`    field_id: ${payload.field_id}`);
          console.log(`    model_id: ${payload.model_id}`);
          console.log(`    field_name: ${payload.field_name}`);
          console.log(`    field_label: ${payload.field_label}`);
          console.log(`    field_type: ${payload.field_type}`);
          console.log(`    model_name: ${payload.model_name}`);
          console.log(`    stored: ${payload.stored}`);
          console.log('  Status: PASSED');
          passed++;
        }
      } catch (error) {
        console.log(`  Result: ERROR - ${error instanceof Error ? error.message : error}`);
        console.log('  Status: FAILED');
        failed++;
      }
      console.log();
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log();

  if (failed === 0 && passed > 0) {
    console.log('SUCCESS: All tests passed!');
    console.log('The inspect_record tool works correctly for both schema and data.');
  } else if (passed === 0) {
    console.log('WARNING: No records found to test.');
    console.log('Make sure to run nexsus_sync (schema) or pipeline_sync (data) first.');
  } else {
    console.log('WARNING: Some tests failed.');
  }
}

// Run the tests
runTests().catch(console.error);
