/**
 * FK Integrity Validation Script
 *
 * Validates that ALL FK references in the synced data have matching target records.
 * This ensures the "full story" is captured - no orphan FK references.
 *
 * Run: npx tsx scripts/validate-fk-integrity.ts
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { UNIFIED_CONFIG } from '../src/constants.js';

// Initialize Qdrant client directly (no embedding needed)
const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const client = new QdrantClient({
  url: QDRANT_HOST,
  apiKey: QDRANT_API_KEY,
});

interface FkValidationResult {
  model_name: string;
  total_records: number;
  fk_fields_checked: number;
  total_fk_references: number;
  missing_references: number;
  orphan_details: Array<{
    fk_field: string;
    missing_uuid: string;
    source_record_id: number;
  }>;
}

interface ValidationSummary {
  total_models: number;
  total_records_checked: number;
  total_fk_references: number;
  total_missing: number;
  missing_by_target_model: Map<string, number>;
  models_with_orphans: string[];
  integrity_percentage: number;
}

/**
 * Parse V2 UUID to extract model_id and record_id
 * Format: 00000002-MMMM-0000-0000-RRRRRRRRRRRR
 */
function parseDataUuid(uuid: string): { model_id: number; record_id: number } | null {
  const parts = uuid.split('-');
  if (parts.length !== 5 || parts[0] !== '00000002') {
    return null; // Not a data UUID
  }

  const modelId = parseInt(parts[1], 10);
  const recordId = parseInt(parts[4], 10);

  if (isNaN(modelId) || isNaN(recordId)) {
    return null;
  }

  return { model_id: modelId, record_id: recordId };
}

/**
 * Get all unique models in the collection
 */
async function getModelsInCollection(): Promise<Map<string, { model_id: number; count: number }>> {
  const models = new Map<string, { model_id: number; count: number }>();

  let offset: string | undefined = undefined;
  const BATCH_SIZE = 1000;

  console.log('[SCAN] Scanning collection for models...');

  while (true) {
    const result = await client.scroll(UNIFIED_CONFIG.COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } }
        ]
      },
      limit: BATCH_SIZE,
      offset: offset,
      with_payload: { include: ['model_name', 'odoo_id'] },
      with_vector: false,
    });

    for (const point of result.points) {
      const modelName = point.payload?.model_name as string;
      if (modelName) {
        const existing = models.get(modelName);
        if (existing) {
          existing.count++;
        } else {
          // Extract model_id from UUID
          const parsed = parseDataUuid(point.id as string);
          models.set(modelName, {
            model_id: parsed?.model_id || 0,
            count: 1
          });
        }
      }
    }

    if (result.points.length < BATCH_SIZE || !result.next_page_offset) {
      break;
    }
    offset = result.next_page_offset as string;
  }

  return models;
}

/**
 * Check if a batch of UUIDs exist in the collection
 */
async function checkUuidsExist(uuids: string[]): Promise<Set<string>> {
  if (uuids.length === 0) return new Set();

  const existing = new Set<string>();

  // Batch check - Qdrant supports up to 1000 IDs at once
  const BATCH_SIZE = 500;

  for (let i = 0; i < uuids.length; i += BATCH_SIZE) {
    const batch = uuids.slice(i, i + BATCH_SIZE);

    try {
      const points = await client.retrieve(UNIFIED_CONFIG.COLLECTION_NAME, {
        ids: batch,
        with_payload: false,
        with_vector: false,
      });

      for (const point of points) {
        existing.add(point.id as string);
      }
    } catch (error) {
      console.error(`[ERROR] Batch check failed: ${error}`);
    }
  }

  return existing;
}

/**
 * Validate FK integrity for a specific model
 */
async function validateModelFkIntegrity(
  modelName: string,
  modelId: number
): Promise<FkValidationResult> {
  const result: FkValidationResult = {
    model_name: modelName,
    total_records: 0,
    fk_fields_checked: 0,
    total_fk_references: 0,
    missing_references: 0,
    orphan_details: [],
  };

  // Collect all FK references from this model
  const fkReferences = new Map<string, Set<string>>(); // field_name -> Set of UUIDs
  const sourceRecords = new Map<string, number[]>(); // UUID -> source record IDs

  let offset: string | undefined = undefined;
  const BATCH_SIZE = 500;

  // Scroll through all records of this model
  while (true) {
    const scrollResult = await client.scroll(UNIFIED_CONFIG.COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: modelName } }
        ]
      },
      limit: BATCH_SIZE,
      offset: offset,
      with_payload: true,
      with_vector: false,
    });

    for (const point of scrollResult.points) {
      result.total_records++;
      const payload = point.payload as Record<string, unknown>;
      const sourceRecordId = payload.odoo_id as number || 0;

      // Find all FK fields (ending with _qdrant)
      for (const [key, value] of Object.entries(payload)) {
        if (!key.endsWith('_qdrant')) continue;

        const fieldName = key.replace('_qdrant', '');

        if (!fkReferences.has(fieldName)) {
          fkReferences.set(fieldName, new Set());
        }

        // Handle both single UUID and array of UUIDs
        const uuids = Array.isArray(value) ? value : [value];

        for (const uuid of uuids) {
          if (typeof uuid === 'string' && uuid.startsWith('00000002-')) {
            fkReferences.get(fieldName)!.add(uuid);
            result.total_fk_references++;

            // Track source record for this UUID
            if (!sourceRecords.has(uuid)) {
              sourceRecords.set(uuid, []);
            }
            sourceRecords.get(uuid)!.push(sourceRecordId);
          }
        }
      }
    }

    if (scrollResult.points.length < BATCH_SIZE || !scrollResult.next_page_offset) {
      break;
    }
    offset = scrollResult.next_page_offset as string;
  }

  result.fk_fields_checked = fkReferences.size;

  // Check which FK targets exist
  console.log(`  [${modelName}] Checking ${result.total_fk_references} FK references across ${fkReferences.size} fields...`);

  for (const [fieldName, uuidSet] of fkReferences) {
    const uuids = Array.from(uuidSet);
    const existingUuids = await checkUuidsExist(uuids);

    for (const uuid of uuids) {
      if (!existingUuids.has(uuid)) {
        result.missing_references++;

        // Record orphan details (limit to first 100 per model to avoid huge reports)
        if (result.orphan_details.length < 100) {
          const sourceIds = sourceRecords.get(uuid) || [];
          result.orphan_details.push({
            fk_field: fieldName,
            missing_uuid: uuid,
            source_record_id: sourceIds[0] || 0,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('FK INTEGRITY VALIDATION');
  console.log('Checking that all FK references have matching target records');
  console.log('='.repeat(70) + '\n');

  // Step 1: Get all models in the collection
  console.log('[STEP 1] Discovering models in collection...\n');
  const models = await getModelsInCollection();

  console.log(`Found ${models.size} models:\n`);
  for (const [name, info] of models) {
    console.log(`  - ${name}: ${info.count} records (model_id: ${info.model_id})`);
  }

  // Step 2: Validate each model
  console.log('\n' + '-'.repeat(70));
  console.log('[STEP 2] Validating FK integrity for each model...\n');

  const results: FkValidationResult[] = [];
  const missingByTargetModel = new Map<string, number>();

  for (const [modelName, info] of models) {
    const result = await validateModelFkIntegrity(modelName, info.model_id);
    results.push(result);

    // Track missing by target model
    for (const orphan of result.orphan_details) {
      const parsed = parseDataUuid(orphan.missing_uuid);
      if (parsed) {
        // Find target model name from model_id
        let targetModel = `model_id:${parsed.model_id}`;
        for (const [name, modelInfo] of models) {
          if (modelInfo.model_id === parsed.model_id) {
            targetModel = name;
            break;
          }
        }
        missingByTargetModel.set(
          targetModel,
          (missingByTargetModel.get(targetModel) || 0) + 1
        );
      }
    }

    // Log progress
    const status = result.missing_references === 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${modelName}: ${result.missing_references} missing / ${result.total_fk_references} FK refs`);
  }

  // Step 3: Generate summary
  console.log('\n' + '='.repeat(70));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(70) + '\n');

  const totalRecords = results.reduce((sum, r) => sum + r.total_records, 0);
  const totalFkRefs = results.reduce((sum, r) => sum + r.total_fk_references, 0);
  const totalMissing = results.reduce((sum, r) => sum + r.missing_references, 0);
  const modelsWithOrphans = results.filter(r => r.missing_references > 0).map(r => r.model_name);
  const integrityPercentage = totalFkRefs > 0 ? ((totalFkRefs - totalMissing) / totalFkRefs * 100) : 100;

  console.log(`Total models checked: ${results.length}`);
  console.log(`Total records checked: ${totalRecords}`);
  console.log(`Total FK references: ${totalFkRefs}`);
  console.log(`Missing FK targets: ${totalMissing}`);
  console.log(`FK Integrity: ${integrityPercentage.toFixed(2)}%\n`);

  if (totalMissing > 0) {
    console.log('⚠️  ORPHAN FK REFERENCES FOUND!\n');

    console.log('Missing by target model:');
    const sortedMissing = Array.from(missingByTargetModel.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [target, count] of sortedMissing) {
      console.log(`  - ${target}: ${count} missing`);
    }

    console.log('\nModels with orphan references:');
    for (const model of modelsWithOrphans) {
      const result = results.find(r => r.model_name === model)!;
      console.log(`  - ${model}: ${result.missing_references} orphans`);
    }

    // Show sample orphans
    console.log('\nSample orphan details (first 20):');
    let orphanCount = 0;
    for (const result of results) {
      for (const orphan of result.orphan_details) {
        if (orphanCount >= 20) break;
        const parsed = parseDataUuid(orphan.missing_uuid);
        console.log(`  - ${result.model_name}.${orphan.fk_field} → missing record (model_id: ${parsed?.model_id}, record_id: ${parsed?.record_id})`);
        orphanCount++;
      }
      if (orphanCount >= 20) break;
    }
  } else {
    console.log('✅ ALL FK REFERENCES HAVE MATCHING TARGET RECORDS!');
    console.log('   The full story is captured - no orphan FK references.');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
