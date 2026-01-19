/**
 * Add payload indexes for exact_query tool
 *
 * Creates indexes on fields used for filtering in exact queries:
 * - account_id_id (integer) - GL account filtering
 * - date (keyword) - Date range filtering
 * - parent_state (keyword) - Posted/draft filtering
 * - journal_id_id (integer) - Journal filtering
 * - partner_id_id (integer) - Partner filtering
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const DATA_COLLECTION = 'nexsus_data';

// Indexes needed for exact_query
const EXACT_QUERY_INDEXES = [
  // Account filtering (most important for GL queries)
  { field: 'account_id_id', type: 'integer' as const },

  // Date filtering (for period-based queries)
  { field: 'date', type: 'keyword' as const },

  // State filtering (posted vs draft)
  { field: 'parent_state', type: 'keyword' as const },

  // Journal filtering
  { field: 'journal_id_id', type: 'integer' as const },

  // Partner filtering
  { field: 'partner_id_id', type: 'integer' as const },

  // Move filtering
  { field: 'move_id_id', type: 'integer' as const },

  // Debit/Credit (for range filtering)
  { field: 'debit', type: 'float' as const },
  { field: 'credit', type: 'float' as const },
  { field: 'balance', type: 'float' as const },
];

async function addIndexes() {
  console.log('='.repeat(60));
  console.log('Adding Payload Indexes for exact_query');
  console.log('='.repeat(60));
  console.log('');

  // Initialize Qdrant client
  const config: { url: string; apiKey?: string; checkCompatibility?: boolean } = {
    url: QDRANT_HOST,
    checkCompatibility: false,
  };
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);
  console.log('[Init] Connected to Qdrant');
  console.log('');

  // Check collection exists
  try {
    const info = await client.getCollection(DATA_COLLECTION);
    console.log(`Collection: ${DATA_COLLECTION}`);
    console.log(`Points: ${info.points_count?.toLocaleString()}`);
    console.log('');
  } catch (error) {
    console.error(`ERROR: Collection ${DATA_COLLECTION} not found`);
    return;
  }

  // Add each index
  console.log('Creating indexes...');
  console.log('-'.repeat(50));

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const { field, type } of EXACT_QUERY_INDEXES) {
    try {
      await client.createPayloadIndex(DATA_COLLECTION, {
        field_name: field,
        field_schema: type,
        wait: true,
      });
      console.log(`  ✓ ${field} (${type})`);
      created++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already exists')) {
        console.log(`  - ${field} (${type}) - already exists`);
        skipped++;
      } else {
        console.log(`  ✗ ${field} (${type}) - ERROR: ${msg}`);
        failed++;
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('SUCCESS: All indexes ready for exact_query');
  } else {
    console.log('WARNING: Some indexes failed to create');
  }
}

addIndexes().catch(console.error);
