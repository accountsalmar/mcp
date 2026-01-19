/**
 * Check if context field is populated in Qdrant
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION = process.env.UNIFIED_COLLECTION_NAME || 'nexsus_unified';

async function main() {
  const client = new QdrantClient({
    url: QDRANT_HOST,
    apiKey: QDRANT_API_KEY,
    checkCompatibility: false
  });

  // Check actions 445 and 1717 (context-dependent "Vendor Bills")
  const contextDependentIds = [445, 1717];

  console.log('='.repeat(60));
  console.log('CONTEXT FIELD CHECK IN QDRANT');
  console.log('='.repeat(60));

  for (const actionId of contextDependentIds) {
    const result = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: 'ir.actions.act_window' } },
          { key: 'record_id', match: { value: actionId } },
        ]
      },
      with_payload: true,
      limit: 1
    });

    if (result.points.length > 0) {
      const payload = result.points[0].payload as Record<string, unknown>;
      console.log(`\nAction ${actionId}:`);
      console.log(`  name: ${payload.name}`);
      console.log(`  res_model: ${payload.res_model}`);
      console.log(`  context: ${payload.context || '(NOT SET)'}`);

      // Check if context has active_id
      const contextStr = String(payload.context || '');
      if (contextStr.includes('active_id')) {
        console.log('  → Has active_id: YES (context-dependent)');
      } else if (payload.context) {
        console.log('  → Has active_id: NO');
      }
    } else {
      console.log(`\nAction ${actionId}: NOT FOUND`);
    }
  }

  // Also check action 325 (Bills - should be safe)
  console.log('\n--- Safe action check ---');
  const result325 = await client.scroll(COLLECTION, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: 'ir.actions.act_window' } },
        { key: 'record_id', match: { value: 325 } },
      ]
    },
    with_payload: true,
    limit: 1
  });

  if (result325.points.length > 0) {
    const payload = result325.points[0].payload as Record<string, unknown>;
    console.log(`\nAction 325 (Bills):`);
    console.log(`  context: ${payload.context || '(NOT SET)'}`);
  }
}

main().catch(console.error);
