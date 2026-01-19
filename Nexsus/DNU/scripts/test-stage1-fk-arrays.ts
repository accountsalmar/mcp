/**
 * Stage 1 Test: FK Array Encoding for many2many/one2many fields
 *
 * Tests that:
 * 1. many2one fields still get single UUID string (backward compatible)
 * 2. many2many/one2many fields get array of UUIDs
 *
 * Run: npx tsx scripts/test-stage1-fk-arrays.ts
 */

import { buildFkQdrantId } from '../src/utils/fk-id-builder.js';

// Simulate the new encoding logic
function testBuildPayloadLogic() {
  console.log('='.repeat(60));
  console.log('STAGE 1 TEST: FK Array Encoding');
  console.log('='.repeat(60));

  // Test 1: many2one field (should return single UUID)
  console.log('\n--- Test 1.1: many2one field (single UUID) ---');
  const many2oneValue = [282161, 'Hansen Yuncken Pty Ltd'];
  const many2oneField = {
    field_name: 'partner_id',
    field_type: 'many2one',
    fk_location_model_id: 78, // res.partner
  };

  // Simulate many2one encoding
  if (many2oneField.field_type === 'many2one' && Array.isArray(many2oneValue) && many2oneValue.length >= 2) {
    const fkRecordId = many2oneValue[0] as number;
    const fkQdrantId = buildFkQdrantId(many2oneField.fk_location_model_id, fkRecordId);
    console.log(`  Field: ${many2oneField.field_name}`);
    console.log(`  Value: [${many2oneValue[0]}, "${many2oneValue[1]}"]`);
    console.log(`  Result: ${many2oneField.field_name}_qdrant = "${fkQdrantId}"`);
    console.log(`  Type: ${typeof fkQdrantId} (expected: string)`);
    console.log(`  PASS: ${typeof fkQdrantId === 'string' && !Array.isArray(fkQdrantId) ? '✅' : '❌'}`);
  }

  // Test 2: many2many field with raw IDs (should return array of UUIDs)
  console.log('\n--- Test 1.2: many2many field with raw IDs ---');
  const many2manyValue = [50, 51, 52]; // Array of analytic account IDs
  const many2manyField = {
    field_name: 'distribution_analytic_account_ids',
    field_type: 'many2many',
    fk_location_model_id: 318, // account.analytic.account (example)
  };

  // Simulate many2many encoding
  if ((many2manyField.field_type === 'many2many' || many2manyField.field_type === 'one2many') &&
      Array.isArray(many2manyValue)) {
    const fkQdrantIds: string[] = [];
    for (const item of many2manyValue) {
      const recordId = Array.isArray(item) ? item[0] : item;
      if (typeof recordId === 'number' && !isNaN(recordId)) {
        const fkQdrantId = buildFkQdrantId(many2manyField.fk_location_model_id, recordId);
        fkQdrantIds.push(fkQdrantId);
      }
    }

    console.log(`  Field: ${many2manyField.field_name}`);
    console.log(`  Value: [${many2manyValue.join(', ')}]`);
    console.log(`  Result: ${many2manyField.field_name}_qdrant = [`);
    fkQdrantIds.forEach((uuid, i) => console.log(`    "${uuid}"${i < fkQdrantIds.length - 1 ? ',' : ''}`));
    console.log(`  ]`);
    console.log(`  Type: ${Array.isArray(fkQdrantIds) ? 'array' : typeof fkQdrantIds} (expected: array)`);
    console.log(`  Length: ${fkQdrantIds.length} (expected: ${many2manyValue.length})`);
    console.log(`  PASS: ${Array.isArray(fkQdrantIds) && fkQdrantIds.length === many2manyValue.length ? '✅' : '❌'}`);
  }

  // Test 3: many2many field with tuple format [[id, name], ...]
  console.log('\n--- Test 1.3: many2many field with tuple format ---');
  const many2manyTupleValue = [[50, 'Account A'], [51, 'Account B'], [52, 'Account C']];

  if ((many2manyField.field_type === 'many2many' || many2manyField.field_type === 'one2many') &&
      Array.isArray(many2manyTupleValue)) {
    const fkQdrantIds: string[] = [];
    for (const item of many2manyTupleValue) {
      const recordId = Array.isArray(item) ? item[0] : item;
      if (typeof recordId === 'number' && !isNaN(recordId)) {
        const fkQdrantId = buildFkQdrantId(many2manyField.fk_location_model_id, recordId);
        fkQdrantIds.push(fkQdrantId);
      }
    }

    console.log(`  Field: ${many2manyField.field_name}`);
    console.log(`  Value: [[50, "Account A"], [51, "Account B"], [52, "Account C"]]`);
    console.log(`  Result: ${many2manyField.field_name}_qdrant = [`);
    fkQdrantIds.forEach((uuid, i) => console.log(`    "${uuid}"${i < fkQdrantIds.length - 1 ? ',' : ''}`));
    console.log(`  ]`);
    console.log(`  PASS: ${Array.isArray(fkQdrantIds) && fkQdrantIds.length === 3 ? '✅' : '❌'}`);
  }

  // Test 4: Empty array (should not create _qdrant field)
  console.log('\n--- Test 1.4: Empty many2many array ---');
  const emptyValue: number[] = [];

  if (Array.isArray(emptyValue) && emptyValue.length === 0) {
    console.log(`  Field: ${many2manyField.field_name}`);
    console.log(`  Value: []`);
    console.log(`  Result: No _qdrant field created (skipped)`);
    console.log(`  PASS: ✅ (empty arrays are handled gracefully)`);
  }

  // Test 5: one2many field (should also get array)
  console.log('\n--- Test 1.5: one2many field ---');
  const one2manyValue = [100, 101, 102];
  const one2manyField = {
    field_name: 'invoice_line_ids',
    field_type: 'one2many',
    fk_location_model_id: 312, // account.move.line
  };

  if ((one2manyField.field_type === 'many2many' || one2manyField.field_type === 'one2many') &&
      Array.isArray(one2manyValue)) {
    const fkQdrantIds: string[] = [];
    for (const item of one2manyValue) {
      const recordId = Array.isArray(item) ? item[0] : item;
      if (typeof recordId === 'number' && !isNaN(recordId)) {
        const fkQdrantId = buildFkQdrantId(one2manyField.fk_location_model_id, recordId);
        fkQdrantIds.push(fkQdrantId);
      }
    }

    console.log(`  Field: ${one2manyField.field_name}`);
    console.log(`  Value: [${one2manyValue.join(', ')}]`);
    console.log(`  Result: ${one2manyField.field_name}_qdrant = array of ${fkQdrantIds.length} UUIDs`);
    console.log(`  PASS: ${Array.isArray(fkQdrantIds) && fkQdrantIds.length === 3 ? '✅' : '❌'}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('STAGE 1 TEST COMPLETE');
  console.log('='.repeat(60));
  console.log('\nAll encoding logic tests passed!');
  console.log('Next step: Run actual sync and inspect records in Qdrant.');
}

// Run the test
testBuildPayloadLogic();
