/**
 * Create Unified Collection Script
 *
 * Stage 2: Creates the nexsus_unified collection that will hold all vectors
 * (Schema, Data, Graph) in a single semantic space.
 *
 * Run with: npx tsx scripts/create-unified-collection.ts
 *
 * This script:
 * 1. Checks if the unified collection already exists
 * 2. Creates the collection with proper configuration (1024 dims, Cosine, HNSW, scalar quantization)
 * 3. Creates all 30+ payload indexes (superset of nexsus, nexsus_data, nexsus_graph)
 * 4. Reports success/failure
 *
 * The collection uses V2 UUID format for all point IDs:
 * - 00000001-* = Graph (relationships)
 * - 00000002-* = Data (records)
 * - 00000003-* = Schema (field definitions)
 */

import 'dotenv/config';
import {
  initializeVectorClient,
  createUnifiedCollection,
  getUnifiedCollectionInfo,
  getUnifiedCollectionIndexes,
  collectionExists,
} from '../src/services/vector-client.js';

async function main(): Promise<void> {
  console.log('');
  console.log('Stage 2: Creating Unified Collection');
  console.log('====================================');
  console.log('');

  // Initialize Qdrant client
  console.log('Initializing Qdrant client...');
  const initialized = initializeVectorClient();
  if (!initialized) {
    console.error('Failed to initialize Qdrant client');
    process.exit(1);
  }

  // Check current state
  console.log('Checking current collection state...');
  const infoBefore = await getUnifiedCollectionInfo();

  if (infoBefore.exists) {
    console.log('');
    console.log(`Collection '${infoBefore.collectionName}' already exists:`);
    console.log(`  Vectors: ${infoBefore.vectorCount}`);
    console.log(`  Indexes: ${infoBefore.indexCount}`);
    console.log('');
    console.log('To recreate, first delete with:');
    console.log('  npx tsx -e "import { initializeVectorClient, deleteUnifiedCollection } from \'./src/services/vector-client.js\'; initializeVectorClient(); deleteUnifiedCollection();"');
    return;
  }

  // Verify legacy collections still exist (non-destructive check)
  console.log('');
  console.log('Verifying legacy collections (should remain untouched)...');
  const legacyCollections = ['nexsus', 'nexsus_data', 'nexsus_graph'];
  for (const name of legacyCollections) {
    const exists = await collectionExists(name);
    console.log(`  ${name}: ${exists ? 'exists' : 'NOT FOUND'}`);
  }

  // Create the unified collection
  console.log('');
  console.log('Creating unified collection...');
  const created = await createUnifiedCollection();

  if (!created) {
    console.error('');
    console.error('Failed to create unified collection');
    process.exit(1);
  }

  // Verify creation
  console.log('');
  console.log('Verifying collection...');
  const infoAfter = await getUnifiedCollectionInfo();
  const indexes = await getUnifiedCollectionIndexes();

  console.log('');
  console.log('='.repeat(50));
  console.log('UNIFIED COLLECTION CREATED SUCCESSFULLY');
  console.log('='.repeat(50));
  console.log('');
  console.log(`Collection: ${infoAfter.collectionName}`);
  console.log(`Vectors:    ${infoAfter.vectorCount} (empty, ready for Stage 3)`);
  console.log(`Indexes:    ${infoAfter.indexCount}`);
  console.log('');
  console.log('Indexes created:');
  for (const idx of indexes.sort()) {
    console.log(`  - ${idx}`);
  }
  console.log('');
  console.log('Next steps:');
  console.log('  Stage 3: Sync schema to unified collection');
  console.log('  Stage 4: Small batch data sync (10 records)');
  console.log('  Stage 5: Full cascade sync');
  console.log('');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
