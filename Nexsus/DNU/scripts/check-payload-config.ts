/**
 * Check payload configuration for URL builder related models
 */

import 'dotenv/config';
import XLSX from 'xlsx';

const wb = XLSX.readFile('feilds_to_add_payload.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];

// Models we need for URL builder
const targetModels = [
  'ir.actions.act_window',
  'ir.actions.client',
  'ir.actions.report.xml',
  'ir.ui.menu'
];

// Required fields for URL builder
const requiredFields: Record<string, string[]> = {
  'ir.actions.act_window': ['name', 'res_model', 'view_mode', 'target', 'context'],
  'ir.actions.client': ['name', 'tag', 'context', 'params'],
  'ir.ui.menu': ['name', 'action', 'parent_id', 'complete_name'],
  'ir.actions.report.xml': ['name', 'model', 'report_name', 'report_type']
};

console.log('='.repeat(60));
console.log('URL BUILDER PAYLOAD CONFIGURATION CHECK');
console.log('='.repeat(60));

for (const model of targetModels) {
  console.log(`\n## ${model}`);

  const modelRows = rows.filter(r => r.Model_Name === model);

  if (modelRows.length === 0) {
    console.log('  ⚠️  MODEL NOT IN PAYLOAD CONFIG - Need to add fields!');
    console.log(`  Required fields: ${requiredFields[model].join(', ')}`);
    continue;
  }

  console.log(`  Total fields: ${modelRows.length}`);

  const payloadFields = modelRows.filter(r => r.payload === true || r.payload === 1);
  console.log(`  Payload=1 fields: ${payloadFields.length}`);

  if (payloadFields.length > 0) {
    console.log('  Fields with payload=1:');
    payloadFields.forEach(r => console.log(`    ✓ ${r.Field_Name}`));
  }

  // Check required fields
  const missingRequired = requiredFields[model].filter(
    f => !payloadFields.some(r => r.Field_Name === f)
  );

  if (missingRequired.length > 0) {
    console.log('  Missing required fields:');
    missingRequired.forEach(f => console.log(`    ✗ ${f}`));
  }
}

// Also check if context field exists for ir.actions.act_window
console.log('\n' + '='.repeat(60));
console.log('CONTEXT FIELD CHECK');
console.log('='.repeat(60));

const contextField = rows.find(
  r => r.Model_Name === 'ir.actions.act_window' && r.Field_Name === 'context'
);

if (contextField) {
  console.log('ir.actions.act_window.context:');
  console.log(`  Field_ID: ${contextField.Field_ID}`);
  console.log(`  payload: ${contextField.payload}`);
} else {
  console.log('ir.actions.act_window.context: NOT FOUND IN EXCEL');
}
