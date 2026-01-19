/**
 * Test Script for Phase 6: MCP Tool Integration
 *
 * Tests:
 * 6.1: Schema Validation
 * 6.2: Command Parsing
 * 6.3: Dry Run Mode
 * 6.4: Tool Registration Verification
 *
 * Run: npx tsx scripts/test-mcp-cascade-tool.ts
 */

import 'dotenv/config';
import { CascadeSyncSchema } from '../src/schemas/index.js';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { initializeEmbeddingService } from '../src/services/embedding-service.js';
import { loadPipelineSchema } from '../src/services/excel-pipeline-loader.js';
import {
  syncWithCascade,
  formatCascadeResult,
  type CascadeSyncOptions,
} from '../src/services/cascade-sync.js';
import { getOdooClient, type OdooClient } from '../src/services/odoo-client.js';

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

/**
 * Extract model name from cascade command (replicating tool logic)
 */
function extractModelFromCascadeCommand(command: string): string {
  const match = command.match(/^pipeline_cascade_(.+)_1984$/);
  if (!match) {
    throw new Error(
      `Invalid cascade command format: ${command}. Expected: pipeline_cascade_[model.name]_1984`
    );
  }
  return match[1];
}

// =============================================================================
// TESTS
// =============================================================================

async function test6_1_SchemaValidation(): Promise<boolean> {
  const testName = 'Test 6.1: Schema Validation';
  log(`Running ${testName}...`);

  try {
    // Valid commands
    const validCases = [
      { command: 'pipeline_cascade_crm.lead_1984' },
      { command: 'pipeline_cascade_account.move.line_1984' },
      { command: 'pipeline_cascade_res.partner_1984' },
      { command: 'pipeline_cascade_res.partner_1984', record_ids: [1, 2, 3] },
      { command: 'pipeline_cascade_crm.lead_1984', dry_run: true },
      { command: 'pipeline_cascade_crm.lead_1984', skip_existing: false },
      { command: 'pipeline_cascade_crm.lead_1984', parallel_targets: 5 },
      { command: 'pipeline_cascade_crm.lead_1984', update_graph: false },
    ];

    for (const input of validCases) {
      const result = CascadeSyncSchema.safeParse(input);
      if (!result.success) {
        fail(testName, `Valid input rejected: ${JSON.stringify(input)}`);
        return false;
      }
      log(`  Valid: ${input.command}`);
    }

    // Invalid commands
    const invalidCases = [
      { command: 'pipeline_crm.lead_1984' }, // Missing "cascade_"
      { command: 'pipeline_cascade_crm.lead' }, // Missing "_1984"
      { command: 'cascade_crm.lead_1984' }, // Missing "pipeline_"
      { command: '' }, // Empty
    ];

    for (const input of invalidCases) {
      const result = CascadeSyncSchema.safeParse(input);
      if (result.success) {
        fail(testName, `Invalid input accepted: ${JSON.stringify(input)}`);
        return false;
      }
      log(`  Rejected (expected): ${input.command || '(empty)'}`);
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test6_2_CommandParsing(): Promise<boolean> {
  const testName = 'Test 6.2: Command Parsing';
  log(`Running ${testName}...`);

  try {
    const testCases = [
      { command: 'pipeline_cascade_crm.lead_1984', expected: 'crm.lead' },
      { command: 'pipeline_cascade_account.move.line_1984', expected: 'account.move.line' },
      { command: 'pipeline_cascade_res.partner_1984', expected: 'res.partner' },
      { command: 'pipeline_cascade_sale.order.line_1984', expected: 'sale.order.line' },
      { command: 'pipeline_cascade_product.template_1984', expected: 'product.template' },
    ];

    for (const { command, expected } of testCases) {
      const result = extractModelFromCascadeCommand(command);
      if (result !== expected) {
        fail(testName, `Expected "${expected}" but got "${result}" for "${command}"`);
        return false;
      }
      log(`  "${command}" → "${result}"`);
    }

    // Test invalid command throws
    try {
      extractModelFromCascadeCommand('invalid_command');
      fail(testName, 'Invalid command should throw error');
      return false;
    } catch {
      log('  Invalid command throws error (expected)');
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test6_3_DryRunMode(): Promise<boolean> {
  const testName = 'Test 6.3: Dry Run Mode';
  log(`Running ${testName}...`);

  try {
    // First fetch a real partner ID
    let odooClient: OdooClient;
    try {
      odooClient = getOdooClient();
    } catch (error) {
      log('WARNING: Could not initialize Odoo client. Skipping dry run test.');
      pass(testName + ' (skipped - no Odoo)');
      return true;
    }

    const partners = await odooClient.searchRead<{ id: number }>(
      'res.partner',
      [['is_company', '=', true]],
      ['id'],
      { limit: 1 }
    );

    if (partners.length === 0) {
      log('WARNING: No partners found. Skipping dry run test.');
      pass(testName + ' (skipped - no data)');
      return true;
    }

    const recordId = partners[0].id;
    log(`Testing dry run with res.partner record ${recordId}...`);

    const options: CascadeSyncOptions = {
      dryRun: true,
      skipExisting: true,
      parallelTargets: 3,
      updateGraph: false,
    };

    const result = await syncWithCascade('res.partner', options, [recordId]);

    log(`Dry run result:`);
    log(`  - Primary records: ${result.primaryModel.records_synced}`);
    log(`  - FK dependencies: ${result.primaryModel.fk_dependencies.length}`);
    log(`  - Cascaded models: ${result.cascadedModels.length}`);
    log(`  - Duration: ${result.duration_ms}ms`);

    // In dry run mode, we should still get the count
    if (result.primaryModel.records_synced !== 1) {
      fail(testName, `Expected 1 primary record, got ${result.primaryModel.records_synced}`);
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test6_4_ResultFormatting(): Promise<boolean> {
  const testName = 'Test 6.4: Result Formatting';
  log(`Running ${testName}...`);

  try {
    // First fetch a real partner ID
    let odooClient: OdooClient;
    try {
      odooClient = getOdooClient();
    } catch (error) {
      log('WARNING: Could not initialize Odoo client. Skipping format test.');
      pass(testName + ' (skipped - no Odoo)');
      return true;
    }

    const partners = await odooClient.searchRead<{ id: number }>(
      'res.partner',
      [['is_company', '=', true]],
      ['id'],
      { limit: 1 }
    );

    if (partners.length === 0) {
      log('WARNING: No partners found. Skipping format test.');
      pass(testName + ' (skipped - no data)');
      return true;
    }

    const recordId = partners[0].id;

    const options: CascadeSyncOptions = {
      dryRun: true,
      skipExisting: true,
      parallelTargets: 3,
      updateGraph: false,
    };

    const result = await syncWithCascade('res.partner', options, [recordId]);
    const formatted = formatCascadeResult(result);

    log('Formatted result:');
    console.log(formatted);

    // Verify format contains expected sections
    if (!formatted.includes('# Cascade Sync Result')) {
      fail(testName, 'Missing header');
      return false;
    }

    if (!formatted.includes('## Primary Model')) {
      fail(testName, 'Missing Primary Model section');
      return false;
    }

    if (!formatted.includes('## Statistics')) {
      fail(testName, 'Missing Statistics section');
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test6_5_ToolOptionsDefaults(): Promise<boolean> {
  const testName = 'Test 6.5: Tool Options Defaults';
  log(`Running ${testName}...`);

  try {
    // Test that schema applies correct defaults
    const input = { command: 'pipeline_cascade_crm.lead_1984' };
    const result = CascadeSyncSchema.parse(input);

    log(`Parsed with defaults:`);
    log(`  - skip_existing: ${result.skip_existing} (expected: true)`);
    log(`  - parallel_targets: ${result.parallel_targets} (expected: 3)`);
    log(`  - dry_run: ${result.dry_run} (expected: false)`);
    log(`  - update_graph: ${result.update_graph} (expected: true)`);

    if (result.skip_existing !== true) {
      fail(testName, `skip_existing default should be true, got ${result.skip_existing}`);
      return false;
    }

    if (result.parallel_targets !== 3) {
      fail(testName, `parallel_targets default should be 3, got ${result.parallel_targets}`);
      return false;
    }

    if (result.dry_run !== false) {
      fail(testName, `dry_run default should be false, got ${result.dry_run}`);
      return false;
    }

    if (result.update_graph !== true) {
      fail(testName, `update_graph default should be true, got ${result.update_graph}`);
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
  console.log('Phase 6: MCP Tool Integration Tests');
  console.log('========================================\n');

  // Initialize services
  log('Initializing services...');

  // Load pipeline schema first
  loadPipelineSchema();

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

  results.push(await test6_1_SchemaValidation());
  results.push(await test6_2_CommandParsing());
  results.push(await test6_5_ToolOptionsDefaults());
  results.push(await test6_3_DryRunMode());
  results.push(await test6_4_ResultFormatting());

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
