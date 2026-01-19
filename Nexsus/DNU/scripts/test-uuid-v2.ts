/**
 * Test V2 UUID Functions
 *
 * Verifies all V2 UUID generation and parsing functions work correctly.
 * Run with: npx tsx scripts/test-uuid-v2.ts
 */

import {
  buildDataUuidV2,
  parseDataUuidV2,
  isValidDataUuidV2,
  buildSchemaUuidV2,
  buildSchemaFkRefUuidV2,
  parseSchemaUuidV2,
  parseSchemaFkRefUuidV2,
  isValidSchemaUuidV2,
  buildGraphUuidV2,
  parseGraphUuidV2,
  isValidGraphUuidV2,
  getUuidType,
  isV2Uuid,
  getRelationshipTypeCode,
  getRelationshipName,
  getOdooTtype,
} from '../src/utils/uuid-v2.js';

// ============================================================================
// TEST RUNNER
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    if (fn()) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.error(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.error(`❌ ${name} - Exception: ${error}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): boolean {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (!match && message) {
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
  }
  return match;
}

// ============================================================================
// DATA UUID TESTS
// ============================================================================

console.log('\n📦 DATA UUID TESTS');
console.log('==================');

test('T1.1: buildDataUuidV2(312, 691174)', () => {
  const result = buildDataUuidV2(312, 691174);
  return assertEqual(result, '00000002-0312-0000-0000-000000691174', 'buildDataUuidV2');
});

test('T1.2: parseDataUuidV2("00000002-0312-0000-0000-000000691174")', () => {
  const result = parseDataUuidV2('00000002-0312-0000-0000-000000691174');
  return assertEqual(result, { modelId: 312, recordId: 691174 }, 'parseDataUuidV2');
});

test('T1.3: buildDataUuidV2(344, 12345) - crm.lead', () => {
  const result = buildDataUuidV2(344, 12345);
  return assertEqual(result, '00000002-0344-0000-0000-000000012345', 'buildDataUuidV2 crm.lead');
});

test('T1.4: isValidDataUuidV2 - valid', () => {
  return isValidDataUuidV2('00000002-0312-0000-0000-000000691174') === true;
});

test('T1.5: isValidDataUuidV2 - invalid (schema UUID)', () => {
  return isValidDataUuidV2('00000003-0004-0000-0000-000000005012') === false;
});

// ============================================================================
// SCHEMA UUID TESTS
// ============================================================================

console.log('\n📋 SCHEMA UUID TESTS');
console.log('====================');

test('T2.1: buildSchemaUuidV2(5012)', () => {
  const result = buildSchemaUuidV2(5012);
  return assertEqual(result, '00000003-0004-0000-0000-000000005012', 'buildSchemaUuidV2');
});

test('T2.2: buildSchemaUuidV2(28105) - partner_id field', () => {
  const result = buildSchemaUuidV2(28105);
  return assertEqual(result, '00000003-0004-0000-0000-000000028105', 'buildSchemaUuidV2 partner_id');
});

test('T2.3: buildSchemaFkRefUuidV2(78, 1041)', () => {
  const result = buildSchemaFkRefUuidV2(78, 1041);
  return assertEqual(result, '00000003-0078-0000-0000-000000001041', 'buildSchemaFkRefUuidV2');
});

test('T2.4: parseSchemaUuidV2("00000003-0004-0000-0000-000000005012")', () => {
  const result = parseSchemaUuidV2('00000003-0004-0000-0000-000000005012');
  return assertEqual(result, { fieldId: 5012 }, 'parseSchemaUuidV2');
});

test('T2.5: parseSchemaFkRefUuidV2("00000003-0078-0000-0000-000000001041")', () => {
  const result = parseSchemaFkRefUuidV2('00000003-0078-0000-0000-000000001041');
  return assertEqual(result, { targetModelId: 78, targetFieldId: 1041 }, 'parseSchemaFkRefUuidV2');
});

test('T2.6: isValidSchemaUuidV2 - valid standard', () => {
  return isValidSchemaUuidV2('00000003-0004-0000-0000-000000005012') === true;
});

test('T2.7: isValidSchemaUuidV2 - valid FK ref', () => {
  return isValidSchemaUuidV2('00000003-0078-0000-0000-000000001041') === true;
});

// ============================================================================
// GRAPH UUID TESTS
// ============================================================================

console.log('\n🔗 GRAPH UUID TESTS');
console.log('===================');

test('T3.1: buildGraphUuidV2(312, 78, 5012, "31")', () => {
  const result = buildGraphUuidV2(312, 78, 5012, '31');
  return assertEqual(result, '00000001-0312-0078-0031-000000005012', 'buildGraphUuidV2');
});

test('T3.2: buildGraphUuidV2(344, 103, 6327, "31") - crm.lead.stage_id', () => {
  const result = buildGraphUuidV2(344, 103, 6327, '31');
  return assertEqual(result, '00000001-0344-0103-0031-000000006327', 'buildGraphUuidV2 stage_id');
});

test('T3.3: buildGraphUuidV2 with one2many (21)', () => {
  const result = buildGraphUuidV2(78, 312, 9999, '21');
  return assertEqual(result, '00000001-0078-0312-0021-000000009999', 'buildGraphUuidV2 one2many');
});

test('T3.4: buildGraphUuidV2 with many2many (41)', () => {
  const result = buildGraphUuidV2(100, 200, 12345, '41');
  return assertEqual(result, '00000001-0100-0200-0041-000000012345', 'buildGraphUuidV2 many2many');
});

test('T3.5: parseGraphUuidV2("00000001-0312-0078-0031-000000005012")', () => {
  const result = parseGraphUuidV2('00000001-0312-0078-0031-000000005012');
  return assertEqual(result, {
    sourceModelId: 312,
    targetModelId: 78,
    relationshipType: '31',
    fieldId: 5012,
  }, 'parseGraphUuidV2');
});

test('T3.6: isValidGraphUuidV2 - valid', () => {
  return isValidGraphUuidV2('00000001-0312-0078-0031-000000005012') === true;
});

test('T3.7: isValidGraphUuidV2 - invalid (data UUID)', () => {
  return isValidGraphUuidV2('00000002-0312-0000-0000-000000691174') === false;
});

// ============================================================================
// TYPE DETECTION TESTS
// ============================================================================

console.log('\n🔍 TYPE DETECTION TESTS');
console.log('=======================');

test('T4.1: getUuidType - data', () => {
  return getUuidType('00000002-0312-0000-0000-000000691174') === 'data';
});

test('T4.2: getUuidType - schema', () => {
  return getUuidType('00000003-0004-0000-0000-000000005012') === 'schema';
});

test('T4.3: getUuidType - graph', () => {
  return getUuidType('00000001-0312-0078-0031-000000005012') === 'graph';
});

test('T4.4: getUuidType - invalid', () => {
  return getUuidType('invalid-uuid') === null;
});

test('T4.5: isV2Uuid - data UUID', () => {
  return isV2Uuid('00000002-0312-0000-0000-000000691174') === true;
});

test('T4.6: isV2Uuid - invalid', () => {
  return isV2Uuid('not-a-uuid') === false;
});

// ============================================================================
// RELATIONSHIP HELPER TESTS
// ============================================================================

console.log('\n↔️ RELATIONSHIP HELPER TESTS');
console.log('============================');

test('T5.1: getRelationshipTypeCode("many2one")', () => {
  return getRelationshipTypeCode('many2one') === '31';
});

test('T5.2: getRelationshipTypeCode("one2many")', () => {
  return getRelationshipTypeCode('one2many') === '21';
});

test('T5.3: getRelationshipTypeCode("many2many")', () => {
  return getRelationshipTypeCode('many2many') === '41';
});

test('T5.4: getRelationshipTypeCode("one2one")', () => {
  return getRelationshipTypeCode('one2one') === '11';
});

test('T5.5: getRelationshipName("31")', () => {
  return getRelationshipName('31') === 'Many to One';
});

test('T5.6: getOdooTtype("31")', () => {
  return getOdooTtype('31') === 'many2one';
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

console.log('\n⚠️ ERROR HANDLING TESTS');
console.log('========================');

test('T6.1: buildDataUuidV2 throws on invalid modelId', () => {
  try {
    buildDataUuidV2(NaN, 123);
    return false;
  } catch {
    return true;
  }
});

test('T6.2: buildSchemaUuidV2 throws on invalid fieldId', () => {
  try {
    buildSchemaUuidV2(NaN);
    return false;
  } catch {
    return true;
  }
});

test('T6.3: buildGraphUuidV2 throws on invalid relationshipType', () => {
  try {
    buildGraphUuidV2(312, 78, 5012, '99');
    return false;
  } catch {
    return true;
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed! V2 UUID functions are working correctly.\n');
}
