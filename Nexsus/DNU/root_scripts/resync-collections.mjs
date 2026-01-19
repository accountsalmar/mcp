/**
 * Re-sync collections with UUID format
 *
 * This script:
 * 1. Deletes existing nexsus and nexsus_data collections
 * 2. Re-syncs the schema collection with UUID format for Qdrant point IDs
 * 3. Re-syncs the data collection with UUID format
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantHost = process.env.QDRANT_HOST || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY;

const client = new QdrantClient({
  url: qdrantHost,
  apiKey: qdrantApiKey,
});

console.log('='.repeat(60));
console.log('Re-syncing Collections with UUID Format');
console.log('='.repeat(60));
console.log('');

// Delete collections
async function deleteCollection(name) {
  try {
    await client.deleteCollection(name);
    console.log(`Deleted collection: ${name}`);
    return true;
  } catch (error) {
    console.log(`Collection ${name} does not exist or already deleted`);
    return false;
  }
}

// Main
try {
  // Step 1: Delete existing collections
  console.log('Step 1: Deleting existing collections...');
  await deleteCollection('nexsus');
  await deleteCollection('nexsus_data');
  console.log('');

  console.log('Step 2: Collections deleted. Now run the sync commands:');
  console.log('');
  console.log('  For schema sync (via MCP tool):');
  console.log('    nexsus_sync_1984');
  console.log('');
  console.log('  For data sync (via MCP tool):');
  console.log('    pipeline_account.account_1984');
  console.log('');
  console.log('Or use the test-sync.mjs script:');
  console.log('  node test-sync.mjs account.account 10');
  console.log('');

} catch (error) {
  console.error('Error:', error.message);
}

console.log('='.repeat(60));
