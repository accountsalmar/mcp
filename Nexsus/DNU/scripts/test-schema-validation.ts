/**
 * Test Schema Validation for exact_query
 *
 * Tests that the schema validation catches field errors with helpful messages.
 */

import {
  initializeSchemaLookup,
  isSchemaLookupInitialized,
  validateExactQuery,
  formatValidationErrors,
  getFieldInfo,
  findSimilarFields,
  getModelFields
} from '../src/services/schema-lookup.js';

console.log('='.repeat(60));
console.log('Testing Schema Validation');
console.log('='.repeat(60));
console.log('');

// Initialize schema lookup
console.log('1. Initializing schema lookup...');
initializeSchemaLookup();
console.log(`   Initialized: ${isSchemaLookupInitialized()}`);
console.log('');

// Test 1: Get model fields
console.log('2. Testing getModelFields("account.move.line")...');
const fields = getModelFields('account.move.line');
console.log(`   Found ${fields.length} fields`);
console.log(`   Sample fields: ${fields.slice(0, 5).map(f => f.field_name).join(', ')}`);
console.log('');

// Test 2: Get field info
console.log('3. Testing getFieldInfo("account.move.line", "debit")...');
const debitInfo = getFieldInfo('account.move.line', 'debit');
if (debitInfo) {
  console.log(`   Field: ${debitInfo.field_name}`);
  console.log(`   Type: ${debitInfo.field_type}`);
  console.log(`   Label: ${debitInfo.field_label}`);
  console.log(`   Stored: ${debitInfo.stored}`);
} else {
  console.log('   ERROR: Field not found!');
}
console.log('');

// Test 3: Find similar fields (typo test)
console.log('4. Testing findSimilarFields("account.move.line", "acount_id")...');
const similar = findSimilarFields('account.move.line', 'acount_id');
console.log(`   Suggestions: ${similar.join(', ')}`);
console.log('');

// Test 4: Valid query
console.log('5. Testing valid query validation...');
const validResult = validateExactQuery(
  'account.move.line',
  [
    { field: 'account_id_id', op: 'eq', value: 319 },
    { field: 'date', op: 'gte', value: '2025-03-01' },
    { field: 'parent_state', op: 'eq', value: 'posted' }
  ],
  [
    { field: 'debit', op: 'sum', alias: 'total_debit' },
    { field: 'id', op: 'count', alias: 'record_count' }
  ]
);
console.log(`   Valid: ${validResult.isValid}`);
console.log(`   Errors: ${validResult.errors.length}`);
console.log(`   Warnings: ${validResult.warnings.length}`);
console.log('');

// Test 5: Invalid field name
console.log('6. Testing invalid field name...');
const invalidFieldResult = validateExactQuery(
  'account.move.line',
  [
    { field: 'invalid_field_xyz', op: 'eq', value: 123 }
  ]
);
console.log(`   Valid: ${invalidFieldResult.isValid}`);
console.log(`   Errors: ${invalidFieldResult.errors.length}`);
if (invalidFieldResult.errors.length > 0) {
  console.log(`   Error message: ${invalidFieldResult.errors[0].message}`);
  if (invalidFieldResult.errors[0].suggestion) {
    console.log(`   Suggestion: ${invalidFieldResult.errors[0].suggestion}`);
  }
}
console.log('');

// Test 6: Invalid aggregation type
console.log('7. Testing SUM on char field...');
const invalidAggResult = validateExactQuery(
  'account.move.line',
  [{ field: 'account_id_id', op: 'eq', value: 319 }],
  [{ field: 'name', op: 'sum', alias: 'bad_sum' }]
);
console.log(`   Valid: ${invalidAggResult.isValid}`);
if (invalidAggResult.errors.length > 0) {
  console.log(`   Error: ${invalidAggResult.errors[0].message}`);
}
console.log('');

// Test 7: Invalid model
console.log('8. Testing invalid model name...');
const invalidModelResult = validateExactQuery(
  'invalid.model.xyz',
  [{ field: 'id', op: 'eq', value: 1 }]
);
console.log(`   Valid: ${invalidModelResult.isValid}`);
if (invalidModelResult.errors.length > 0) {
  console.log(`   Error: ${invalidModelResult.errors[0].message}`);
  if (invalidModelResult.errors[0].suggestion) {
    console.log(`   Suggestion: ${invalidModelResult.errors[0].suggestion}`);
  }
}
console.log('');

// Test 8: Format validation errors
console.log('9. Testing error formatting...');
const formattedErrors = formatValidationErrors(invalidFieldResult.errors, invalidFieldResult.warnings);
console.log('--- Formatted Output ---');
console.log(formattedErrors);
console.log('--- End Formatted Output ---');

console.log('');
console.log('='.repeat(60));
console.log('Schema Validation Tests Complete');
console.log('='.repeat(60));
