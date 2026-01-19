/**
 * Test Script for Phase 2: FK Dependency Discovery
 *
 * Tests:
 * 2.1: Extract FK Dependencies from Records (many2one)
 * 2.2: Extract FK Dependencies from Records (many2many)
 * 2.3: Handle Null FK Values
 * 2.4: Get FK Fields from Schema
 * 2.5: Large ID Set Performance
 *
 * Run: npx tsx scripts/test-fk-discovery.ts
 */

import 'dotenv/config';
import {
  getFkFieldsForModel,
  extractFkDependencies,
  checkSyncedFkTargets,
  summarizeDependencies,
  type FkFieldInfo,
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

async function test2_1_ExtractManyToOneDependencies(): Promise<boolean> {
  const testName = 'Test 2.1: Extract FK Dependencies (many2one)';
  log(`Running ${testName}...`);

  try {
    // Create mock FK field info
    const fkFields: FkFieldInfo[] = [
      {
        field_name: 'partner_id',
        field_label: 'Partner',
        field_type: 'many2one',
        target_model: 'res.partner',
        target_model_id: 78,
        stored: true,
      },
      {
        field_name: 'account_id',
        field_label: 'Account',
        field_type: 'many2one',
        target_model: 'account.account',
        target_model_id: 292,
        stored: true,
      },
    ];

    // Create mock records (Odoo format: [id, name] for many2one)
    const records = [
      { id: 1, partner_id: [101, 'Partner A'], account_id: [319, 'Account 1'] },
      { id: 2, partner_id: [101, 'Partner A'], account_id: [320, 'Account 2'] },
      { id: 3, partner_id: [282, 'Partner B'], account_id: [319, 'Account 1'] },
    ];

    // Extract dependencies
    const dependencies = extractFkDependencies(records, fkFields);

    log(`Found ${dependencies.length} dependencies`);

    // Verify partner_id dependency
    const partnerDep = dependencies.find(d => d.field_name === 'partner_id');
    if (!partnerDep) {
      fail(testName, 'partner_id dependency not found');
      return false;
    }

    log(`partner_id: ${partnerDep.unique_ids.length} unique, ${partnerDep.total_references} refs`);

    if (partnerDep.unique_ids.length !== 2) {
      fail(testName, `Expected 2 unique partner_ids, got ${partnerDep.unique_ids.length}`);
      return false;
    }

    if (partnerDep.total_references !== 3) {
      fail(testName, `Expected 3 total refs, got ${partnerDep.total_references}`);
      return false;
    }

    // Verify account_id dependency
    const accountDep = dependencies.find(d => d.field_name === 'account_id');
    if (!accountDep) {
      fail(testName, 'account_id dependency not found');
      return false;
    }

    if (accountDep.unique_ids.length !== 2) {
      fail(testName, `Expected 2 unique account_ids, got ${accountDep.unique_ids.length}`);
      return false;
    }

    log(summarizeDependencies(dependencies));
    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test2_2_ExtractManyToManyDependencies(): Promise<boolean> {
  const testName = 'Test 2.2: Extract FK Dependencies (many2many)';
  log(`Running ${testName}...`);

  try {
    // Create mock FK field info for many2many
    const fkFields: FkFieldInfo[] = [
      {
        field_name: 'distribution_analytic_account_ids',
        field_label: 'Analytic Accounts',
        field_type: 'many2many',
        target_model: 'account.analytic.account',
        target_model_id: 100,
        stored: true,
      },
    ];

    // Create mock records (Odoo format: array of IDs for many2many)
    const records = [
      { id: 1, distribution_analytic_account_ids: [50, 51, 52] },
      { id: 2, distribution_analytic_account_ids: [51, 53] },
    ];

    // Extract dependencies
    const dependencies = extractFkDependencies(records, fkFields);

    log(`Found ${dependencies.length} dependencies`);

    const analyticDep = dependencies.find(d => d.field_name === 'distribution_analytic_account_ids');
    if (!analyticDep) {
      fail(testName, 'distribution_analytic_account_ids dependency not found');
      return false;
    }

    log(`distribution_analytic_account_ids: ${analyticDep.unique_ids.length} unique, ${analyticDep.total_references} refs`);

    // Should have 4 unique IDs: 50, 51, 52, 53
    if (analyticDep.unique_ids.length !== 4) {
      fail(testName, `Expected 4 unique IDs, got ${analyticDep.unique_ids.length}: [${analyticDep.unique_ids.join(', ')}]`);
      return false;
    }

    // Should have 5 total references: 3 + 2
    if (analyticDep.total_references !== 5) {
      fail(testName, `Expected 5 total refs, got ${analyticDep.total_references}`);
      return false;
    }

    // Verify the field type is correct
    if (analyticDep.field_type !== 'many2many') {
      fail(testName, `Expected field_type 'many2many', got '${analyticDep.field_type}'`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test2_3_HandleNullFkValues(): Promise<boolean> {
  const testName = 'Test 2.3: Handle Null FK Values';
  log(`Running ${testName}...`);

  try {
    const fkFields: FkFieldInfo[] = [
      {
        field_name: 'partner_id',
        field_label: 'Partner',
        field_type: 'many2one',
        target_model: 'res.partner',
        target_model_id: 78,
        stored: true,
      },
      {
        field_name: 'tag_ids',
        field_label: 'Tags',
        field_type: 'many2many',
        target_model: 'crm.tag',
        target_model_id: 200,
        stored: true,
      },
    ];

    // Records with null, false, undefined, and empty arrays
    const records = [
      { id: 1, partner_id: [101, 'Partner A'], tag_ids: [1, 2] },
      { id: 2, partner_id: null, tag_ids: [] },
      { id: 3, partner_id: false, tag_ids: null },
      { id: 4, partner_id: undefined, tag_ids: undefined },
      { id: 5, partner_id: [102, 'Partner B'], tag_ids: [3] },
    ];

    const dependencies = extractFkDependencies(records, fkFields);

    // Check partner_id - should have 2 unique (101, 102)
    const partnerDep = dependencies.find(d => d.field_name === 'partner_id');
    if (!partnerDep) {
      fail(testName, 'partner_id dependency not found');
      return false;
    }

    if (partnerDep.unique_ids.length !== 2) {
      fail(testName, `Expected 2 partner_ids (null excluded), got ${partnerDep.unique_ids.length}`);
      return false;
    }

    // Check tag_ids - should have 3 unique (1, 2, 3)
    const tagDep = dependencies.find(d => d.field_name === 'tag_ids');
    if (!tagDep) {
      fail(testName, 'tag_ids dependency not found');
      return false;
    }

    if (tagDep.unique_ids.length !== 3) {
      fail(testName, `Expected 3 tag_ids (empty excluded), got ${tagDep.unique_ids.length}`);
      return false;
    }

    log(`partner_id: ${partnerDep.unique_ids.length} unique (null/false excluded)`);
    log(`tag_ids: ${tagDep.unique_ids.length} unique (empty arrays excluded)`);

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test2_4_GetFkFieldsFromSchema(): Promise<boolean> {
  const testName = 'Test 2.4: Get FK Fields from Schema';
  log(`Running ${testName}...`);

  try {
    // Load pipeline schema first
    const schema = loadPipelineSchema();
    log(`Loaded schema with ${schema.size} models`);

    // Test with account.move.line which should have FK fields
    const fkFields = getFkFieldsForModel('account.move.line');

    log(`Found ${fkFields.length} FK fields for account.move.line`);

    if (fkFields.length === 0) {
      fail(testName, 'No FK fields found for account.move.line');
      return false;
    }

    // Should have partner_id, account_id, etc.
    const fieldNames = fkFields.map(f => f.field_name);
    log(`FK fields: ${fieldNames.slice(0, 10).join(', ')}${fieldNames.length > 10 ? '...' : ''}`);

    // Check that we have common FK fields
    const hasPartnerId = fkFields.some(f => f.field_name === 'partner_id');
    const hasAccountId = fkFields.some(f => f.field_name === 'account_id');

    if (!hasPartnerId) {
      log('Warning: partner_id not found in FK fields');
    }
    if (!hasAccountId) {
      log('Warning: account_id not found in FK fields');
    }

    // Verify FK field structure
    for (const field of fkFields.slice(0, 3)) {
      log(`  ${field.field_name} (${field.field_type}) → ${field.target_model}`);
      if (!field.target_model) {
        fail(testName, `FK field ${field.field_name} has no target_model`);
        return false;
      }
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test2_5_LargeIdSetPerformance(): Promise<boolean> {
  const testName = 'Test 2.5: Large ID Set Performance';
  log(`Running ${testName}...`);

  try {
    const fkFields: FkFieldInfo[] = [
      {
        field_name: 'partner_id',
        field_label: 'Partner',
        field_type: 'many2one',
        target_model: 'res.partner',
        target_model_id: 78,
        stored: true,
      },
    ];

    // Create 10,000 records with 500 unique partner_ids
    const records: Array<Record<string, unknown>> = [];
    const uniquePartnerIds = 500;

    for (let i = 0; i < 10000; i++) {
      const partnerId = (i % uniquePartnerIds) + 1; // 1-500 cycling
      records.push({
        id: i + 1,
        partner_id: [partnerId, `Partner ${partnerId}`],
      });
    }

    log(`Created ${records.length} mock records with ${uniquePartnerIds} unique partner_ids`);

    // Measure performance
    const startTime = performance.now();
    const dependencies = extractFkDependencies(records, fkFields);
    const endTime = performance.now();
    const duration = endTime - startTime;

    log(`Extraction completed in ${duration.toFixed(2)}ms`);

    const partnerDep = dependencies[0];
    if (!partnerDep) {
      fail(testName, 'No dependency extracted');
      return false;
    }

    if (partnerDep.unique_ids.length !== uniquePartnerIds) {
      fail(testName, `Expected ${uniquePartnerIds} unique IDs, got ${partnerDep.unique_ids.length}`);
      return false;
    }

    // Performance check: should complete in under 100ms
    if (duration > 100) {
      fail(testName, `Too slow: ${duration.toFixed(2)}ms (expected <100ms)`);
      return false;
    }

    log(`Found ${partnerDep.unique_ids.length} unique IDs, ${partnerDep.total_references} total refs`);
    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test2_6_CheckSyncedTargets(): Promise<boolean> {
  const testName = 'Test 2.6: Check Synced FK Targets';
  log(`Running ${testName}...`);

  try {
    // This test requires real Qdrant data
    // We'll check against res.partner which should have some synced records
    const targetModel = 'res.partner';
    const targetModelId = 78;

    // Test with some IDs - some may exist, some may not
    const testIds = [1, 2, 3, 99999999, 99999998]; // Last 2 unlikely to exist

    const result = await checkSyncedFkTargets(targetModel, targetModelId, testIds);

    log(`Checked ${testIds.length} IDs: ${result.synced.length} synced, ${result.missing.length} missing`);
    log(`Synced: [${result.synced.join(', ')}]`);
    log(`Missing: [${result.missing.join(', ')}]`);

    // Verify the counts add up
    if (result.synced.length + result.missing.length !== testIds.length) {
      fail(testName, 'Synced + missing count does not match input');
      return false;
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
  console.log('Phase 2: FK Dependency Discovery Tests');
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

  results.push(await test2_1_ExtractManyToOneDependencies());
  results.push(await test2_2_ExtractManyToManyDependencies());
  results.push(await test2_3_HandleNullFkValues());
  results.push(await test2_4_GetFkFieldsFromSchema());
  results.push(await test2_5_LargeIdSetPerformance());
  results.push(await test2_6_CheckSyncedTargets());

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
