#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv';
dotenv.config();
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_HOST!,
  apiKey: process.env.QDRANT_API_KEY,
});

async function check() {
  const collections = ['nexsus', 'nexsus_data', 'nexsus_graph'];

  for (const coll of collections) {
    try {
      const info = await qdrant.getCollection(coll);
      console.log(`\n=== ${coll}: ${info.points_count} points ===`);

      const sample = await qdrant.scroll(coll, {
        limit: 2,
        with_payload: true,
        with_vector: false,
      });

      for (const pt of sample.points) {
        const p = pt.payload as Record<string, unknown>;
        console.log(`  UUID: ${pt.id}`);
        console.log(`    point_id: ${p.point_id ?? 'MISSING'}`);
        console.log(`    point_type: ${p.point_type}`);
        console.log(`    model_name: ${p.model_name}`);
        console.log('');
      }
    } catch (e: any) {
      console.log(`\n=== ${coll}: ERROR - ${e.message} ===`);
    }
  }
}
check();
