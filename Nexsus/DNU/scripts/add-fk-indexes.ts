/**
 * Add FK Payload Indexes
 *
 * Creates payload indexes for FK Qdrant fields to enable efficient
 * incoming reference searches (finding records that point to a target).
 *
 * Run: npx tsx scripts/add-fk-indexes.ts
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('='.repeat(60));
console.log('Add FK Payload Indexes');
console.log('='.repeat(60));
console.log();

async function main() {
  const { QdrantClient } = await import('@qdrant/js-client-rest');

  const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  const DATA_COLLECTION = 'nexsus_data';

  // Common FK fields that need indexes for incoming traversal
  const FK_INDEX_FIELDS = [
    'partner_id_qdrant',
    'user_id_qdrant',
    'company_id_qdrant',
    'create_uid_qdrant',
    'write_uid_qdrant',
    'move_id_qdrant',
    'account_id_qdrant',
    'journal_id_qdrant',
    'stage_id_qdrant',
    'team_id_qdrant',
    'parent_id_qdrant',
    'commercial_partner_id_qdrant',
    'country_id_qdrant',
    'state_id_qdrant',
    'currency_id_qdrant',
    'analytic_account_id_qdrant',
    'product_id_qdrant',
    'product_tmpl_id_qdrant',
    'categ_id_qdrant',
    'salesperson_id_qdrant',
    'sales_team_id_qdrant',
    'campaign_id_qdrant',
    'source_id_qdrant',
    'medium_id_qdrant',
  ];

  // Initialize client
  const config: { url: string; apiKey?: string; checkCompatibility?: boolean } = {
    url: QDRANT_HOST,
    checkCompatibility: false,
  };
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);
  console.log(`Connected to: ${QDRANT_HOST}`);
  console.log(`Collection: ${DATA_COLLECTION}`);
  console.log();

  // Check collection exists
  const collections = await client.getCollections();
  const exists = collections.collections.some(c => c.name === DATA_COLLECTION);
  if (!exists) {
    console.log(`ERROR: Collection '${DATA_COLLECTION}' does not exist.`);
    return;
  }

  // Get current indexes
  const collectionInfo = await client.getCollection(DATA_COLLECTION);
  const existingIndexes = Object.keys(collectionInfo.payload_schema || {});
  console.log(`Existing payload indexes: ${existingIndexes.length}`);
  for (const idx of existingIndexes) {
    console.log(`  - ${idx}`);
  }
  console.log();

  // Add missing FK indexes
  console.log('Adding FK indexes...');
  console.log('-'.repeat(40));

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const field of FK_INDEX_FIELDS) {
    if (existingIndexes.includes(field)) {
      console.log(`  [SKIP] ${field} (already exists)`);
      skipped++;
      continue;
    }

    try {
      await client.createPayloadIndex(DATA_COLLECTION, {
        field_name: field,
        field_schema: 'keyword',  // Use keyword for UUID matching
      });
      console.log(`  [OK] ${field} (created)`);
      added++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Index might already exist or field not present
      if (msg.includes('already exists') || msg.includes('already indexed')) {
        console.log(`  [SKIP] ${field} (already indexed)`);
        skipped++;
      } else {
        console.log(`  [FAIL] ${field}: ${msg}`);
        failed++;
      }
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Added: ${added}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log();
  console.log('FK indexes are now ready for incoming traversal searches.');
}

main().catch(console.error);
