#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv';
dotenv.config();
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_HOST!,
  apiKey: process.env.QDRANT_API_KEY,
});

async function check() {
  // List all collections
  const collections = await qdrant.getCollections();
  console.log('All collections:');
  for (const c of collections.collections) {
    const info = await qdrant.getCollection(c.name);
    console.log(`  - ${c.name}: ${info.points_count} points`);
  }

  // Check each collection for point_id
  console.log('\n--- Checking for point_id field ---\n');
  for (const c of collections.collections) {
    try {
      const sample = await qdrant.scroll(c.name, {
        limit: 1,
        with_payload: true,
        with_vector: false,
      });

      if (sample.points.length > 0) {
        const p = sample.points[0].payload as Record<string, unknown>;
        const hasPointId = p.point_id !== undefined;
        console.log(`${c.name}: point_id = ${hasPointId ? p.point_id : 'MISSING'}`);
      }
    } catch (e) {
      console.log(`${c.name}: ERROR`);
    }
  }
}
check();
