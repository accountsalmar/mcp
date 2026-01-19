/**
 * Delete nexsus_data collection script
 *
 * Run: node delete-pipeline-data.mjs
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const COLLECTION_NAME = 'nexsus_data';

async function deleteCollection() {
  const host = process.env.QDRANT_HOST || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY;

  console.log(`Connecting to Qdrant at ${host}...`);

  const client = new QdrantClient({
    url: host,
    apiKey: apiKey || undefined,
  });

  try {
    // Check if collection exists
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(`Collection '${COLLECTION_NAME}' does not exist. Nothing to delete.`);
      return;
    }

    // Get collection info before deleting
    const info = await client.getCollection(COLLECTION_NAME);
    console.log(`Collection '${COLLECTION_NAME}' has ${info.points_count} vectors.`);

    // Delete collection
    await client.deleteCollection(COLLECTION_NAME);
    console.log(`Successfully deleted collection '${COLLECTION_NAME}'`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

deleteCollection();
