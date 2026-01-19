/**
 * Test script for pipeline preview
 * Usage: node test-pipeline.mjs [model_name]
 */

import 'dotenv/config';
import {
  getModelConfig,
  getPayloadFields,
  getOdooFieldNames,
  modelExists,
  getAllModelNames,
  getPipelineStats,
} from './dist/services/excel-pipeline-loader.js';
import { previewPipelineTransform } from './dist/services/pipeline-data-sync.js';

const modelName = process.argv[2] || 'account.account';

console.log('='.repeat(60));
console.log(`Testing Pipeline for: ${modelName}`);
console.log('='.repeat(60));
console.log('');

// Check if model exists
const exists = modelExists(modelName);
console.log('Model exists in schema:', exists);

if (exists) {
  // Get model config
  const config = getModelConfig(modelName);
  console.log('\n--- Model Configuration ---');
  console.log('  Model ID:', config.model_id);
  console.log('  Primary Key Field ID:', config.primary_key_field_id);
  console.log('  Total Fields:', config.total_fields);
  console.log('  Payload Fields:', config.payload_field_count);

  // Get payload fields
  const payloadFields = getPayloadFields(modelName);
  console.log('\n--- Payload Fields (' + payloadFields.length + ') ---');
  payloadFields.forEach(f => {
    console.log(`  - ${f.field_name} (${f.field_type})${f.fk_location_model ? ' -> FK: ' + f.fk_location_model : ''}`);
  });

  // Get Odoo fields to fetch
  const odooFields = getOdooFieldNames(modelName);
  console.log('\n--- Odoo Fields to Fetch (' + odooFields.length + ') ---');
  console.log('Fields:', odooFields.join(', '));

  // Preview transformation
  console.log('\n--- Preview Transformation ---');
  const preview = previewPipelineTransform(modelName);
  if (preview.valid) {
    console.log('Vector_Id Format:', preview.model_config.model_id + '^[record_id]');
    console.log('Example:', preview.model_config.model_id + '^12345');
    console.log('\nTo sync this model, use command:');
    console.log(`  pipeline_${modelName}_1984`);
  } else {
    console.log('Validation errors:', preview.errors.join(', '));
  }

} else {
  console.log('\nModel not found in schema.');
  console.log('\n--- Available models containing "account" ---');
  const allModels = getAllModelNames();
  const accountModels = allModels.filter(m => m.includes('account'));
  accountModels.forEach(m => console.log('  -', m));

  console.log('\n--- Schema Statistics ---');
  const stats = getPipelineStats();
  console.log('Total Models:', stats.totalModels);
  console.log('Total Fields:', stats.totalFields);
  console.log('Payload Fields:', stats.payloadFields);
}

console.log('\n' + '='.repeat(60));
