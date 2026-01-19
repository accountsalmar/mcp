#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv';
dotenv.config();
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_HOST!,
  apiKey: process.env.QDRANT_API_KEY,
});

async function createIndexes() {
  console.log('Creating indexes on nexsus_unified...\n');

  try {
    await qdrant.createPayloadIndex('nexsus_unified', {
      field_name: 'point_id',
      field_schema: 'keyword',
    });
    console.log('✓ point_id keyword index created');
  } catch (e: any) {
    console.log('point_id keyword:', e.data?.status?.error || e.message);
  }

  try {
    await qdrant.createPayloadIndex('nexsus_unified', {
      field_name: 'point_id',
      field_schema: 'text',
    });
    console.log('✓ point_id text index created');
  } catch (e: any) {
    console.log('point_id text:', e.data?.status?.error || e.message);
  }

  try {
    await qdrant.createPayloadIndex('nexsus_unified', {
      field_name: 'point_type',
      field_schema: 'keyword',
    });
    console.log('✓ point_type index created');
  } catch (e: any) {
    console.log('point_type:', e.data?.status?.error || e.message);
  }

  try {
    await qdrant.createPayloadIndex('nexsus_unified', {
      field_name: 'sync_timestamp',
      field_schema: 'keyword',
    });
    console.log('✓ sync_timestamp index created');
  } catch (e: any) {
    console.log('sync_timestamp:', e.data?.status?.error || e.message);
  }

  console.log('\nDone!');
}
createIndexes();
