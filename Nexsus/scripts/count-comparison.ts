/**
 * Compare different count methods to identify discrepancies
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const client = new QdrantClient({
  url: process.env.QDRANT_HOST || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = process.env.UNIFIED_COLLECTION_NAME || 'nexsus_unified';

async function compareCounts() {
  console.log('\n' + '═'.repeat(70));
  console.log('COUNT COMPARISON - Different Methods');
  console.log('═'.repeat(70));
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Method 1: Collection info (fastest, may be approximate)
  console.log('Method 1: Collection Info (Qdrant metadata)');
  const collectionInfo = await client.getCollection(COLLECTION_NAME);
  console.log(`  Total vectors: ${collectionInfo.vectors_count?.toLocaleString()}`);
  console.log(`  Points count: ${collectionInfo.points_count?.toLocaleString()}`);

  // Method 2: Count with filter (uses index)
  console.log('\nMethod 2: Count API with filters');

  const dataCount = await client.count(COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
    exact: true,
  });
  console.log(`  Data points (exact): ${dataCount.count.toLocaleString()}`);

  const schemaCount = await client.count(COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'schema' } }] },
    exact: true,
  });
  console.log(`  Schema points (exact): ${schemaCount.count.toLocaleString()}`);

  const graphCount = await client.count(COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'graph' } }] },
    exact: true,
  });
  console.log(`  Graph points (exact): ${graphCount.count.toLocaleString()}`);

  // Check for any other point types
  const relationshipCount = await client.count(COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'relationship' } }] },
    exact: true,
  });
  console.log(`  Relationship points (legacy): ${relationshipCount.count.toLocaleString()}`);

  // Method 3: Scroll count (slowest, most accurate)
  console.log('\nMethod 3: Full scroll count (most accurate, slower)');

  let scrollTotal = 0;
  let offset: string | number | null = null;
  do {
    const result = await client.scroll(COLLECTION_NAME, {
      filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
      limit: 10000,
      offset: offset ?? undefined,
      with_payload: false,
      with_vector: false,
    });
    scrollTotal += result.points.length;
    offset = (result.next_page_offset as string | number | null) ?? null;

    if (scrollTotal % 100000 < 10000) {
      process.stdout.write(`  Scrolled: ${scrollTotal.toLocaleString()}...\r`);
    }
  } while (offset !== null);
  console.log(`  Data points (scroll): ${scrollTotal.toLocaleString()}        `);

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));

  const sumOfTypes = dataCount.count + schemaCount.count + graphCount.count + relationshipCount.count;

  console.log(`\n  Collection total (metadata):  ${collectionInfo.points_count?.toLocaleString()}`);
  console.log(`  Sum of point types:           ${sumOfTypes.toLocaleString()}`);
  console.log(`  Data count (count API):       ${dataCount.count.toLocaleString()}`);
  console.log(`  Data count (scroll):          ${scrollTotal.toLocaleString()}`);

  const discrepancy = (collectionInfo.points_count || 0) - sumOfTypes;
  if (discrepancy !== 0) {
    console.log(`\n  ⚠️  DISCREPANCY: ${discrepancy.toLocaleString()} points unaccounted for`);
    console.log(`     These may have NULL or missing point_type values`);
  } else {
    console.log(`\n  ✅ All counts match!`);
  }

  // Check for NULL point_type
  console.log('\nChecking for records with missing point_type...');
  const nullCheck = await client.scroll(COLLECTION_NAME, {
    filter: {
      must_not: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'point_type', match: { value: 'schema' } },
        { key: 'point_type', match: { value: 'graph' } },
        { key: 'point_type', match: { value: 'relationship' } },
      ],
    },
    limit: 10,
    with_payload: true,
  });

  if (nullCheck.points.length > 0) {
    console.log(`  Found ${nullCheck.points.length}+ records with unknown/missing point_type:`);
    for (const p of nullCheck.points.slice(0, 3)) {
      console.log(`    ID: ${p.id}, point_type: ${(p.payload as any)?.point_type || 'NULL'}`);
    }
  } else {
    console.log('  No records with missing point_type found');
  }

  console.log('\n' + '═'.repeat(70));
}

compareCounts().catch(console.error);
