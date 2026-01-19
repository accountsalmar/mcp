/**
 * Test Search Modes Script
 *
 * Tests the searchByPointType function with all three modes:
 * - schema: Search nexsus collection only
 * - data: Search nexsus_data collection only
 * - all: Search both collections and merge results
 */

import 'dotenv/config';

import { initializeEmbeddingService, embed } from './dist/services/embedding-service.js';
import { initializeVectorClient, searchByPointType, getCollectionInfo } from './dist/services/vector-client.js';

async function testSearchModes() {
  console.log('='.repeat(60));
  console.log('TEST: Search Modes (Bug 1 Fix Verification)');
  console.log('='.repeat(60));
  console.log();

  // Initialize services
  console.log('Initializing services...');
  const embeddingReady = initializeEmbeddingService();
  const vectorReady = initializeVectorClient();

  if (!embeddingReady || !vectorReady) {
    console.error('Services not ready. Check .env configuration.');
    process.exit(1);
  }
  console.log('  Services: READY\n');

  // Check collections exist
  console.log('Checking collections...');
  try {
    const schemaInfo = await getCollectionInfo('nexsus');
    console.log(`  nexsus (schema): ${schemaInfo?.vectors_count || 0} vectors`);
  } catch (e) {
    console.log('  nexsus (schema): NOT FOUND');
  }

  try {
    const dataInfo = await getCollectionInfo('nexsus_data');
    console.log(`  nexsus_data (pipeline): ${dataInfo?.vectors_count || 0} vectors`);
  } catch (e) {
    console.log('  nexsus_data (pipeline): NOT FOUND');
  }
  console.log();

  // Generate test embedding
  const testQuery = 'customer email';
  console.log(`Generating embedding for: "${testQuery}"...`);
  const embedding = await embed(testQuery, 'query');
  console.log(`  Embedding: ${embedding.length} dimensions\n`);

  // Test 1: Schema search (default)
  console.log('='.repeat(60));
  console.log('TEST 1: Schema Search (point_type="schema")');
  console.log('='.repeat(60));
  try {
    const schemaResults = await searchByPointType(embedding, {
      limit: 5,
      pointType: 'schema',
    });
    console.log(`  Results: ${schemaResults.length}`);
    if (schemaResults.length > 0) {
      console.log('  Top 3:');
      schemaResults.slice(0, 3).forEach((r, i) => {
        const p = r.payload;
        console.log(`    ${i + 1}. [${r.score.toFixed(3)}] ${p.model_name}.${p.field_name} (${p.field_type})`);
      });
      console.log('  STATUS: PASS ✓');
    } else {
      console.log('  STATUS: FAIL - No results');
    }
  } catch (err) {
    console.log(`  STATUS: ERROR - ${err.message}`);
  }
  console.log();

  // Test 2: Data search (the bug we're fixing)
  console.log('='.repeat(60));
  console.log('TEST 2: Data Search (point_type="data")');
  console.log('='.repeat(60));
  try {
    const dataResults = await searchByPointType(embedding, {
      limit: 5,
      pointType: 'data',
    });
    console.log(`  Results: ${dataResults.length}`);
    if (dataResults.length > 0) {
      console.log('  Top 3:');
      dataResults.slice(0, 3).forEach((r, i) => {
        const p = r.payload;
        console.log(`    ${i + 1}. [${r.score.toFixed(3)}] ${p.model_name} (record_id: ${p.record_id})`);
      });
      console.log('  STATUS: PASS ✓');
    } else {
      console.log('  STATUS: NO DATA - nexsus_data collection may be empty');
      console.log('  (This is OK if no pipeline sync has been run yet)');
    }
  } catch (err) {
    console.log(`  STATUS: ERROR - ${err.message}`);
  }
  console.log();

  // Test 3: Combined search
  console.log('='.repeat(60));
  console.log('TEST 3: Combined Search (point_type="all")');
  console.log('='.repeat(60));
  try {
    const allResults = await searchByPointType(embedding, {
      limit: 5,
      pointType: 'all',
    });
    console.log(`  Results: ${allResults.length}`);
    if (allResults.length > 0) {
      console.log('  Top 3:');
      allResults.slice(0, 3).forEach((r, i) => {
        const p = r.payload;
        const pointType = p.point_type || 'schema';
        if (pointType === 'pipeline_data') {
          console.log(`    ${i + 1}. [${r.score.toFixed(3)}] DATA: ${p.model_name} (record_id: ${p.record_id})`);
        } else {
          console.log(`    ${i + 1}. [${r.score.toFixed(3)}] SCHEMA: ${p.model_name}.${p.field_name}`);
        }
      });
      console.log('  STATUS: PASS ✓');
    } else {
      console.log('  STATUS: FAIL - No results');
    }
  } catch (err) {
    console.log(`  STATUS: ERROR - ${err.message}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

testSearchModes().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
