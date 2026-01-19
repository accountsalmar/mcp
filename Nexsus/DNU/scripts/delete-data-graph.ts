/**
 * Delete all data and graph points from nexsus_unified
 * Keeps schema points intact
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url: process.env.QDRANT_HOST,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = 'nexsus_unified';

async function main() {
  console.log('=== CHECKING CURRENT STATE ===\n');

  // Count by point_type before deletion
  const schemaCount = await client.count(COLLECTION, {
    filter: { must: [{ key: 'point_type', match: { value: 'schema' } }] },
    exact: true,
  });
  console.log('Schema points:', schemaCount.count);

  const dataCount = await client.count(COLLECTION, {
    filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
    exact: true,
  });
  console.log('Data points:', dataCount.count);

  const graphCount = await client.count(COLLECTION, {
    filter: { must: [{ key: 'point_type', match: { value: 'graph' } }] },
    exact: true,
  });
  console.log('Graph points:', graphCount.count);

  const toDelete = dataCount.count + graphCount.count;
  console.log('\nTotal to delete (data + graph):', toDelete);
  console.log('Schema points will be KEPT:', schemaCount.count);

  if (toDelete === 0) {
    console.log('\nNothing to delete!');
    return;
  }

  // Delete data points
  console.log('\n=== DELETING DATA POINTS ===');
  if (dataCount.count > 0) {
    await client.delete(COLLECTION, {
      wait: true,
      filter: {
        must: [{ key: 'point_type', match: { value: 'data' } }],
      },
    });
    console.log(`Deleted ${dataCount.count} data points`);
  }

  // Delete graph points
  console.log('\n=== DELETING GRAPH POINTS ===');
  if (graphCount.count > 0) {
    await client.delete(COLLECTION, {
      wait: true,
      filter: {
        must: [{ key: 'point_type', match: { value: 'graph' } }],
      },
    });
    console.log(`Deleted ${graphCount.count} graph points`);
  }

  // Verify deletion
  console.log('\n=== AFTER DELETION ===');

  const finalSchema = await client.count(COLLECTION, {
    filter: { must: [{ key: 'point_type', match: { value: 'schema' } }] },
    exact: true,
  });
  console.log('Schema points:', finalSchema.count);

  const finalData = await client.count(COLLECTION, {
    filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
    exact: true,
  });
  console.log('Data points:', finalData.count);

  const finalGraph = await client.count(COLLECTION, {
    filter: { must: [{ key: 'point_type', match: { value: 'graph' } }] },
    exact: true,
  });
  console.log('Graph points:', finalGraph.count);

  console.log('\n✅ Done! Data and graph points deleted. Schema preserved.');
}

main().catch(console.error);
