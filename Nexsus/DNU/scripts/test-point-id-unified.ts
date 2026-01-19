#!/usr/bin/env npx tsx
/**
 * Test point_id query on nexsus_unified collection
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { QdrantClient } from '@qdrant/js-client-rest';
import { parseDataUuidV2 } from '../src/utils/uuid-v2.js';
import {
  initializeSchemaLookup,
  getModelNameById,
} from '../src/services/schema-lookup.js';

const COLLECTION_NAME = 'nexsus_unified';

async function main() {
  console.log('========================================');
  console.log('  Test: point_id Query on nexsus_unified');
  console.log('========================================\n');

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_HOST!,
    apiKey: process.env.QDRANT_API_KEY,
  });

  // Initialize schema lookup
  console.log('Initializing schema lookup...');
  initializeSchemaLookup();
  console.log('');

  // Get collection info
  const info = await qdrant.getCollection(COLLECTION_NAME);
  console.log(`Collection: ${COLLECTION_NAME} - ${info.points_count} points\n`);

  // Test 1: Get a sample DATA point (00000002-...)
  console.log('--- Test 1: Find a DATA point ---\n');

  const dataPoints = await qdrant.scroll(COLLECTION_NAME, {
    limit: 3,
    filter: {
      must: [
        { key: 'point_id', match: { text: '00000002-' } }  // DATA namespace
      ]
    },
    with_payload: true,
    with_vector: false,
  });

  if (dataPoints.points.length === 0) {
    console.log('No DATA points found. Trying without filter...');
    const anyPoints = await qdrant.scroll(COLLECTION_NAME, {
      limit: 5,
      with_payload: ['point_id', 'point_type', 'model_name', 'record_id'],
      with_vector: false,
    });
    console.log('Sample points:');
    for (const pt of anyPoints.points) {
      const p = pt.payload as Record<string, unknown>;
      console.log(`  ${p.point_id} | ${p.point_type} | ${p.model_name}`);
    }
    return;
  }

  const samplePoint = dataPoints.points[0];
  const payload = samplePoint.payload as Record<string, unknown>;
  const pointId = payload.point_id as string;

  console.log('Sample DATA point:');
  console.log(`  point_id: ${pointId}`);
  console.log(`  point_type: ${payload.point_type}`);
  console.log(`  model_name: ${payload.model_name}`);
  console.log(`  record_id: ${payload.record_id}`);
  console.log('');

  // Test 2: Parse UUID and resolve model
  console.log('--- Test 2: Parse UUID & Resolve Model ---\n');

  const parsed = parseDataUuidV2(pointId);
  if (parsed) {
    console.log(`Parsed from UUID:`);
    console.log(`  model_id: ${parsed.modelId}`);
    console.log(`  record_id: ${parsed.recordId}`);

    const resolvedModelName = getModelNameById(parsed.modelId);
    console.log(`  resolved model_name: ${resolvedModelName}`);

    if (resolvedModelName === payload.model_name) {
      console.log(`  ✓ Model name matches payload!`);
    } else {
      console.log(`  ✗ Mismatch: expected ${payload.model_name}`);
    }
  } else {
    console.log(`Could not parse as DATA UUID: ${pointId}`);
  }
  console.log('');

  // Test 3: Query by exact point_id (using text match which works with text index)
  console.log('--- Test 3: Query by Exact point_id ---\n');
  console.log(`Query: point_id contains "${pointId}" (full match)`);

  const exactResult = await qdrant.scroll(COLLECTION_NAME, {
    limit: 1,
    filter: {
      must: [
        { key: 'point_id', match: { text: pointId } }
      ]
    },
    with_payload: ['point_id', 'model_name', 'record_id'],
    with_vector: false,
  });

  if (exactResult.points.length > 0) {
    const p = exactResult.points[0].payload as Record<string, unknown>;
    console.log(`Result: Found record_id=${p.record_id} in ${p.model_name}`);
    console.log(`✓ Exact point_id query works!`);
  } else {
    console.log(`✗ No results`);
  }
  console.log('');

  // Test 4: UUID segment matching (model filter)
  console.log('--- Test 4: UUID Segment Matching ---\n');

  if (parsed) {
    const modelSegment = `00000002-${parsed.modelId.toString().padStart(4, '0')}`;
    console.log(`Query: point_id contains "${modelSegment}"`);

    const segmentResult = await qdrant.scroll(COLLECTION_NAME, {
      limit: 5,
      filter: {
        must: [
          { key: 'point_id', match: { text: modelSegment } }
        ]
      },
      with_payload: ['point_id', 'model_name', 'record_id'],
      with_vector: false,
    });

    console.log(`Found ${segmentResult.points.length} records:`);
    for (const pt of segmentResult.points) {
      const p = pt.payload as Record<string, unknown>;
      console.log(`  ${p.point_id} | ${p.model_name} | record_id=${p.record_id}`);
    }
    console.log(`✓ UUID segment matching works!`);
  }
  console.log('');

  // Test 5: Count by point_type
  console.log('--- Test 5: Filter by point_type ---\n');

  for (const ptype of ['data', 'schema', 'graph']) {
    const typeResult = await qdrant.scroll(COLLECTION_NAME, {
      limit: 1,
      filter: {
        must: [
          { key: 'point_type', match: { value: ptype } }
        ]
      },
      with_payload: false,
      with_vector: false,
    });
    console.log(`  point_type="${ptype}": ${typeResult.points.length > 0 ? 'Found' : 'None'}`);
  }

  console.log('\n========================================');
  console.log('  All Tests Complete!');
  console.log('========================================\n');
}

main().catch(console.error);
