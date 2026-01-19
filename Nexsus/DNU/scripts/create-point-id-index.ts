#!/usr/bin/env npx tsx
/**
 * Create index on point_id field for efficient querying
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { QdrantClient } from '@qdrant/js-client-rest';

async function main() {
  const qdrantHost = process.env.QDRANT_HOST || 'http://localhost:6333';
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  console.log(`Qdrant Host: ${qdrantHost}\n`);

  const qdrant = new QdrantClient({
    url: qdrantHost,
    apiKey: qdrantApiKey,
  });

  const collections = ['nexsus_data', 'nexsus', 'nexsus_graph'];

  for (const collection of collections) {
    console.log(`\n--- Creating indexes for ${collection} ---`);

    try {
      // Check if collection exists
      const info = await qdrant.getCollection(collection);
      console.log(`Collection ${collection}: ${info.points_count} points`);

      // Create index on point_id (keyword type for exact match and text match)
      console.log(`Creating index on point_id...`);
      await qdrant.createPayloadIndex(collection, {
        field_name: 'point_id',
        field_schema: 'keyword',
      });
      console.log(`✓ point_id index created`);

      // Create index on point_type
      console.log(`Creating index on point_type...`);
      await qdrant.createPayloadIndex(collection, {
        field_name: 'point_type',
        field_schema: 'keyword',
      });
      console.log(`✓ point_type index created`);

      // Create index on sync_timestamp
      console.log(`Creating index on sync_timestamp...`);
      await qdrant.createPayloadIndex(collection, {
        field_name: 'sync_timestamp',
        field_schema: 'keyword',
      });
      console.log(`✓ sync_timestamp index created`);

    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`Index already exists, skipping...`);
      } else if (error.data?.status?.error?.includes('already exists')) {
        console.log(`Index already exists, skipping...`);
      } else if (error.status === 404) {
        console.log(`Collection ${collection} not found, skipping...`);
      } else {
        console.error(`Error for ${collection}:`, error.data?.status || error.message);
      }
    }
  }

  console.log('\n--- Index creation complete ---\n');
}

main();
