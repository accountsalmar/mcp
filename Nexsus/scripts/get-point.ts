import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const client = new QdrantClient({
  url: process.env.QDRANT_HOST || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

const pointId = process.argv[2] || 'b4c1b88b-b76e-1fe1-96cd-5d3f3f9a1c01';

async function getPoint() {
  try {
    console.log(`\nLooking for point: ${pointId}\n`);

    const result = await client.retrieve('nexsus_unified', {
      ids: [pointId],
      with_payload: true,
      with_vector: true,
    });

    if (result.length === 0) {
      console.log('❌ Point NOT FOUND in nexsus_unified collection');
    } else {
      const point = result[0] as any;
      console.log('✅ Point found!\n');
      console.log('═'.repeat(60));
      console.log('METADATA');
      console.log('═'.repeat(60));
      console.log(`  ID:      ${point.id}`);
      console.log(`  Version: ${point.version} (Qdrant internal version counter)`);
      console.log(`  Vector:  ${point.vector ? `Yes (${point.vector.length} dimensions)` : 'No'}`);

      console.log('\n' + '═'.repeat(60));
      console.log('TIMESTAMPS');
      console.log('═'.repeat(60));
      const payload = point.payload || {};
      console.log(`  last_cascade:   ${payload.last_cascade || 'N/A'}`);
      console.log(`  sync_timestamp: ${payload.sync_timestamp || 'N/A'}`);
      console.log(`  created_at:     ${payload.created_at || 'N/A (not stored)'}`);

      console.log('\n' + '═'.repeat(60));
      console.log('PAYLOAD');
      console.log('═'.repeat(60));
      const { ...payloadWithoutVector } = payload;
      console.log(JSON.stringify(payloadWithoutVector, null, 2));
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error:', err.message);
  }
}

getPoint();
