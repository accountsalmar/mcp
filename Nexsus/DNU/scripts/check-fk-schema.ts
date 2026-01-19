/**
 * Quick script to check FK fields in schema
 */
import { loadPipelineSchema } from '../src/services/excel-pipeline-loader.js';

console.log('Loading schema...');

try {
  const schema = loadPipelineSchema();
  console.log('Total models in schema:', schema.size);

  // Find models with FK fields that have fk_location_model_id
  let totalFkFields = 0;
  let modelsWithFk = 0;
  for (const [modelName, fields] of schema) {
    const fkFields = fields.filter(f => f.fk_location_model_id && f.field_type === 'many2one');
    if (fkFields.length > 0) {
      modelsWithFk++;
      totalFkFields += fkFields.length;
    }
  }
  console.log('Models with FK metadata:', modelsWithFk);
  console.log('Total FK fields with fk_location_model_id:', totalFkFields);

  // Show crm.lead FK fields
  const crmLead = schema.get('crm.lead') || [];
  const fkCrmLead = crmLead.filter(f => f.fk_location_model_id);
  console.log('\ncrm.lead FK fields with metadata:', fkCrmLead.length);
  fkCrmLead.slice(0, 10).forEach(f =>
    console.log(`  ${f.field_name} -> ${f.fk_location_model} (model_id: ${f.fk_location_model_id})`)
  );

  // Show crm.stage FK fields
  const crmStage = schema.get('crm.stage') || [];
  const fkCrmStage = crmStage.filter(f => f.fk_location_model_id);
  console.log('\ncrm.stage FK fields with metadata:', fkCrmStage.length);
  fkCrmStage.forEach(f =>
    console.log(`  ${f.field_name} -> ${f.fk_location_model} (model_id: ${f.fk_location_model_id})`)
  );

  // Show any many2one fields without FK metadata
  const noFkMetadata = crmLead.filter(f => f.field_type === 'many2one' && !f.fk_location_model_id);
  if (noFkMetadata.length > 0) {
    console.log('\ncrm.lead many2one fields WITHOUT FK metadata:');
    noFkMetadata.slice(0, 5).forEach(f => console.log(`  ${f.field_name} (no fk_location_model_id)`));
    if (noFkMetadata.length > 5) {
      console.log(`  ... and ${noFkMetadata.length - 5} more`);
    }
  }

} catch (error) {
  console.error('Error:', error);
}
