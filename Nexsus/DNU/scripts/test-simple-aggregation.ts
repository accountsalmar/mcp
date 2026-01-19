/**
 * Simple test: Aggregate account 319 without date filter
 */

import 'dotenv/config';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { buildQdrantFilter } from '../src/services/filter-builder.js';
import { executeAggregation } from '../src/services/aggregation-engine.js';
import type { FilterCondition, Aggregation } from '../src/types.js';

async function testSimple() {
  console.log('Testing aggregation for account 319 (no date filter)');
  console.log('='.repeat(60));

  // Initialize
  initializeVectorClient();

  // Simple filter - just account_id_id and parent_state
  const filters: FilterCondition[] = [
    { field: 'account_id_id', op: 'eq', value: 319 },
    { field: 'parent_state', op: 'eq', value: 'posted' }
  ];

  const qdrantFilter = buildQdrantFilter('account.move.line', filters);
  console.log('Filter:', JSON.stringify(qdrantFilter, null, 2));

  const aggregations: Aggregation[] = [
    { field: 'debit', op: 'sum', alias: 'total_debit' },
    { field: 'balance', op: 'sum', alias: 'net_balance' },
    { field: 'id', op: 'count', alias: 'line_count' }
  ];

  console.log('\nRunning aggregation...');
  const startTime = Date.now();

  try {
    const result = await executeAggregation(qdrantFilter, aggregations);
    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`Records: ${result.totalRecords.toLocaleString()}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Truncated: ${result.truncated}`);
    console.log('');
    for (const [alias, value] of Object.entries(result.results)) {
      const formatted = typeof value === 'number' && !Number.isInteger(value)
        ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : value.toLocaleString();
      console.log(`  ${alias}: ${formatted}`);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

testSimple().catch(console.error);
