/**
 * Test script for exact_query tool
 *
 * Tests the aggregation query for GL account 319 in March 2025
 */

import 'dotenv/config';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { buildQdrantFilter, validateFilters } from '../src/services/filter-builder.js';
import { executeAggregation } from '../src/services/aggregation-engine.js';
import { scrollRecords } from '../src/services/scroll-engine.js';
import type { FilterCondition, Aggregation } from '../src/types.js';

async function testExactQuery() {
  console.log('='.repeat(60));
  console.log('Testing exact_query for GL Account 319 - March 2025');
  console.log('='.repeat(60));
  console.log('');

  // Initialize vector client
  console.log('1. Initializing vector client...');
  const initialized = initializeVectorClient();
  if (!initialized) {
    console.error('Failed to initialize vector client. Check QDRANT_HOST.');
    process.exit(1);
  }
  console.log('   ✓ Vector client ready');
  console.log('');

  // Define filters for GL account 319, March 2025, posted entries
  const filters: FilterCondition[] = [
    { field: 'account_id_id', op: 'eq', value: 319 },
    { field: 'date', op: 'gte', value: '2025-03-01' },
    { field: 'date', op: 'lte', value: '2025-03-31' },
    { field: 'parent_state', op: 'eq', value: 'posted' }
  ];

  // Validate filters
  console.log('2. Validating filters...');
  const validation = validateFilters(filters);
  if (!validation.isValid) {
    console.error('Filter validation failed:', validation.errors);
    process.exit(1);
  }
  console.log('   ✓ Filters valid');
  console.log('   Filters:');
  for (const f of filters) {
    console.log(`     - ${f.field} ${f.op} ${JSON.stringify(f.value)}`);
  }
  console.log('');

  // Build Qdrant filter
  console.log('3. Building Qdrant filter...');
  const { qdrantFilter, appFilters } = buildQdrantFilter('account.move.line', filters);
  console.log('   ✓ Filter built');
  console.log('   Qdrant filter:', JSON.stringify(qdrantFilter, null, 2));
  if (appFilters.length > 0) {
    console.log('   App-level filters:', JSON.stringify(appFilters, null, 2));
  }
  console.log('');

  // Define aggregations (note: credit field doesn't exist in payload, use balance instead)
  const aggregations: Aggregation[] = [
    { field: 'debit', op: 'sum', alias: 'total_debit' },
    { field: 'balance', op: 'sum', alias: 'net_balance' },
    { field: 'id', op: 'count', alias: 'line_count' }
  ];

  console.log('4. Running aggregation query...');
  console.log('   Aggregations:');
  for (const agg of aggregations) {
    console.log(`     - ${agg.op.toUpperCase()}(${agg.field}) AS ${agg.alias}`);
  }
  console.log('');

  const startTime = Date.now();

  try {
    const result = await executeAggregation(
      qdrantFilter,
      aggregations,
      undefined, // groupBy
      100000,    // maxRecords
      appFilters.length > 0 ? appFilters : undefined
    );
    const duration = Date.now() - startTime;

    console.log('='.repeat(60));
    console.log('RESULTS - GL Account 319, March 2025');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Records Processed: ${result.totalRecords.toLocaleString()}`);
    console.log(`Query Time: ${duration}ms`);
    console.log(`Truncated: ${result.truncated}`);
    console.log('');
    console.log('Aggregation Results:');
    console.log('-'.repeat(40));

    for (const [alias, value] of Object.entries(result.results)) {
      const formatted = typeof value === 'number' && !Number.isInteger(value)
        ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : value.toLocaleString();
      console.log(`  ${alias}: ${formatted}`);
    }

    console.log('');
    console.log('='.repeat(60));

    // Also test record retrieval (first 5 records)
    console.log('');
    console.log('5. Testing record retrieval (first 5 records)...');
    const recordResult = await scrollRecords(qdrantFilter, {
      limit: 5,
      appFilters: appFilters.length > 0 ? appFilters : undefined
    });

    console.log(`   Retrieved: ${recordResult.records.length} records`);
    console.log(`   Has more: ${recordResult.hasMore}`);
    console.log('');

    if (recordResult.records.length > 0) {
      console.log('Sample record:');
      console.log(JSON.stringify(recordResult.records[0], null, 2));
    }

  } catch (error) {
    console.error('Query failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testExactQuery().catch(console.error);
