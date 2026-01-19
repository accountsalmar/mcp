/**
 * Test UUID Format Validation Script
 *
 * Tests the enhanced vectorIdToUuid function with various inputs.
 */

import 'dotenv/config';

import { vectorIdToUuid, uuidToVectorId } from './dist/services/vector-client.js';

console.log('='.repeat(60));
console.log('TEST: UUID Format Validation (Bug 2 Fix Verification)');
console.log('='.repeat(60));
console.log();

const testCases = [
  // Valid cases
  { input: '292^5014', expected: '00000292-0000-0000-0000-000000005014', shouldPass: true, description: 'Normal case' },
  { input: '4^28105', expected: '00000004-0000-0000-0000-000000028105', shouldPass: true, description: 'Small model_id' },
  { input: '1984^1', expected: '00001984-0000-0000-0000-000000000001', shouldPass: true, description: 'Pipeline model' },
  { input: ' 292^5014 ', expected: '00000292-0000-0000-0000-000000005014', shouldPass: true, description: 'With whitespace (should trim)' },

  // Invalid cases
  { input: 'Account.account.code^5014', shouldPass: false, description: 'Model name instead of ID' },
  { input: '292', shouldPass: false, description: 'Missing ^ separator' },
  { input: '292^', shouldPass: false, description: 'Missing field_id' },
  { input: '^5014', shouldPass: false, description: 'Missing model_id' },
  { input: '', shouldPass: false, description: 'Empty string' },
  { input: null, shouldPass: false, description: 'Null input' },
  { input: undefined, shouldPass: false, description: 'Undefined input' },
  { input: 'abc^def', shouldPass: false, description: 'Non-numeric values' },
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  process.stdout.write(`  ${testCase.description}: `);

  try {
    const result = vectorIdToUuid(testCase.input);

    if (testCase.shouldPass) {
      if (result === testCase.expected) {
        console.log(`PASS ✓ → ${result}`);
        passed++;
      } else {
        console.log(`FAIL - Expected "${testCase.expected}", got "${result}"`);
        failed++;
      }
    } else {
      console.log(`FAIL - Should have thrown error, got "${result}"`);
      failed++;
    }
  } catch (err) {
    if (!testCase.shouldPass) {
      console.log(`PASS ✓ (correctly threw error)`);
      passed++;
    } else {
      console.log(`FAIL - Unexpected error: ${err.message}`);
      failed++;
    }
  }
}

console.log();
console.log('='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

// Test roundtrip conversion
console.log();
console.log('Testing roundtrip conversion:');
const testVectorId = '292^5014';
const uuid = vectorIdToUuid(testVectorId);
const backToVectorId = uuidToVectorId(uuid);
console.log(`  ${testVectorId} → ${uuid} → ${backToVectorId}`);
console.log(`  Roundtrip: ${testVectorId === backToVectorId ? 'PASS ✓' : 'FAIL'}`);
