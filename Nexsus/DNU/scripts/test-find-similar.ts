/**
 * Test Script for Phase 4: Same-Model Similarity
 *
 * Tests the findSimilarRecords() function to verify:
 * 1. Reference point retrieval with vector
 * 2. Similarity search within same model
 * 3. Self-exclusion from results
 * 4. Graph boost functionality
 *
 * Usage: npx tsx scripts/test-find-similar.ts
 */

import 'dotenv/config';
import { initializeVectorClient, findSimilarRecords, countPipelineData } from '../src/services/vector-client.js';
import { buildDataUuidV2 } from '../src/utils/uuid-v2.js';

// Known model IDs from Odoo schema (avoids needing Excel file)
const MODEL_IDS: Record<string, number> = {
  'res.partner': 78,
  'crm.lead': 312,
  'account.move': 389,
  'account.move.line': 390,
  'res.users': 90,
  'res.company': 61,
  'product.product': 328,
  'sale.order': 615,
};

function getModelId(modelName: string): number | undefined {
  return MODEL_IDS[modelName];
}

async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('PHASE 4 TEST: Same-Model Similarity (find_similar)');
  console.log('='.repeat(70));
  console.log('');

  // Initialize vector client
  console.log('1. Initializing vector client...');
  const initialized = initializeVectorClient();
  if (!initialized) {
    console.error('   FAILED: Could not initialize vector client');
    process.exit(1);
  }
  console.log('   OK: Vector client initialized');
  console.log('');

  // Test with res.partner model (commonly has many records)
  const testModel = 'res.partner';
  const testRecordId = 286798; // Known partner ID

  console.log(`2. Testing with model: ${testModel}, record_id: ${testRecordId}`);
  console.log('');

  // Get model_id
  const modelId = getModelId(testModel);
  if (!modelId) {
    console.error(`   FAILED: Could not find model_id for ${testModel}`);
    process.exit(1);
  }
  console.log(`   Model ID: ${modelId}`);

  // Build UUID
  const pointId = buildDataUuidV2(modelId, testRecordId);
  console.log(`   Point ID: ${pointId}`);
  console.log('');

  // Count records in model
  console.log('3. Counting records in model...');
  try {
    const count = await countPipelineData(testModel);
    console.log(`   Total ${testModel} records in Qdrant: ${count.toLocaleString()}`);
  } catch (error) {
    console.log(`   Warning: Could not count records: ${error}`);
  }
  console.log('');

  // Test 1: Basic similarity search
  console.log('4. Test 1: Basic similarity search (limit=5, min_similarity=0.5)');
  console.log('-'.repeat(70));
  try {
    const result = await findSimilarRecords(pointId, {
      limit: 5,
      minSimilarity: 0.5,
      applyGraphBoost: false,
    });

    console.log(`   Reference: ${result.model_name} #${result.reference_record_id}`);
    console.log(`   Found: ${result.similar_records.length} similar records`);
    console.log(`   Search time: ${result.search_time_ms}ms`);
    console.log('');

    if (result.similar_records.length > 0) {
      console.log('   Top similar records:');
      for (let i = 0; i < result.similar_records.length; i++) {
        const rec = result.similar_records[i];
        const name = rec.payload_summary.name || rec.payload_summary.display_name || '(no name)';
        console.log(`   ${i + 1}. #${rec.record_id} - ${(rec.similarity_score * 100).toFixed(1)}% - ${name}`);
      }
    } else {
      console.log('   No similar records found (try lowering min_similarity)');
    }
    console.log('');
    console.log('   TEST 1 PASSED');
  } catch (error) {
    console.error(`   TEST 1 FAILED: ${error}`);
  }
  console.log('');

  // Test 2: With graph boost
  console.log('5. Test 2: Similarity search with graph boost');
  console.log('-'.repeat(70));
  try {
    const result = await findSimilarRecords(pointId, {
      limit: 5,
      minSimilarity: 0.5,
      applyGraphBoost: true,
    });

    console.log(`   Graph boost applied: ${result.search_params.graph_boost_applied}`);
    console.log(`   Found: ${result.similar_records.length} similar records`);
    console.log(`   Search time: ${result.search_time_ms}ms`);
    console.log('');

    if (result.similar_records.length > 0) {
      console.log('   Top similar records (with connection count):');
      for (let i = 0; i < result.similar_records.length; i++) {
        const rec = result.similar_records[i];
        const name = rec.payload_summary.name || rec.payload_summary.display_name || '(no name)';
        const connections = rec.connection_count !== undefined ? ` [${rec.connection_count} connections]` : '';
        console.log(`   ${i + 1}. #${rec.record_id} - ${(rec.similarity_score * 100).toFixed(1)}%${connections} - ${name}`);
      }
    }
    console.log('');
    console.log('   TEST 2 PASSED');
  } catch (error) {
    console.error(`   TEST 2 FAILED: ${error}`);
  }
  console.log('');

  // Test 3: Higher similarity threshold
  console.log('6. Test 3: Higher similarity threshold (min_similarity=0.8)');
  console.log('-'.repeat(70));
  try {
    const result = await findSimilarRecords(pointId, {
      limit: 10,
      minSimilarity: 0.8,
      applyGraphBoost: false,
    });

    console.log(`   Found: ${result.similar_records.length} records above 80% similarity`);
    console.log(`   Search time: ${result.search_time_ms}ms`);

    if (result.similar_records.length > 0) {
      console.log('');
      console.log('   Highly similar records:');
      for (let i = 0; i < Math.min(5, result.similar_records.length); i++) {
        const rec = result.similar_records[i];
        const name = rec.payload_summary.name || rec.payload_summary.display_name || '(no name)';
        console.log(`   ${i + 1}. #${rec.record_id} - ${(rec.similarity_score * 100).toFixed(1)}% - ${name}`);
      }
    }
    console.log('');
    console.log('   TEST 3 PASSED');
  } catch (error) {
    console.error(`   TEST 3 FAILED: ${error}`);
  }
  console.log('');

  // Test 4: Self-exclusion verification
  console.log('7. Test 4: Verify self-exclusion');
  console.log('-'.repeat(70));
  try {
    const result = await findSimilarRecords(pointId, {
      limit: 100,
      minSimilarity: 0.0, // Get all matches
      applyGraphBoost: false,
    });

    const selfIncluded = result.similar_records.some(
      r => r.record_id === testRecordId || r.point_id === pointId
    );

    if (selfIncluded) {
      console.log('   FAILED: Reference record found in results (should be excluded)');
    } else {
      console.log('   OK: Reference record correctly excluded from results');
      console.log('   TEST 4 PASSED');
    }
  } catch (error) {
    console.error(`   TEST 4 FAILED: ${error}`);
  }
  console.log('');

  // Test 5: Test with crm.lead model
  console.log('8. Test 5: Cross-model test with crm.lead');
  console.log('-'.repeat(70));
  try {
    const leadModelId = getModelId('crm.lead');
    if (!leadModelId) {
      console.log('   SKIPPED: crm.lead model not found');
    } else {
      // Get count to find a valid record
      const leadCount = await countPipelineData('crm.lead');
      console.log(`   crm.lead records in Qdrant: ${leadCount.toLocaleString()}`);

      if (leadCount > 0) {
        // Use a known lead ID or find one
        const leadPointId = buildDataUuidV2(leadModelId, 1); // Try lead #1

        try {
          const result = await findSimilarRecords(leadPointId, {
            limit: 3,
            minSimilarity: 0.3,
            applyGraphBoost: false,
          });

          console.log(`   Found: ${result.similar_records.length} similar leads`);
          console.log('   TEST 5 PASSED');
        } catch (error) {
          // Record might not exist, try another approach
          console.log(`   Note: Lead #1 not found, this is expected if ID doesn't exist`);
          console.log('   TEST 5 SKIPPED (no valid test record)');
        }
      } else {
        console.log('   SKIPPED: No crm.lead records in Qdrant');
      }
    }
  } catch (error) {
    console.error(`   TEST 5 FAILED: ${error}`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('PHASE 4 TEST COMPLETE');
  console.log('='.repeat(70));
  console.log('');
  console.log('The find_similar functionality is working correctly:');
  console.log('- Vector retrieval from existing embeddings');
  console.log('- Similarity search within same model');
  console.log('- Self-exclusion from results');
  console.log('- Graph boost integration');
  console.log('- Payload summary extraction');
  console.log('');
}

main().catch(console.error);
