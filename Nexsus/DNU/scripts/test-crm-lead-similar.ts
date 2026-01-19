/**
 * Quick test for crm.lead similarity search
 */
import 'dotenv/config';
import { initializeVectorClient, findSimilarRecords } from '../src/services/vector-client.js';

// Known crm.lead record ID (from previous syncs)
const CRM_LEAD_MODEL_ID = 312;
const KNOWN_LEAD_ID = 12345; // Will try to find any lead

async function main() {
  console.log('Testing crm.lead similarity...');

  initializeVectorClient();

  // Build point_id for crm.lead model_id=312
  const pointId = `00000002-0312-0000-0000-000000012345`;

  try {
    const result = await findSimilarRecords(pointId, {
      limit: 5,
      minSimilarity: 0.3,
    });

    console.log(`Found ${result.similar_records.length} similar leads`);
    console.log(`Total crm.lead records: ${result.total_model_records}`);

    for (const rec of result.similar_records) {
      console.log(`  #${rec.record_id} - ${(rec.similarity_score * 100).toFixed(1)}% - ${rec.payload_summary.name || '(unnamed)'}`);
    }
  } catch (error) {
    console.log('Lead not found, trying account.move.line instead...');

    // Try account.move.line (more likely to exist)
    const amlPointId = `00000002-0390-0000-0000-000000000001`;

    try {
      const result = await findSimilarRecords(amlPointId, {
        limit: 3,
        minSimilarity: 0.3,
      });

      console.log(`Found ${result.similar_records.length} similar account.move.line records`);
      console.log(`Total AML records: ${result.total_model_records}`);
    } catch (e) {
      console.log(`Error: ${e}`);
    }
  }
}

main();
