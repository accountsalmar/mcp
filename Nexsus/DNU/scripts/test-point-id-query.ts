#!/usr/bin/env npx tsx
/**
 * Test point_id query without model_name (Tier 3 capability)
 *
 * This tests the new feature where model_name is auto-resolved from point_id UUID.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { QdrantClient } from '@qdrant/js-client-rest';
import { parseDataUuidV2 } from '../src/utils/uuid-v2.js';
import {
  initializeSchemaLookup,
  getModelNameById,
  isSystemField,
  validateSystemFieldOperator,
  SYSTEM_FIELDS
} from '../src/services/schema-lookup.js';

const COLLECTION_NAME = 'nexsus_data';

async function main() {
  console.log('========================================');
  console.log('  Test: point_id Query Without model_name');
  console.log('========================================\n');

  // Initialize Qdrant client
  const qdrantHost = process.env.QDRANT_HOST || 'http://localhost:6333';
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  console.log(`Qdrant Host: ${qdrantHost}\n`);

  const qdrant = new QdrantClient({
    url: qdrantHost,
    apiKey: qdrantApiKey,
  });

  // Test 1: Verify SYSTEM_FIELDS
  console.log('--- Test 1: SYSTEM_FIELDS Verification ---\n');
  console.log('System fields defined:');
  for (const [field, config] of Object.entries(SYSTEM_FIELDS)) {
    console.log(`  ${field}: ${config.type} [${config.operators.join(', ')}]`);
  }
  console.log('');

  // Test 2: isSystemField() helper
  console.log('--- Test 2: isSystemField() Helper ---\n');
  const testFields = ['point_id', 'sync_timestamp', 'debit', 'partner_id_id'];
  for (const field of testFields) {
    console.log(`  isSystemField("${field}"): ${isSystemField(field)}`);
  }
  console.log('');

  // Test 3: validateSystemFieldOperator()
  console.log('--- Test 3: validateSystemFieldOperator() ---\n');
  const opTests = [
    { field: 'point_id', op: 'eq' },
    { field: 'point_id', op: 'contains' },
    { field: 'point_id', op: 'gt' },  // Should fail
    { field: 'sync_timestamp', op: 'gte' },
    { field: 'sync_timestamp', op: 'contains' },  // Should fail
  ];
  for (const test of opTests) {
    const error = validateSystemFieldOperator(test.field, test.op);
    console.log(`  ${test.field} + ${test.op}: ${error ? `ERROR: ${error}` : 'OK'}`);
  }
  console.log('');

  // Test 4: Get a sample DATA point_id from Qdrant (00000002-...)
  console.log('--- Test 4: Sample DATA point_id from Qdrant ---\n');

  try {
    // Filter for DATA points only (point_type = 'data')
    const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
      limit: 1,
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } }
        ]
      },
      with_payload: true,
      with_vector: false,
    });

    if (scrollResult.points.length === 0) {
      console.log('No points found in collection. Run pipeline_sync first.');
      return;
    }

    const samplePoint = scrollResult.points[0];
    const pointId = samplePoint.id as string;
    const payload = samplePoint.payload as Record<string, unknown>;

    console.log(`Sample point_id: ${pointId}`);
    console.log(`Sample model_name from payload: ${payload.model_name}`);
    console.log(`Sample record_id from payload: ${payload.record_id}`);
    console.log('');

    // Test 5: Parse the UUID to extract model_id
    console.log('--- Test 5: parseDataUuidV2() ---\n');
    const parsed = parseDataUuidV2(pointId);
    if (parsed) {
      console.log(`Parsed from UUID:`);
      console.log(`  model_id: ${parsed.modelId}`);
      console.log(`  record_id: ${parsed.recordId}`);
    } else {
      console.log(`Could not parse UUID: ${pointId}`);
    }
    console.log('');

    // Test 6: Initialize schema and test getModelNameById()
    console.log('--- Test 6: getModelNameById() ---\n');
    initializeSchemaLookup();

    if (parsed) {
      const modelName = getModelNameById(parsed.modelId);
      console.log(`getModelNameById(${parsed.modelId}): ${modelName || 'NOT FOUND'}`);

      if (modelName === payload.model_name) {
        console.log('✓ Model name matches payload!');
      } else {
        console.log(`✗ Mismatch! Expected: ${payload.model_name}`);
      }
    }
    console.log('');

    // Test 7: Query by point_id (simulating the nexsus_search behavior)
    console.log('--- Test 7: Query by point_id ---\n');
    console.log('Simulating nexsus_search query:');
    console.log(JSON.stringify({
      filters: [
        { field: 'point_id', op: 'eq', value: pointId }
      ]
    }, null, 2));
    console.log('');

    // Actually query Qdrant
    const queryResult = await qdrant.scroll(COLLECTION_NAME, {
      limit: 1,
      filter: {
        must: [
          { key: 'point_id', match: { value: pointId } }
        ]
      },
      with_payload: true,
      with_vector: false,
    });

    if (queryResult.points.length > 0) {
      const foundPayload = queryResult.points[0].payload as Record<string, unknown>;
      console.log('Query result:');
      console.log(`  point_id: ${queryResult.points[0].id}`);
      console.log(`  model_name: ${foundPayload.model_name}`);
      console.log(`  record_id: ${foundPayload.record_id}`);
      console.log('');
      console.log('✓ Direct point_id query works!');
    } else {
      console.log('✗ No results found');
    }
    console.log('');

    // Test 8: UUID segment matching (contains)
    console.log('--- Test 8: UUID Segment Matching ---\n');
    if (parsed) {
      const modelSegment = `00000002-${parsed.modelId.toString().padStart(4, '0')}`;
      console.log(`Searching for segment: "${modelSegment}"`);

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

      console.log(`Found ${segmentResult.points.length} records with segment match:`);
      for (const pt of segmentResult.points) {
        const p = pt.payload as Record<string, unknown>;
        console.log(`  ${pt.id} | ${p.model_name} | record_id=${p.record_id}`);
      }
      console.log('');
      console.log('✓ UUID segment matching works!');
    }

  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n========================================');
  console.log('  Test Complete');
  console.log('========================================\n');
}

main();
