/**
 * Stage 3 Test: Incoming Traversal for Arrays
 *
 * Tests that Qdrant's `match` filter works on array fields:
 * When a payload field is an array, `match: { value: X }` should match
 * if ANY value in the array equals X.
 *
 * Run: npx tsx scripts/test-stage3-incoming-arrays.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const COLLECTION_NAME = 'nexsus_pipeline_data';

async function testIncomingArrayMatch() {
  console.log('='.repeat(60));
  console.log('STAGE 3 TEST: Incoming Traversal for Arrays');
  console.log('='.repeat(60));

  const client = new QdrantClient({
    url: QDRANT_HOST,
    timeout: 30000,
  });

  // Test 1: Verify collection exists
  console.log('\n--- Test 3.1: Verify collection exists ---');
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    console.log(`  Collection ${COLLECTION_NAME}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    if (!exists) {
      console.log('  Cannot run tests without collection. Exiting.');
      return;
    }
  } catch (error) {
    console.log(`  Error checking collection: ${error}`);
    return;
  }

  // Test 2: Find a record with array _qdrant field
  console.log('\n--- Test 3.2: Find record with array _qdrant field ---');

  // Search for any field ending in _qdrant that contains arrays
  // We'll look for distribution_analytic_account_ids_qdrant or similar
  const arrayFieldsToCheck = [
    'distribution_analytic_account_ids_qdrant',
    'analytic_account_ids_qdrant',
    'tag_ids_qdrant',
    'invoice_line_ids_qdrant',
    'line_ids_qdrant',
  ];

  let foundArrayField: string | null = null;
  let sampleTargetUuid: string | null = null;
  let sourceRecordId: string | null = null;

  for (const field of arrayFieldsToCheck) {
    try {
      // Find records where this field exists and is not empty
      const result = await client.scroll(COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: field,
              is_empty: { is_empty: false }
            }
          ]
        },
        limit: 1,
        with_payload: true,
      });

      if (result.points.length > 0) {
        const point = result.points[0];
        const fieldValue = point.payload?.[field];

        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
          foundArrayField = field;
          sampleTargetUuid = fieldValue[0] as string;  // First UUID in array
          sourceRecordId = point.id as string;
          console.log(`  Found: ${field}`);
          console.log(`    Source record: ${point.payload?.model_name} #${point.payload?.record_id}`);
          console.log(`    Source UUID: ${sourceRecordId}`);
          console.log(`    Array length: ${fieldValue.length}`);
          console.log(`    Sample target UUID: ${sampleTargetUuid}`);
          break;
        }
      }
    } catch (e) {
      // Field doesn't exist, continue
    }
  }

  if (!foundArrayField || !sampleTargetUuid) {
    console.log('  ⚠️ No records with array _qdrant fields found.');
    console.log('  This is expected if no many2many models have been synced yet.');
    console.log('  Run Stage 1 sync first, then re-run this test.');
    console.log('\n--- Simulating filter logic instead ---');

    // Still test the filter syntax works
    await testFilterSyntax(client);
    return;
  }

  // Test 3: Verify match filter finds the source record
  console.log('\n--- Test 3.3: Verify match filter works on arrays ---');

  const searchResult = await client.scroll(COLLECTION_NAME, {
    filter: {
      should: [
        {
          key: foundArrayField,
          match: { value: sampleTargetUuid }
        }
      ]
    },
    limit: 10,
    with_payload: true,
  });

  console.log(`  Filter: { key: "${foundArrayField}", match: { value: "${sampleTargetUuid}" } }`);
  console.log(`  Results found: ${searchResult.points.length}`);

  // Check if our source record is in the results
  const foundSource = searchResult.points.some(p => p.id === sourceRecordId);
  console.log(`  Source record found in results: ${foundSource ? '✅' : '❌'}`);

  if (foundSource) {
    console.log('\n  PASS: ✅ Qdrant match filter works on array fields!');
    console.log('  The same filter logic used for many2one will work for many2many.');
  } else {
    console.log('\n  FAIL: ❌ Source record not found in results.');
  }

  // Display matching records
  console.log('\n--- Test 3.4: Matching records ---');
  for (const point of searchResult.points) {
    console.log(`  - ${point.payload?.model_name} #${point.payload?.record_id}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('STAGE 3 TEST COMPLETE');
  console.log('='.repeat(60));
}

/**
 * Test that the filter syntax is valid even without real data
 */
async function testFilterSyntax(client: QdrantClient) {
  console.log('\n--- Testing filter syntax validity ---');

  // This tests that the match filter syntax is accepted by Qdrant
  const testUuid = '00000318-0000-0000-0000-000000000050';

  try {
    const result = await client.scroll(COLLECTION_NAME, {
      filter: {
        should: [
          { key: 'distribution_analytic_account_ids_qdrant', match: { value: testUuid } },
          { key: 'analytic_account_ids_qdrant', match: { value: testUuid } },
          { key: 'tag_ids_qdrant', match: { value: testUuid } },
        ]
      },
      limit: 1,
    });

    console.log(`  Filter syntax: ✅ VALID`);
    console.log(`  Results: ${result.points.length} (expected: 0 if no data synced yet)`);
    console.log('\n  PASS: ✅ Filter syntax works for array fields');
  } catch (error) {
    console.log(`  Filter syntax: ❌ ERROR`);
    console.log(`  Error: ${error}`);
    console.log('\n  FAIL: ❌ Filter syntax rejected by Qdrant');
  }
}

// Run the test
testIncomingArrayMatch().catch(console.error);
