/**
 * Delete all legacy "relationship" points from Qdrant
 * These are from the old system - current system uses point_type: "graph"
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = process.env.UNIFIED_COLLECTION_NAME || 'nexsus_unified';

const client = new QdrantClient({
  url: QDRANT_HOST,
  apiKey: QDRANT_API_KEY,
});

interface RelationshipPayload {
  point_type: string;
  source_model: string;
  target_model: string;
  field_name: string;
  description?: string;
}

async function deleteRelationshipPoints(dryRun: boolean = true) {
  console.log('\n' + '═'.repeat(70));
  console.log('DELETE LEGACY "relationship" POINTS');
  console.log('═'.repeat(70));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '🗑️  LIVE DELETE'}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log('');

  // Step 1: Count and collect all relationship points
  console.log('Step 1: Scanning for point_type="relationship"...\n');

  const pointsToDelete: { id: string; payload: RelationshipPayload }[] = [];
  let offset: string | number | null = null;

  do {
    const scrollResult = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'relationship' } }],
      },
      limit: 100,
      offset: offset ?? undefined,
      with_payload: true,
    });

    for (const point of scrollResult.points) {
      pointsToDelete.push({
        id: point.id as string,
        payload: point.payload as unknown as RelationshipPayload,
      });
    }

    offset = (scrollResult.next_page_offset as string | number | null) ?? null;

    // Progress indicator
    if (pointsToDelete.length % 500 === 0 && pointsToDelete.length > 0) {
      console.log(`  Found ${pointsToDelete.length} points so far...`);
    }
  } while (offset !== null);

  console.log(`\n✅ Found ${pointsToDelete.length} "relationship" points to delete\n`);

  if (pointsToDelete.length === 0) {
    console.log('Nothing to delete. Exiting.');
    return;
  }

  // Step 2: Show sample of what will be deleted
  console.log('─'.repeat(70));
  console.log('SAMPLE OF POINTS TO DELETE (first 10):');
  console.log('─'.repeat(70));

  for (const point of pointsToDelete.slice(0, 10)) {
    console.log(`  ${point.id}`);
    console.log(`    ${point.payload.source_model}.${point.payload.field_name} → ${point.payload.target_model}`);
  }

  if (pointsToDelete.length > 10) {
    console.log(`  ... and ${pointsToDelete.length - 10} more`);
  }

  // Step 3: Group by source model for summary
  console.log('\n' + '─'.repeat(70));
  console.log('BY SOURCE MODEL:');
  console.log('─'.repeat(70));

  const bySource = new Map<string, number>();
  for (const point of pointsToDelete) {
    const count = bySource.get(point.payload.source_model) || 0;
    bySource.set(point.payload.source_model, count + 1);
  }

  for (const [model, count] of Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${model}: ${count} edges`);
  }

  // Step 4: Delete or report
  if (dryRun) {
    console.log('\n' + '═'.repeat(70));
    console.log('DRY RUN COMPLETE - No changes made');
    console.log('═'.repeat(70));
    console.log(`\nTo actually delete, run:`);
    console.log(`  npx ts-node scripts/delete-relationship-points.ts --delete\n`);
  } else {
    console.log('\n' + '═'.repeat(70));
    console.log('DELETING POINTS...');
    console.log('═'.repeat(70));

    // Delete in batches of 100
    const batchSize = 100;
    let deleted = 0;

    for (let i = 0; i < pointsToDelete.length; i += batchSize) {
      const batch = pointsToDelete.slice(i, i + batchSize);
      const ids = batch.map(p => p.id);

      await client.delete(COLLECTION_NAME, {
        points: ids,
      });

      deleted += batch.length;
      console.log(`  Deleted ${deleted}/${pointsToDelete.length} points...`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log(`✅ DELETED ${deleted} "relationship" points`);
    console.log('═'.repeat(70));

    // Verify
    console.log('\nVerifying...');
    const verifyResult = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'relationship' } }],
      },
      limit: 1,
    });

    if (verifyResult.points.length === 0) {
      console.log('✅ Verification passed: No "relationship" points remain\n');
    } else {
      console.log('⚠️  Warning: Some "relationship" points may still exist\n');
    }
  }
}

// Check command line args
const args = process.argv.slice(2);
const isLiveDelete = args.includes('--delete') || args.includes('-d');

deleteRelationshipPoints(!isLiveDelete).catch(console.error);
