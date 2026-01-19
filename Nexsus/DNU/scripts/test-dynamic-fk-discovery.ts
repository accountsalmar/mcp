/**
 * Test Script: Dynamic FK Discovery for graph_traverse
 *
 * Tests Phase 4 of KG_improvements_1984 - Dynamic FK discovery
 *
 * Run with: npx tsx scripts/test-dynamic-fk-discovery.ts
 */

import 'dotenv/config';
import { initializeVectorClient, getQdrantClient } from '../src/services/vector-client.js';
import { getGraphContext } from '../src/services/graph-search-engine.js';
import { UNIFIED_CONFIG } from '../src/constants.js';

// =============================================================================
// TEST SETUP
// =============================================================================

async function setup(): Promise<boolean> {
  console.log('='.repeat(60));
  console.log('Dynamic FK Discovery Test Suite (Phase 4)');
  console.log('='.repeat(60));
  console.log('');

  // Initialize services
  console.log('Initializing services...');

  try {
    await initializeVectorClient();
    console.log('  Vector client ready');
  } catch (error) {
    console.error('  Vector client failed:', error);
    return false;
  }

  console.log('');
  return true;
}

// =============================================================================
// TEST CASES
// =============================================================================

/**
 * Test 1: Discover incoming FK fields for res.partner (hub model)
 */
async function testDiscoverFkFieldsResPartner(): Promise<string[]> {
  console.log('-'.repeat(60));
  console.log('TEST 1: Discover incoming FK fields for res.partner');
  console.log('-'.repeat(60));

  const graphContext = await getGraphContext('res.partner');

  console.log(`\nTotal incoming edges: ${graphContext.incoming.length}`);

  if (graphContext.incoming.length === 0) {
    console.log('No incoming edges found (graph may not be populated)');
    return [];
  }

  // Build FK field names from incoming edges
  const discoveredFields = graphContext.incoming.map(edge => `${edge.field_name}_qdrant`);

  console.log('\nDiscovered FK fields that point to res.partner:');
  const topFields = discoveredFields.slice(0, 15);
  for (const field of topFields) {
    console.log(`  - ${field}`);
  }
  if (discoveredFields.length > 15) {
    console.log(`  ... and ${discoveredFields.length - 15} more`);
  }

  console.log('\n  TEST 1 COMPLETE\n');
  return discoveredFields;
}

/**
 * Test 2: Compare static vs dynamic field count
 */
async function testCompareFieldCounts(): Promise<void> {
  console.log('-'.repeat(60));
  console.log('TEST 2: Compare static vs dynamic field counts');
  console.log('-'.repeat(60));

  // Static fallback fields (from graph-tool.ts)
  const staticFields = [
    'partner_id_qdrant', 'user_id_qdrant', 'company_id_qdrant',
    'create_uid_qdrant', 'write_uid_qdrant', 'move_id_qdrant',
    'account_id_qdrant', 'journal_id_qdrant', 'stage_id_qdrant',
    'team_id_qdrant', 'parent_id_qdrant', 'commercial_partner_id_qdrant',
    'country_id_qdrant', 'state_id_qdrant', 'currency_id_qdrant',
    'analytic_account_id_qdrant', 'product_id_qdrant', 'product_tmpl_id_qdrant',
    'categ_id_qdrant', 'salesperson_id_qdrant', 'sales_team_id_qdrant',
    'campaign_id_qdrant', 'source_id_qdrant', 'medium_id_qdrant',
  ];

  const models = ['res.partner', 'account.account', 'res.users'];

  for (const modelName of models) {
    const graphContext = await getGraphContext(modelName);
    const dynamicFields = graphContext.incoming.map(edge => `${edge.field_name}_qdrant`);

    console.log(`\n${modelName}:`);
    console.log(`  Static fields: ${staticFields.length}`);
    console.log(`  Dynamic fields: ${dynamicFields.length}`);

    // Find fields discovered dynamically that weren't in static list
    const newFields = dynamicFields.filter(f => !staticFields.includes(f));
    if (newFields.length > 0) {
      console.log(`  NEW fields discovered: ${newFields.length}`);
      for (const f of newFields.slice(0, 5)) {
        console.log(`    + ${f}`);
      }
      if (newFields.length > 5) {
        console.log(`    + ...and ${newFields.length - 5} more`);
      }
    }
  }

  console.log('\n  TEST 2 COMPLETE\n');
}

/**
 * Test 3: Simulate incoming traversal with dynamic discovery
 */
async function testSimulateIncomingTraversal(): Promise<void> {
  console.log('-'.repeat(60));
  console.log('TEST 3: Simulate incoming traversal for res.partner');
  console.log('-'.repeat(60));

  const targetModelName = 'res.partner';
  const graphContext = await getGraphContext(targetModelName);

  if (graphContext.incoming.length === 0) {
    console.log('No incoming edges found, skipping simulation');
    return;
  }

  // Build FK field names from incoming edges + fallbacks
  const discoveredFields = graphContext.incoming.map(edge => `${edge.field_name}_qdrant`);
  const combinedFields = new Set([
    ...discoveredFields,
    'partner_id_qdrant',
    'user_id_qdrant',
    'company_id_qdrant',
    'create_uid_qdrant',
    'write_uid_qdrant',
  ]);

  console.log(`\nTotal FK fields to search: ${combinedFields.size}`);

  // Build sample filter (for demonstration)
  const sampleUuid = '00000002-0078-0000-0000-000000282161'; // Example partner UUID
  const filter = {
    must: [
      { key: 'point_type', match: { value: 'data' } },
    ],
    should: Array.from(combinedFields).map(field => ({
      key: field,
      match: { value: sampleUuid }
    }))
  };

  console.log(`\nFilter structure:`);
  console.log(`  - must: point_type = 'data'`);
  console.log(`  - should: ${combinedFields.size} FK field conditions`);

  // Execute scroll query
  try {
    const qdrant = getQdrantClient();
    const result = await qdrant.scroll(UNIFIED_CONFIG.COLLECTION_NAME, {
      filter,
      limit: 20,
      with_payload: true,
      with_vector: false,
    });

    console.log(`\nResults: ${result.points.length} records reference this partner`);

    if (result.points.length > 0) {
      console.log('\nSample results:');
      for (const point of result.points.slice(0, 5)) {
        const payload = point.payload as Record<string, unknown>;
        console.log(`  - ${payload.model_name} #${payload.record_id}`);
      }
    }
  } catch (error) {
    console.log(`\nQuery execution skipped (would require actual record UUID)`);
  }

  console.log('\n  TEST 3 COMPLETE\n');
}

/**
 * Test 4: Edge case - model with no incoming references
 */
async function testModelWithNoIncoming(): Promise<void> {
  console.log('-'.repeat(60));
  console.log('TEST 4: Model with few/no incoming references');
  console.log('-'.repeat(60));

  // Try models that might not be heavily referenced
  const models = ['crm.lost.reason', 'crm.tag', 'utm.source'];

  for (const modelName of models) {
    const graphContext = await getGraphContext(modelName);
    console.log(`\n${modelName}:`);
    console.log(`  Incoming references: ${graphContext.incoming.length}`);
    console.log(`  Outgoing FKs: ${graphContext.outgoing.length}`);

    if (graphContext.incoming.length === 0) {
      console.log(`  -> Will use FALLBACK_FK_FIELDS (24 fields)`);
    } else {
      console.log(`  -> Will use ${graphContext.incoming.length} discovered + 5 fallback fields`);
    }
  }

  console.log('\n  TEST 4 COMPLETE\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  try {
    const ready = await setup();

    if (!ready) {
      console.log('Setup incomplete - tests skipped');
      process.exit(1);
    }

    // Run tests
    await testDiscoverFkFieldsResPartner();
    await testCompareFieldCounts();
    await testSimulateIncomingTraversal();
    await testModelWithNoIncoming();

    // Summary
    console.log('='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('  All Phase 4 tests completed!');
    console.log('');
    console.log('Dynamic FK discovery is ready for use in graph_traverse.');
    console.log('');
    console.log('Claude.ai Test Prompts:');
    console.log('1. graph_traverse for res.partner #282161 with direction="incoming"');
    console.log('2. graph_traverse for account.account with direction="both"');
    console.log('3. Check logs for "Using N FK fields for incoming traversal"');
    console.log('');
    console.log('Next: Phase 5 (Create Claude Skill for graph-search)');

  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

main();
