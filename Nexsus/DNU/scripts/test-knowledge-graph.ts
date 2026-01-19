/**
 * Test Script for Phase 1: Knowledge Graph Collection
 *
 * Tests:
 * 1.1: Collection Creation
 * 1.2: Upsert Relationship
 * 1.3: Update Existing Relationship
 * 1.4: Get Model Relationships
 *
 * Run: npx tsx scripts/test-knowledge-graph.ts
 */

import 'dotenv/config';
import {
  createGraphCollection,
  graphCollectionExists,
  getGraphCollectionInfo,
  upsertRelationship,
  getRelationship,
  getModelRelationships,
  generateRelationshipId,
} from '../src/services/knowledge-graph.js';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { initializeEmbeddingService } from '../src/services/embedding-service.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function log(message: string): void {
  console.log(`[TEST] ${message}`);
}

function pass(testName: string): void {
  console.log(`\x1b[32m[PASS]\x1b[0m ${testName}`);
}

function fail(testName: string, error: string): void {
  console.log(`\x1b[31m[FAIL]\x1b[0m ${testName}: ${error}`);
}

// =============================================================================
// TESTS
// =============================================================================

async function test1_1_CollectionCreation(): Promise<boolean> {
  const testName = 'Test 1.1: Collection Creation';
  log(`Running ${testName}...`);

  try {
    // Check if collection exists before test
    const existsBefore = await graphCollectionExists();
    log(`Collection exists before: ${existsBefore}`);

    if (!existsBefore) {
      // Create collection
      const created = await createGraphCollection();
      if (!created) {
        fail(testName, 'createGraphCollection() returned false');
        return false;
      }
    }

    // Verify collection exists after
    const existsAfter = await graphCollectionExists();
    if (!existsAfter) {
      fail(testName, 'Collection does not exist after creation');
      return false;
    }

    // Get collection info
    const info = await getGraphCollectionInfo();
    log(`Collection info: ${JSON.stringify(info)}`);

    if (!info.exists) {
      fail(testName, 'Collection info shows not exists');
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test1_2_UpsertRelationship(): Promise<boolean> {
  const testName = 'Test 1.2: Upsert Relationship';
  log(`Running ${testName}...`);

  try {
    // Upsert a test relationship
    const pointId = await upsertRelationship({
      source_model: 'account.move.line',
      source_model_id: 389,
      field_name: 'partner_id',
      field_label: 'Partner',
      field_type: 'many2one',
      target_model: 'res.partner',
      target_model_id: 78,
      edge_count: 100,
      unique_targets: 50,
      is_leaf: false,
      depth_from_origin: 1,
      cascade_source: 'test',
    });

    log(`Created relationship with ID: ${pointId}`);

    // Verify the relationship exists
    const relationship = await getRelationship(
      'account.move.line',
      'partner_id',
      'res.partner'
    );

    if (!relationship) {
      fail(testName, 'Relationship not found after upsert');
      return false;
    }

    // Verify payload
    if (relationship.payload.edge_count !== 100) {
      fail(testName, `edge_count mismatch: expected 100, got ${relationship.payload.edge_count}`);
      return false;
    }

    if (relationship.payload.is_leaf !== false) {
      fail(testName, `is_leaf mismatch: expected false, got ${relationship.payload.is_leaf}`);
      return false;
    }

    log(`Relationship payload: ${JSON.stringify(relationship.payload, null, 2)}`);
    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test1_3_UpdateExistingRelationship(): Promise<boolean> {
  const testName = 'Test 1.3: Update Existing Relationship';
  log(`Running ${testName}...`);

  try {
    // Get current state
    const before = await getRelationship(
      'account.move.line',
      'partner_id',
      'res.partner'
    );

    if (!before) {
      fail(testName, 'Relationship not found before update');
      return false;
    }

    const originalEdgeCount = before.payload.edge_count;
    log(`Original edge_count: ${originalEdgeCount}`);

    // Upsert again with additional edge count
    await upsertRelationship({
      source_model: 'account.move.line',
      source_model_id: 389,
      field_name: 'partner_id',
      field_label: 'Partner',
      field_type: 'many2one',
      target_model: 'res.partner',
      target_model_id: 78,
      edge_count: 50, // Additional 50 edges
      unique_targets: 75, // Higher unique targets
      cascade_source: 'test_update',
    });

    // Verify update
    const after = await getRelationship(
      'account.move.line',
      'partner_id',
      'res.partner'
    );

    if (!after) {
      fail(testName, 'Relationship not found after update');
      return false;
    }

    log(`New edge_count: ${after.payload.edge_count}`);
    log(`New unique_targets: ${after.payload.unique_targets}`);
    log(`Cascade sources: ${after.payload.cascade_sources.join(', ')}`);

    // Verify edge_count was added
    if (after.payload.edge_count !== originalEdgeCount + 50) {
      fail(testName, `edge_count not added: expected ${originalEdgeCount + 50}, got ${after.payload.edge_count}`);
      return false;
    }

    // Verify unique_targets was updated to max
    if (after.payload.unique_targets !== 75) {
      fail(testName, `unique_targets not updated: expected 75, got ${after.payload.unique_targets}`);
      return false;
    }

    // Verify cascade_sources contains both sources
    if (!after.payload.cascade_sources.includes('test') ||
        !after.payload.cascade_sources.includes('test_update')) {
      fail(testName, `cascade_sources missing sources: ${after.payload.cascade_sources}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test1_4_GetModelRelationships(): Promise<boolean> {
  const testName = 'Test 1.4: Get Model Relationships';
  log(`Running ${testName}...`);

  try {
    // Add two more relationships for account.move.line
    await upsertRelationship({
      source_model: 'account.move.line',
      source_model_id: 389,
      field_name: 'account_id',
      field_label: 'Account',
      field_type: 'many2one',
      target_model: 'account.account',
      target_model_id: 292,
      edge_count: 80,
      unique_targets: 40,
      is_leaf: true, // account.account is a leaf
      cascade_source: 'test',
    });

    await upsertRelationship({
      source_model: 'account.move.line',
      source_model_id: 389,
      field_name: 'move_id',
      field_label: 'Journal Entry',
      field_type: 'many2one',
      target_model: 'account.move',
      target_model_id: 388,
      edge_count: 60,
      unique_targets: 60,
      is_leaf: false,
      cascade_source: 'test',
    });

    // Get all relationships for account.move.line
    const relationships = await getModelRelationships('account.move.line');

    log(`Found ${relationships.length} relationships for account.move.line`);

    if (relationships.length < 3) {
      fail(testName, `Expected at least 3 relationships, got ${relationships.length}`);
      return false;
    }

    // Verify we have all three FK fields
    const fieldNames = relationships.map(r => r.field_name);
    log(`Field names: ${fieldNames.join(', ')}`);

    if (!fieldNames.includes('partner_id') ||
        !fieldNames.includes('account_id') ||
        !fieldNames.includes('move_id')) {
      fail(testName, `Missing expected FK fields: ${fieldNames}`);
      return false;
    }

    // Print all relationships
    for (const rel of relationships) {
      log(`  - ${rel.field_name} (${rel.field_label}) → ${rel.target_model} [${rel.edge_count} edges, leaf=${rel.is_leaf}]`);
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('Phase 1: Knowledge Graph Tests');
  console.log('========================================\n');

  // Initialize services
  log('Initializing services...');

  const vectorReady = initializeVectorClient();
  if (!vectorReady) {
    console.error('Failed to initialize vector client. Check QDRANT_HOST.');
    process.exit(1);
  }

  const embeddingReady = initializeEmbeddingService();
  if (!embeddingReady) {
    console.error('Failed to initialize embedding service. Check VOYAGE_API_KEY.');
    process.exit(1);
  }

  log('Services initialized.\n');

  // Run tests
  const results: boolean[] = [];

  results.push(await test1_1_CollectionCreation());
  results.push(await test1_2_UpsertRelationship());
  results.push(await test1_3_UpdateExistingRelationship());
  results.push(await test1_4_GetModelRelationships());

  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\x1b[32mAll tests passed!\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[31mSome tests failed.\x1b[0m');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
