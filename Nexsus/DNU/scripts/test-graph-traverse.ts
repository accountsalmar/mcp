/**
 * Test Graph Traverse Tool
 *
 * Tests the graph_traverse functionality by:
 * 1. Traversing from crm.stage #1 (outgoing)
 * 2. Traversing from res.users #1 (outgoing to partner/company)
 * 3. Testing incoming references to res.users #1
 *
 * Run: npx tsx scripts/test-graph-traverse.ts
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('='.repeat(60));
console.log('TEST: Graph Traverse Tool');
console.log('='.repeat(60));
console.log();

async function main() {
  // Dynamic imports
  const { QdrantClient } = await import('@qdrant/js-client-rest');
  const { initializeVectorClient, retrievePointById, vectorIdToUuid, getQdrantClient } = await import('../src/services/vector-client.js');
  const { buildFkQdrantId, isValidFkQdrantId } = await import('../src/utils/fk-id-builder.js');
  const { getModelId } = await import('../src/services/excel-pipeline-loader.js');
  const { generateDataVectorId } = await import('../src/services/pipeline-data-transformer.js');

  const DATA_COLLECTION = 'nexsus_data';

  // Initialize
  console.log('Initializing vector client...');
  initializeVectorClient();
  console.log();

  // =========================================================================
  // Test 1: Traverse from crm.stage #1 (outgoing)
  // =========================================================================
  console.log('='.repeat(60));
  console.log('TEST 1: Traverse from crm.stage #1 (outgoing)');
  console.log('='.repeat(60));
  console.log();

  const crmStageModelId = getModelId('crm.stage');
  console.log(`crm.stage model_id: ${crmStageModelId}`);

  if (crmStageModelId) {
    const stageVectorId = generateDataVectorId(crmStageModelId, 1);
    const stageUuid = vectorIdToUuid(stageVectorId);
    console.log(`crm.stage #1 UUID: ${stageUuid}`);

    const stagePoint = await retrievePointById(DATA_COLLECTION, stageUuid, false);
    if (stagePoint.found && stagePoint.payload) {
      console.log(`Found: ${stagePoint.payload.name}`);
      console.log();

      // Find all *_qdrant fields
      const fkFields = Object.keys(stagePoint.payload).filter(k => k.endsWith('_qdrant'));
      console.log(`FK Qdrant fields found: ${fkFields.length}`);

      for (const fkField of fkFields) {
        const targetUuid = stagePoint.payload[fkField] as string;
        const fieldName = fkField.replace('_qdrant', '');

        if (isValidFkQdrantId(targetUuid)) {
          console.log(`  ${fieldName}:`);
          console.log(`    UUID: ${targetUuid}`);

          // Try to retrieve target
          const targetPoint = await retrievePointById(DATA_COLLECTION, targetUuid, false);
          if (targetPoint.found && targetPoint.payload) {
            console.log(`    → Found: ${targetPoint.payload.model_name} #${targetPoint.payload.record_id}`);
            console.log(`      Name: ${targetPoint.payload.name || targetPoint.payload.login || '(no name)'}`);
          } else {
            console.log(`    → NOT SYNCED`);
          }
        }
      }
    } else {
      console.log('crm.stage #1 not found in Qdrant');
    }
  }

  console.log();

  // =========================================================================
  // Test 2: Traverse from res.users #1 (OdooBot) - outgoing
  // =========================================================================
  console.log('='.repeat(60));
  console.log('TEST 2: Traverse from res.users #1 (outgoing)');
  console.log('='.repeat(60));
  console.log();

  const resUsersModelId = getModelId('res.users');
  console.log(`res.users model_id: ${resUsersModelId}`);

  if (resUsersModelId) {
    const userVectorId = generateDataVectorId(resUsersModelId, 1);
    const userUuid = vectorIdToUuid(userVectorId);
    console.log(`res.users #1 UUID: ${userUuid}`);

    const userPoint = await retrievePointById(DATA_COLLECTION, userUuid, false);
    if (userPoint.found && userPoint.payload) {
      console.log(`Found: ${userPoint.payload.name || userPoint.payload.login}`);
      console.log();

      // Find all *_qdrant fields
      const fkFields = Object.keys(userPoint.payload).filter(k => k.endsWith('_qdrant'));
      console.log(`FK Qdrant fields found: ${fkFields.length}`);

      for (const fkField of fkFields) {
        const targetUuid = userPoint.payload[fkField] as string;
        const fieldName = fkField.replace('_qdrant', '');

        if (isValidFkQdrantId(targetUuid)) {
          console.log(`  ${fieldName}:`);
          console.log(`    UUID: ${targetUuid}`);

          // Try to retrieve target
          const targetPoint = await retrievePointById(DATA_COLLECTION, targetUuid, false);
          if (targetPoint.found && targetPoint.payload) {
            console.log(`    → Found: ${targetPoint.payload.model_name} #${targetPoint.payload.record_id}`);
            console.log(`      Name: ${targetPoint.payload.name || '(no name)'}`);
          } else {
            console.log(`    → NOT SYNCED`);
          }
        }
      }
    } else {
      console.log('res.users #1 not found in Qdrant');
    }
  }

  console.log();

  // =========================================================================
  // Test 3: Incoming references to res.users #1
  // =========================================================================
  console.log('='.repeat(60));
  console.log('TEST 3: Incoming references to res.users #1');
  console.log('='.repeat(60));
  console.log();

  if (resUsersModelId) {
    const userVectorId = generateDataVectorId(resUsersModelId, 1);
    const userUuid = vectorIdToUuid(userVectorId);
    console.log(`Looking for records that reference UUID: ${userUuid}`);
    console.log();

    const qdrant = getQdrantClient();
    const fkFieldsToSearch = [
      'create_uid_qdrant',
      'write_uid_qdrant',
      'user_id_qdrant',
    ];

    const incomingResult = await qdrant.scroll(DATA_COLLECTION, {
      filter: {
        should: fkFieldsToSearch.map(field => ({
          key: field,
          match: { value: userUuid }
        }))
      },
      limit: 10,
      with_payload: true,
      with_vector: false,
    });

    console.log(`Found ${incomingResult.points.length} record(s) referencing res.users #1:`);
    for (const point of incomingResult.points) {
      const payload = point.payload as Record<string, unknown>;
      console.log(`  - ${payload.model_name} #${payload.record_id}: ${payload.name || '(unnamed)'}`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('GRAPH TRAVERSE TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
