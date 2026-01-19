/**
 * Get breakdown of data points by model
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const client = new QdrantClient({
  url: process.env.QDRANT_HOST || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = process.env.UNIFIED_COLLECTION_NAME || 'nexsus_unified';

async function getDataBreakdown() {
  console.log('\n' + '═'.repeat(70));
  console.log('DATA POINTS BY MODEL');
  console.log('═'.repeat(70));
  console.log(`Collection: ${COLLECTION_NAME}\n`);

  const modelCounts = new Map<string, number>();
  let totalCount = 0;
  let offset: string | number | null = null;
  let scrollCount = 0;

  console.log('Scanning data points...');

  do {
    const scrollResult = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'data' } }],
      },
      limit: 1000,
      offset: offset ?? undefined,
      with_payload: ['model_name'],  // Only fetch model_name for efficiency
    });

    for (const point of scrollResult.points) {
      const modelName = (point.payload as any)?.model_name || 'unknown';
      modelCounts.set(modelName, (modelCounts.get(modelName) || 0) + 1);
      totalCount++;
    }

    offset = (scrollResult.next_page_offset as string | number | null) ?? null;
    scrollCount++;

    // Progress every 100k records
    if (totalCount % 100000 < 1000) {
      console.log(`  Scanned ${totalCount.toLocaleString()} records...`);
    }
  } while (offset !== null);

  console.log(`\n✅ Total data points: ${totalCount.toLocaleString()}\n`);

  // Sort by count descending
  const sorted = Array.from(modelCounts.entries())
    .sort((a, b) => b[1] - a[1]);

  console.log('─'.repeat(70));
  console.log('MODEL                                          COUNT        %');
  console.log('─'.repeat(70));

  for (const [model, count] of sorted) {
    const pct = ((count / totalCount) * 100).toFixed(2);
    const modelPadded = model.padEnd(45);
    const countPadded = count.toLocaleString().padStart(12);
    console.log(`${modelPadded} ${countPadded}    ${pct.padStart(6)}%`);
  }

  console.log('─'.repeat(70));
  console.log(`${'TOTAL'.padEnd(45)} ${totalCount.toLocaleString().padStart(12)}   100.00%`);
  console.log('═'.repeat(70));

  // Summary stats
  console.log(`\nUnique models: ${modelCounts.size}`);
}

getDataBreakdown().catch(console.error);
