/**
 * Check vector data in Qdrant
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantHost = process.env.QDRANT_HOST || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY;

const client = new QdrantClient({
  url: qdrantHost,
  apiKey: qdrantApiKey,
});

const collectionName = 'nexsus_data';

console.log('='.repeat(60));
console.log('Checking vectors in', collectionName);
console.log('='.repeat(60));

try {
  // Get collection info
  const info = await client.getCollection(collectionName);
  console.log('\nCollection info:');
  console.log('  Vectors count:', info.vectors_count);
  console.log('  Points count:', info.points_count);

  // Scroll to get some points
  const result = await client.scroll(collectionName, {
    limit: 5,
    with_payload: true,
    with_vector: false,
  });

  console.log('\n--- Sample Points (first 5) ---\n');

  for (const point of result.points) {
    console.log('Qdrant ID:', point.id);
    console.log('Payload:');
    console.log('  vector_id:', point.payload?.vector_id);
    console.log('  model_name:', point.payload?.model_name);
    console.log('  model_id:', point.payload?.model_id);
    console.log('  record_id:', point.payload?.record_id);
    console.log('  point_type:', point.payload?.point_type);

    // Show other payload fields
    const otherFields = Object.keys(point.payload || {}).filter(
      k => !['vector_id', 'model_name', 'model_id', 'record_id', 'point_type', 'sync_timestamp'].includes(k)
    );
    if (otherFields.length > 0) {
      console.log('  Other fields:', otherFields.join(', '));
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('Vector_Id format verification:');
  const firstPoint = result.points[0];
  if (firstPoint) {
    const expectedFormat = `${firstPoint.payload?.model_id}^${firstPoint.payload?.record_id}`;
    const actualVectorId = firstPoint.payload?.vector_id;
    console.log('  Expected format:', expectedFormat);
    console.log('  Actual vector_id:', actualVectorId);
    console.log('  Match:', expectedFormat === actualVectorId ? '✓ YES' : '✗ NO');
  }
  console.log('='.repeat(60));

} catch (error) {
  console.error('Error:', error.message);
}
