import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
dotenv.config();

const client = new QdrantClient({
  url: process.env.QDRANT_HOST,
  apiKey: process.env.QDRANT_API_KEY,
});

async function checkKnowledge() {
  const count = await client.count('nexsus_unified', {
    filter: { must: [{ key: 'point_type', match: { value: 'knowledge' } }] },
    exact: true,
  });
  console.log('Knowledge points count:', count.count);

  const result = await client.scroll('nexsus_unified', {
    filter: { must: [{ key: 'point_type', match: { value: 'knowledge' } }] },
    limit: 20,
    with_payload: true,
  });

  console.log('\nAll knowledge points:\n');
  for (const p of result.points) {
    console.log('ID:', p.id);
    console.log('Payload:', JSON.stringify(p.payload, null, 2));
    console.log('─'.repeat(50));
  }
}
checkKnowledge().catch(console.error);
