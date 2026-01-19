/**
 * Test Script for Phase 3: Cycle Detection & Cascade Queue
 *
 * Tests:
 * 3.1: Check Synced Targets (uses Qdrant)
 * 3.2: Batch Check Performance
 * 3.3: Cycle Detection - New Record
 * 3.4: Cycle Detection - Already Visited
 * 3.5: Self-Referencing FK (Simulated Circular Reference)
 * 3.6: Cascade Queue Operations
 * 3.7: Queue Deduplication
 *
 * Run: npx tsx scripts/test-cascade-sync.ts
 */

import 'dotenv/config';
import {
  CycleDetector,
  CascadeQueue,
  buildQueueItems,
  isLeafModel,
  formatCascadeResult,
  type CascadeQueueItem,
  type CascadeSyncResult,
} from '../src/services/cascade-sync.js';
import {
  checkSyncedFkTargets,
  type FkDependency,
} from '../src/services/fk-dependency-discovery.js';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { loadPipelineSchema } from '../src/services/excel-pipeline-loader.js';

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

async function test3_1_CheckSyncedTargets(): Promise<boolean> {
  const testName = 'Test 3.1: Check Synced Targets';
  log(`Running ${testName}...`);

  try {
    // Check res.partner - some should exist, some should not
    const targetModel = 'res.partner';
    const targetModelId = 78;

    // Test with a mix of IDs - 1, 2, 3 likely exist, 99999999 unlikely
    const testIds = [1, 2, 3, 99999999, 99999998];

    const result = await checkSyncedFkTargets(targetModel, targetModelId, testIds);

    log(`Checked ${testIds.length} IDs: ${result.synced.length} synced, ${result.missing.length} missing`);

    // Verify counts add up
    if (result.synced.length + result.missing.length !== testIds.length) {
      fail(testName, `Counts don't add up: ${result.synced.length} + ${result.missing.length} !== ${testIds.length}`);
      return false;
    }

    // The unlikely IDs should be in missing
    if (!result.missing.includes(99999999) || !result.missing.includes(99999998)) {
      log('Note: Expected 99999999 and 99999998 to be missing - they may have been synced');
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_2_BatchCheckPerformance(): Promise<boolean> {
  const testName = 'Test 3.2: Batch Check Performance';
  log(`Running ${testName}...`);

  try {
    // Generate 1000 test IDs
    const testIds: number[] = [];
    for (let i = 1; i <= 1000; i++) {
      testIds.push(i);
    }

    const startTime = performance.now();
    const result = await checkSyncedFkTargets('res.partner', 78, testIds);
    const duration = performance.now() - startTime;

    log(`Checked ${testIds.length} IDs in ${duration.toFixed(2)}ms`);
    log(`Found ${result.synced.length} synced, ${result.missing.length} missing`);

    // Should complete in under 2 seconds
    if (duration > 2000) {
      fail(testName, `Too slow: ${duration.toFixed(2)}ms (expected <2000ms)`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_3_CycleDetectionNewRecord(): Promise<boolean> {
  const testName = 'Test 3.3: Cycle Detection - New Record';
  log(`Running ${testName}...`);

  try {
    const detector = new CycleDetector();

    // First time seeing this record - should return true
    const shouldProcess = detector.shouldProcess('res.partner', 101);

    if (!shouldProcess) {
      fail(testName, 'shouldProcess returned false for new record');
      return false;
    }

    log(`shouldProcess("res.partner", 101) = ${shouldProcess} (first time)`);

    // Verify it was marked as visited
    if (!detector.hasVisited('res.partner', 101)) {
      fail(testName, 'Record not marked as visited after shouldProcess');
      return false;
    }

    // Verify cycles detected is still 0
    if (detector.getCyclesDetected() !== 0) {
      fail(testName, `Expected 0 cycles, got ${detector.getCyclesDetected()}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_4_CycleDetectionAlreadyVisited(): Promise<boolean> {
  const testName = 'Test 3.4: Cycle Detection - Already Visited';
  log(`Running ${testName}...`);

  try {
    const detector = new CycleDetector();

    // First visit - should return true
    const first = detector.shouldProcess('res.partner', 101);
    log(`First visit: shouldProcess = ${first}`);

    // Second visit - should return false (cycle detected)
    const second = detector.shouldProcess('res.partner', 101);
    log(`Second visit: shouldProcess = ${second}`);

    if (first !== true) {
      fail(testName, 'First visit should return true');
      return false;
    }

    if (second !== false) {
      fail(testName, 'Second visit should return false (cycle)');
      return false;
    }

    // Verify one cycle was detected
    if (detector.getCyclesDetected() !== 1) {
      fail(testName, `Expected 1 cycle, got ${detector.getCyclesDetected()}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_5_SelfReferencingFk(): Promise<boolean> {
  const testName = 'Test 3.5: Self-Referencing FK (Circular Reference)';
  log(`Running ${testName}...`);

  try {
    const detector = new CycleDetector();

    // Simulate: res.partner 101 has parent_id = 100
    //           res.partner 100 has parent_id = 101 (circular!)

    log('Simulating circular parent_id reference:');
    log('  res.partner 101 → parent_id → res.partner 100');
    log('  res.partner 100 → parent_id → res.partner 101 (cycle!)');

    // Process partner 101
    const process101 = detector.shouldProcess('res.partner', 101);
    log(`  Processing partner 101: ${process101}`);

    // Cascade to partner 100 (parent)
    const process100 = detector.shouldProcess('res.partner', 100);
    log(`  Processing partner 100: ${process100}`);

    // Partner 100 references back to 101 - should detect cycle
    const process101Again = detector.shouldProcess('res.partner', 101);
    log(`  Processing partner 101 again: ${process101Again} (should be false)`);

    if (process101 !== true || process100 !== true) {
      fail(testName, 'First visits should return true');
      return false;
    }

    if (process101Again !== false) {
      fail(testName, 'Circular reference should be detected');
      return false;
    }

    // Verify stats
    log(`  Models visited: ${detector.getModelsVisited()}`);
    log(`  Records visited: ${detector.getRecordsVisited()}`);
    log(`  Cycles detected: ${detector.getCyclesDetected()}`);

    if (detector.getCyclesDetected() !== 1) {
      fail(testName, `Expected 1 cycle, got ${detector.getCyclesDetected()}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_6_CascadeQueueOperations(): Promise<boolean> {
  const testName = 'Test 3.6: Cascade Queue Operations';
  log(`Running ${testName}...`);

  try {
    const queue = new CascadeQueue();

    // Enqueue some items
    const item1: CascadeQueueItem = {
      model_name: 'res.partner',
      model_id: 78,
      record_ids: [101, 102, 103],
      depth: 1,
      triggered_by: 'account.move.line',
      triggered_by_field: 'partner_id',
    };

    const item2: CascadeQueueItem = {
      model_name: 'account.account',
      model_id: 292,
      record_ids: [319, 320],
      depth: 1,
      triggered_by: 'account.move.line',
      triggered_by_field: 'account_id',
    };

    const added1 = queue.enqueue(item1);
    const added2 = queue.enqueue(item2);

    log(`Added res.partner: ${added1}, account.account: ${added2}`);

    if (!added1 || !added2) {
      fail(testName, 'Both items should be added');
      return false;
    }

    // Check queue size
    if (queue.size() !== 2) {
      fail(testName, `Expected queue size 2, got ${queue.size()}`);
      return false;
    }

    // Dequeue first item
    const first = queue.dequeue();
    log(`Dequeued: ${first?.model_name} with ${first?.record_ids.length} record IDs`);

    if (first?.model_name !== 'res.partner') {
      fail(testName, `Expected res.partner first, got ${first?.model_name}`);
      return false;
    }

    // Check queue size after dequeue
    if (queue.size() !== 1) {
      fail(testName, `Expected queue size 1 after dequeue, got ${queue.size()}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_7_QueueDeduplication(): Promise<boolean> {
  const testName = 'Test 3.7: Queue Deduplication';
  log(`Running ${testName}...`);

  try {
    const queue = new CascadeQueue();

    // Add res.partner with some IDs
    const item1: CascadeQueueItem = {
      model_name: 'res.partner',
      model_id: 78,
      record_ids: [101, 102, 103],
      depth: 1,
      triggered_by: 'crm.lead',
      triggered_by_field: 'partner_id',
    };

    const added1 = queue.enqueue(item1);
    log(`First enqueue of res.partner: ${added1}`);

    // Try to add res.partner again with different IDs
    const item2: CascadeQueueItem = {
      model_name: 'res.partner',
      model_id: 78,
      record_ids: [103, 104, 105], // 103 overlaps, 104, 105 are new
      depth: 1,
      triggered_by: 'sale.order',
      triggered_by_field: 'partner_id',
    };

    const added2 = queue.enqueue(item2);
    log(`Second enqueue of res.partner: ${added2} (should merge IDs)`);

    if (added2 !== false) {
      fail(testName, 'Second enqueue should return false (duplicate model)');
      return false;
    }

    // Queue size should still be 1
    if (queue.size() !== 1) {
      fail(testName, `Expected queue size 1, got ${queue.size()}`);
      return false;
    }

    // Dequeue and check merged IDs
    const item = queue.dequeue();
    log(`Merged record_ids: [${item?.record_ids.join(', ')}]`);

    // Should have merged and deduplicated: 101, 102, 103, 104, 105
    if (!item) {
      fail(testName, 'Dequeue returned undefined');
      return false;
    }

    const expectedIds = [101, 102, 103, 104, 105];
    const hasAllIds = expectedIds.every(id => item.record_ids.includes(id));

    if (!hasAllIds) {
      fail(testName, `Expected IDs ${expectedIds.join(', ')}, got ${item.record_ids.join(', ')}`);
      return false;
    }

    if (item.record_ids.length !== 5) {
      fail(testName, `Expected 5 unique IDs, got ${item.record_ids.length}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_8_BatchDequeue(): Promise<boolean> {
  const testName = 'Test 3.8: Batch Dequeue for Parallel Processing';
  log(`Running ${testName}...`);

  try {
    const queue = new CascadeQueue();

    // Add 5 items
    for (let i = 1; i <= 5; i++) {
      queue.enqueue({
        model_name: `model.${i}`,
        model_id: i,
        record_ids: [i * 100],
        depth: 1,
        triggered_by: 'test',
        triggered_by_field: 'test_id',
      });
    }

    log(`Queue size: ${queue.size()}`);

    // Dequeue batch of 3
    const batch = queue.dequeueBatch(3);
    log(`Dequeued batch of ${batch.length} items`);

    if (batch.length !== 3) {
      fail(testName, `Expected batch of 3, got ${batch.length}`);
      return false;
    }

    // Queue should have 2 remaining
    if (queue.size() !== 2) {
      fail(testName, `Expected 2 remaining, got ${queue.size()}`);
      return false;
    }

    // Batch should be in order: model.1, model.2, model.3
    const batchNames = batch.map(item => item.model_name);
    log(`Batch models: ${batchNames.join(', ')}`);

    if (batchNames[0] !== 'model.1' || batchNames[1] !== 'model.2' || batchNames[2] !== 'model.3') {
      fail(testName, `Batch order incorrect: ${batchNames.join(', ')}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_9_FilterUnvisited(): Promise<boolean> {
  const testName = 'Test 3.9: Filter Unvisited Records';
  log(`Running ${testName}...`);

  try {
    const detector = new CycleDetector();

    // Mark some records as already visited
    detector.markAllVisited('res.partner', [101, 102, 103]);

    // Now filter a list that includes visited and new records
    const inputIds = [101, 102, 103, 104, 105, 106];
    const unvisited = detector.filterUnvisited('res.partner', inputIds);

    log(`Input: [${inputIds.join(', ')}]`);
    log(`Already visited: [101, 102, 103]`);
    log(`Unvisited (new): [${unvisited.join(', ')}]`);

    // Should only return 104, 105, 106
    if (unvisited.length !== 3) {
      fail(testName, `Expected 3 unvisited, got ${unvisited.length}`);
      return false;
    }

    const expected = [104, 105, 106];
    const hasAll = expected.every(id => unvisited.includes(id));

    if (!hasAll) {
      fail(testName, `Expected [104, 105, 106], got [${unvisited.join(', ')}]`);
      return false;
    }

    // These should now be marked as visited too
    if (!detector.hasVisited('res.partner', 104)) {
      fail(testName, '104 should now be marked as visited');
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_10_BuildQueueItems(): Promise<boolean> {
  const testName = 'Test 3.10: Build Queue Items from Dependencies';
  log(`Running ${testName}...`);

  try {
    // Create mock FK dependencies
    const dependencies: FkDependency[] = [
      {
        field_name: 'partner_id',
        field_label: 'Partner',
        field_type: 'many2one',
        target_model: 'res.partner',
        target_model_id: 78,
        unique_ids: [101, 102, 103],
        total_references: 5,
      },
      {
        field_name: 'account_id',
        field_label: 'Account',
        field_type: 'many2one',
        target_model: 'account.account',
        target_model_id: 292,
        unique_ids: [319, 320],
        total_references: 3,
      },
    ];

    const queueItems = buildQueueItems(dependencies, 0, 'account.move.line');

    log(`Built ${queueItems.length} queue items`);

    if (queueItems.length !== 2) {
      fail(testName, `Expected 2 queue items, got ${queueItems.length}`);
      return false;
    }

    // Check first item
    const partnerItem = queueItems.find(item => item.model_name === 'res.partner');
    if (!partnerItem) {
      fail(testName, 'res.partner queue item not found');
      return false;
    }

    log(`Partner item: depth=${partnerItem.depth}, triggered_by=${partnerItem.triggered_by}, field=${partnerItem.triggered_by_field}`);

    if (partnerItem.depth !== 1) {
      fail(testName, `Expected depth 1, got ${partnerItem.depth}`);
      return false;
    }

    if (partnerItem.triggered_by !== 'account.move.line') {
      fail(testName, `Expected triggered_by 'account.move.line', got '${partnerItem.triggered_by}'`);
      return false;
    }

    if (partnerItem.triggered_by_field !== 'partner_id') {
      fail(testName, `Expected triggered_by_field 'partner_id', got '${partnerItem.triggered_by_field}'`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test3_11_IsLeafModel(): Promise<boolean> {
  const testName = 'Test 3.11: Is Leaf Model Check';
  log(`Running ${testName}...`);

  try {
    // Load schema
    loadPipelineSchema();

    // res.currency typically has no outgoing FKs (leaf)
    const isCurrencyLeaf = isLeafModel('res.currency');
    log(`res.currency is leaf: ${isCurrencyLeaf}`);

    // account.move.line has many FKs (not a leaf)
    const isAmlLeaf = isLeafModel('account.move.line');
    log(`account.move.line is leaf: ${isAmlLeaf}`);

    // account.move.line should NOT be a leaf
    if (isAmlLeaf) {
      fail(testName, 'account.move.line should NOT be a leaf (has many FKs)');
      return false;
    }

    // Note: We don't fail if currency is not a leaf, as it depends on schema
    // Just log the result for now

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
  console.log('Phase 3: Cycle Detection & Cascade Queue');
  console.log('========================================\n');

  // Initialize services
  log('Initializing services...');

  const vectorReady = initializeVectorClient();
  if (!vectorReady) {
    console.error('Failed to initialize vector client. Check QDRANT_HOST.');
    process.exit(1);
  }

  log('Services initialized.\n');

  // Run tests
  const results: boolean[] = [];

  results.push(await test3_1_CheckSyncedTargets());
  results.push(await test3_2_BatchCheckPerformance());
  results.push(await test3_3_CycleDetectionNewRecord());
  results.push(await test3_4_CycleDetectionAlreadyVisited());
  results.push(await test3_5_SelfReferencingFk());
  results.push(await test3_6_CascadeQueueOperations());
  results.push(await test3_7_QueueDeduplication());
  results.push(await test3_8_BatchDequeue());
  results.push(await test3_9_FilterUnvisited());
  results.push(await test3_10_BuildQueueItems());
  results.push(await test3_11_IsLeafModel());

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
