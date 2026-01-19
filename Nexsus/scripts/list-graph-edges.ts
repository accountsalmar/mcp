/**
 * List all graph/relationship entries from the unified collection
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = process.env.UNIFIED_COLLECTION_NAME || 'nexsus_unified';

interface GraphPayload {
  point_type: string;
  source_model: string;
  source_model_id: number;
  target_model: string;
  target_model_id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  field_id: number;
  is_leaf: boolean;
  edge_count: number;
  unique_targets: number;
  last_cascade: string;
  cascade_sources: string[];
  description: string;
}

async function listGraphEdges() {
  const client = new QdrantClient({
    url: QDRANT_HOST,
    apiKey: QDRANT_API_KEY,
  });

  console.log(`\n=== Graph Edges in ${COLLECTION_NAME} ===\n`);

  let offset: string | number | null = null;
  let totalCount = 0;
  const allEdges: GraphPayload[] = [];

  do {
    const scrollResult = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'graph' } }],
      },
      limit: 100,
      offset: offset ?? undefined,
      with_payload: true,
    });

    for (const point of scrollResult.points) {
      const payload = point.payload as unknown as GraphPayload;
      allEdges.push(payload);
      totalCount++;
    }

    offset = (scrollResult.next_page_offset as string | number | null) ?? null;
  } while (offset !== null);

  // Display results
  console.log(`Total Graph Edges: ${totalCount}\n`);
  console.log('─'.repeat(100));

  // Group by source model
  const bySource = new Map<string, GraphPayload[]>();
  for (const edge of allEdges) {
    const existing = bySource.get(edge.source_model) || [];
    existing.push(edge);
    bySource.set(edge.source_model, existing);
  }

  for (const [sourceModel, edges] of Array.from(bySource.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n📦 ${sourceModel} (${edges.length} FK relationships)`);
    console.log('─'.repeat(60));

    for (const edge of edges.sort((a, b) => a.field_name.localeCompare(b.field_name))) {
      console.log(`  ├─ ${edge.field_name} (${edge.field_type}) → ${edge.target_model}`);
      console.log(`  │    Label: ${edge.field_label}`);
      console.log(`  │    Stats: ${edge.edge_count} edges, ${edge.unique_targets} unique targets`);
      console.log(`  │    Leaf: ${edge.is_leaf ? 'Yes' : 'No'}`);
      console.log(`  │    Cascade: ${edge.cascade_sources?.join(', ') || 'None'}`);
      console.log(`  │    Last sync: ${edge.last_cascade || 'Never'}`);
    }
  }

  // Summary stats
  console.log('\n' + '═'.repeat(100));
  console.log('SUMMARY');
  console.log('═'.repeat(100));

  const uniqueSources = new Set(allEdges.map(e => e.source_model));
  const uniqueTargets = new Set(allEdges.map(e => e.target_model));
  const leafCount = allEdges.filter(e => e.is_leaf).length;
  const cascadeSources = new Set(allEdges.flatMap(e => e.cascade_sources || []));

  console.log(`Total Relationships: ${totalCount}`);
  console.log(`Unique Source Models: ${uniqueSources.size}`);
  console.log(`Unique Target Models: ${uniqueTargets.size}`);
  console.log(`Leaf Edges (no further FKs): ${leafCount}`);
  console.log(`Cascade Sources: ${Array.from(cascadeSources).join(', ')}`);

  // Field type distribution
  const byType = new Map<string, number>();
  for (const edge of allEdges) {
    byType.set(edge.field_type, (byType.get(edge.field_type) || 0) + 1);
  }
  console.log('\nBy Field Type:');
  for (const [type, count] of Array.from(byType.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
}

listGraphEdges().catch(console.error);
