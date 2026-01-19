/**
 * Test date range filtering directly with Qdrant
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const DATA_COLLECTION = 'nexsus_data';

async function testDateFilter() {
  console.log('Testing date range filtering...');
  console.log('='.repeat(60));

  const config: { url: string; apiKey?: string; checkCompatibility?: boolean } = {
    url: QDRANT_HOST,
    checkCompatibility: false,
  };
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);

  // Test 1: Simple date match
  console.log('\nTest 1: Exact date match (date = "2025-03-01")');
  try {
    const result = await client.count(DATA_COLLECTION, {
      filter: {
        must: [
          { key: 'model_name', match: { value: 'account.move.line' } },
          { key: 'date', match: { value: '2025-03-01' } }
        ]
      },
      exact: true
    });
    console.log(`  Result: ${result.count} records`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
  }

  // Test 2: Date range with combined gte/lte
  console.log('\nTest 2: Combined date range (gte + lte in one object)');
  try {
    const result = await client.count(DATA_COLLECTION, {
      filter: {
        must: [
          { key: 'model_name', match: { value: 'account.move.line' } },
          { key: 'date', range: { gte: '2025-03-01', lte: '2025-03-31' } }
        ]
      },
      exact: true
    });
    console.log(`  Result: ${result.count} records`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
  }

  // Test 3: Just gte
  console.log('\nTest 3: Date gte only');
  try {
    const result = await client.count(DATA_COLLECTION, {
      filter: {
        must: [
          { key: 'model_name', match: { value: 'account.move.line' } },
          { key: 'date', range: { gte: '2025-03-01' } }
        ]
      },
      exact: true
    });
    console.log(`  Result: ${result.count} records`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
  }

  // Test 4: Check what dates we actually have in 2025
  console.log('\nTest 4: What dates exist in 2025?');
  try {
    const sample = await client.scroll(DATA_COLLECTION, {
      filter: {
        must: [
          { key: 'model_name', match: { value: 'account.move.line' } },
        ]
      },
      limit: 100,
      with_payload: { include: ['date'] },
      with_vector: false
    });

    const dates = new Set<string>();
    for (const pt of sample.points) {
      const date = (pt.payload as Record<string, unknown>).date as string;
      if (date && date.startsWith('2025')) {
        dates.add(date);
      }
    }
    console.log(`  Found ${dates.size} unique 2025 dates in first 100 records`);
    console.log(`  Sample: ${[...dates].slice(0, 5).join(', ')}`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
  }

  // Test 5: Count records by date starting with "2025-03"
  console.log('\nTest 5: All March 2025 records (starts with "2025-03")');
  try {
    // Get all and filter manually
    let count = 0;
    let offset: string | number | null = null;
    let iterations = 0;
    const maxIterations = 500; // Safety limit

    do {
      const scrollParams: {
        filter: { must: object[] };
        limit: number;
        offset?: string | number;
        with_payload: { include: string[] };
        with_vector: boolean;
      } = {
        filter: {
          must: [
            { key: 'model_name', match: { value: 'account.move.line' } }
          ]
        },
        limit: 1000,
        with_payload: { include: ['date'] },
        with_vector: false
      };

      if (offset !== null) {
        scrollParams.offset = offset;
      }

      const batch = await client.scroll(DATA_COLLECTION, scrollParams);

      for (const pt of batch.points) {
        const date = (pt.payload as Record<string, unknown>).date as string;
        if (date && date.startsWith('2025-03')) {
          count++;
        }
      }

      offset = batch.next_page_offset ?? null;
      iterations++;

      if (iterations >= maxIterations) {
        console.log(`  (Stopped after ${maxIterations} iterations)`);
        break;
      }
    } while (offset !== null);

    console.log(`  Manual count of March 2025: ${count} records`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
  }
}

testDateFilter().catch(console.error);
