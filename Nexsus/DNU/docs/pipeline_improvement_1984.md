# Nexsus Vector Knowledge Graph Implementation Plan

## Research Sources (Official Documentation)

This plan is based on research from official documentation:

- **Qdrant**: [Points](https://qdrant.tech/documentation/concepts/points/), [Payload](https://qdrant.tech/documentation/concepts/payload/), [Filtering](https://qdrant.tech/documentation/concepts/filtering/), [Indexing](https://qdrant.tech/documentation/concepts/indexing/)
- **Voyage AI**: [Text Embeddings](https://docs.voyageai.com/docs/embeddings), [FAQ](https://docs.voyageai.com/docs/faq)
- **Anthropic MCP**: [Specification](https://modelcontextprotocol.io/specification/2025-11-25), [GitHub](https://github.com/modelcontextprotocol)

---

## Current Architecture Understanding

### Key Files to Modify
| File | Purpose |
|------|---------|
| `src/services/pipeline-data-sync.ts` | Orchestrates sync, builds points |
| `src/services/pipeline-data-transformer.ts` | Transforms records, builds payload |
| `src/services/vector-client.ts` | Qdrant operations, UUID conversion |
| `src/services/excel-pipeline-loader.ts` | FK metadata already loaded |
| `src/types.ts` | TypeScript interfaces |

### Current UUID Format
```
Format: MMMMMMMM-0000-0000-0000-RRRRRRRRRRRR
Example: 00000344-0000-0000-0000-000000012345
         ^^^^^^^^                ^^^^^^^^^^^^
         model_id=344            record_id=12345
```

### FK Metadata Already Available
From `excel-pipeline-loader.ts`, FK fields already have:
- `fk_location_model`: Target model name (e.g., "res.partner")
- `fk_location_model_id`: Target model ID (e.g., 78)
- `fk_location_record_id`: Target field ID
- `fk_qdrant_id`: Pre-computed schema UUID

---

## Phase 1: Add FK Qdrant IDs to Payload

**Objective**: For each many2one FK field, add `*_qdrant` field containing the target record's UUID.

### Step 1.1: Create FK ID Builder Utility

**File**: `src/utils/fk-id-builder.ts` (new file)

Based on [Qdrant Points documentation](https://qdrant.tech/documentation/concepts/points/), Qdrant supports UUID strings as point IDs. We'll build deterministic UUIDs for FK targets.

```typescript
/**
 * Build Qdrant UUID for an FK target record
 *
 * Uses the same format as vectorIdToUuid() in vector-client.ts:
 * Format: MMMMMMMM-0000-0000-0000-RRRRRRRRRRRR
 */
export function buildFkQdrantId(targetModelId: number, recordId: number): string {
  const modelPart = targetModelId.toString().padStart(8, '0');
  const recordPart = recordId.toString().padStart(12, '0');
  return `${modelPart}-0000-0000-0000-${recordPart}`;
}
```

### Step 1.2: Modify `buildPayload()` in pipeline-data-transformer.ts

**Location**: `src/services/pipeline-data-transformer.ts:222-253`

Add FK Qdrant ID for each many2one field:

```typescript
// Current code:
if (field.field_type === 'many2one' && Array.isArray(value)) {
  payload[field.field_name] = value[1];     // Store name
  payload[`${field.field_name}_id`] = value[0]; // Store ID
}

// ADD AFTER:
// Build FK Qdrant UUID if FK metadata exists
if (field.fk_location_model_id) {
  const fkRecordId = value[0];
  const fkQdrantId = buildFkQdrantId(field.fk_location_model_id, fkRecordId);
  payload[`${field.field_name}_qdrant`] = fkQdrantId;
}
```

### Step 1.3: Add Payload Index for FK Qdrant Fields

Based on [Qdrant Indexing docs](https://qdrant.tech/documentation/concepts/indexing/), add `uuid` index type for FK fields (more memory-efficient than keyword):

**File**: `src/services/vector-client.ts:518-534`

Add common FK indexes:
```typescript
const indexFields = [
  // ... existing indexes ...
  { field: 'partner_id_qdrant', type: 'uuid' as const },
  { field: 'move_id_qdrant', type: 'uuid' as const },
  { field: 'account_id_qdrant', type: 'uuid' as const },
  { field: 'user_id_qdrant', type: 'uuid' as const },
  { field: 'company_id_qdrant', type: 'uuid' as const },
];
```

### Test Scenario 1.1: Verify FK Qdrant IDs in Payload

```bash
# 1. Sync a small model (crm.stage has ~15 records)
# Use MCP tool: pipeline_crm.stage_1984

# 2. Inspect a synced record
# Use inspect_record tool with model_name="crm.stage", record_id=1

# Expected output should include:
# - team_id_qdrant: "00000347-0000-0000-0000-000000000001"
# - user_id_qdrant: "00000090-0000-0000-0000-000000000045"
```

### Test Scenario 1.2: Validate UUID Format

```typescript
// Unit test for FK ID builder
describe('buildFkQdrantId', () => {
  it('builds correct UUID for res.partner FK', () => {
    const uuid = buildFkQdrantId(78, 282161);
    expect(uuid).toBe('00000078-0000-0000-0000-000000282161');
  });

  it('builds correct UUID for account.move.line FK', () => {
    const uuid = buildFkQdrantId(312, 688535);
    expect(uuid).toBe('00000312-0000-0000-0000-000000688535');
  });
});
```

### Rollback Phase 1
If issues occur, revert `pipeline-data-transformer.ts` and re-sync affected models without FK fields.

---

## Phase 2: Sync Reference Models

**Objective**: Ensure FK target records exist in Qdrant for traversal to work.

### Priority Model Sync Order

Based on FK dependencies discovered in codebase:

| Priority | Model | Est. Records | Why |
|----------|-------|--------------|-----|
| 1 | res.partner | 5,000 | Customers, vendors, contacts |
| 1 | res.users | 200 | Salespeople, created_by fields |
| 1 | res.company | 5 | Company references |
| 1 | account.account | 500 | GL accounts |
| 2 | account.journal | 20 | Journals |
| 2 | crm.stage | 15 | Pipeline stages |
| 2 | product.product | 1,000 | Products |
| 3 | account.analytic.account | 500 | Cost centers |
| 3 | account.tax | 20 | Taxes |
| 4 | crm.lead | 2,000 | Opportunities |
| 4 | account.move | 10,000 | Invoices |
| 4 | account.move.line | 50,000+ | Journal items |

### Test Scenario 2.1: Verify Reference Model Coverage

```bash
# After syncing priority 1-2 models, run:
# Use pipeline_status tool to check counts

# Expected: All reference models have records
# - res.partner: 5000+
# - res.users: 200+
# - account.account: 500+
```

### Test Scenario 2.2: FK Target Existence Check

```typescript
// Create a utility to check FK coverage
async function checkFkCoverage(modelName: string): Promise<{
  total_fk_fields: number;
  targets_synced: number;
  missing_targets: string[];
}> {
  const fields = getModelFieldsForPipeline(modelName);
  const fkFields = fields.filter(f => f.fk_location_model);

  const synced: string[] = [];
  const missing: string[] = [];

  for (const f of fkFields) {
    const count = await countPipelineData(f.fk_location_model);
    if (count > 0) synced.push(f.fk_location_model);
    else missing.push(f.fk_location_model);
  }

  return {
    total_fk_fields: fkFields.length,
    targets_synced: synced.length,
    missing_targets: [...new Set(missing)]
  };
}
```

---

## Phase 3: Graph Traversal Tool

**Objective**: Create MCP tool for navigating FK relationships.

### Step 3.1: Create Traversal Service

**File**: `src/services/graph-traverse-service.ts` (new file)

Based on [Qdrant retrieve operation](https://qdrant.tech/documentation/concepts/points/):

```typescript
export class GraphTraverseService {
  private qdrant: QdrantClient;

  /**
   * Traverse outgoing FK relationships from a starting record
   */
  async traverseOutgoing(
    startPoint: { model: string; id: number } | string,
    options: {
      follow?: 'all' | string[];  // Which FK fields to follow
      depth?: number;             // How many hops (1-5)
      includeVectorText?: boolean;
    }
  ): Promise<TraverseResult> {
    // 1. Resolve starting point to Qdrant UUID
    const startId = this.resolveStartPoint(startPoint);

    // 2. Fetch root record using Qdrant retrieve (batch ID lookup)
    const root = await this.fetchPoint(startId);

    // 3. Extract *_qdrant fields from payload
    const fkFields = this.extractFkFields(root.payload);

    // 4. Batch fetch all FK targets (efficient)
    const fkIds = fkFields.map(f => f.qdrantId);
    const targets = await this.batchFetchPoints(fkIds);

    // 5. Build result with related records
    return this.buildResult(root, fkFields, targets);
  }

  /**
   * Find incoming references (who points to this record)
   * Uses Qdrant scroll with filter on *_qdrant fields
   */
  async traverseIncoming(
    targetQdrantId: string,
    options: { limit?: number; modelFilter?: string }
  ): Promise<{ [modelName: string]: TraverseNode[] }> {
    // Scroll with filter matching any *_qdrant field
    const filter = {
      should: [
        { key: 'partner_id_qdrant', match: { value: targetQdrantId } },
        { key: 'move_id_qdrant', match: { value: targetQdrantId } },
        { key: 'account_id_qdrant', match: { value: targetQdrantId } },
        // ... other common FK fields
      ]
    };

    const results = await this.qdrant.scroll(PIPELINE_CONFIG.DATA_COLLECTION, {
      filter,
      limit: options.limit || 20,
      with_payload: true
    });

    // Group by model_name
    return this.groupByModel(results.points);
  }
}
```

### Step 3.2: Create MCP Tool Registration

**File**: `src/tools/graph-traverse-tool.ts` (new file)

```typescript
export const graphTraverseTool = {
  name: 'graph_traverse',
  description: `Navigate the Vector Knowledge Graph by traversing FK relationships.

Parameters:
- start_point: Starting record {"model": "model.name", "id": 123} OR Qdrant UUID string
- depth: Hops to traverse (1-5, default: 1)
- follow: FK fields to follow ("all" or ["partner_id", "move_id"])
- direction: "outgoing" | "incoming" | "both"`,

  inputSchema: {
    type: 'object',
    properties: {
      start_point: {
        oneOf: [
          { type: 'object', properties: { model: { type: 'string' }, id: { type: 'integer' } } },
          { type: 'string', pattern: '^[0-9]{8}-0000-0000-0000-[0-9]{12}$' }
        ]
      },
      depth: { type: 'integer', minimum: 1, maximum: 5, default: 1 },
      follow: { oneOf: [{ type: 'string', enum: ['all'] }, { type: 'array', items: { type: 'string' } }] },
      direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], default: 'outgoing' }
    },
    required: ['start_point']
  }
};
```

### Test Scenario 3.1: Outgoing Traversal

```bash
# Test: Traverse from an invoice line to related records
# Input:
{
  "start_point": {"model": "account.move.line", "id": 688535},
  "depth": 1,
  "follow": ["partner_id", "move_id", "account_id"]
}

# Expected output:
# Root: account.move.line #688535
# Related:
#   partner_id → res.partner #282161 (Wadsworth Contracting)
#   move_id → account.move #157931 (INV/2025/0169)
#   account_id → account.account #228 (DC Installation Labour)
```

### Test Scenario 3.2: Incoming Traversal

```bash
# Test: Find all records referencing a customer
# Input:
{
  "start_point": {"model": "res.partner", "id": 282161},
  "direction": "incoming",
  "limit_per_hop": 10
}

# Expected output:
# Root: res.partner #282161 (Wadsworth Contracting)
# Incoming:
#   account.move: 15 records
#   account.move.line: 45 records
#   crm.lead: 3 records
```

### Test Scenario 3.3: Graceful Degradation

When FK target not synced:
```bash
# If product.product is not synced yet
# Input: traverse account.move.line with product_id FK

# Expected:
# related.product_id: null
# missing.product_id: {
#   qdrant_id: "00000402-0000-0000-0000-000000001234",
#   display_name: "Installation Service",  # From source payload
#   reason: "not_synced"
# }
```

---

## Phase 4: Batch Retrieve Optimization

Based on [Qdrant batch operations](https://api.qdrant.tech/api-reference/search/query-batch-points), optimize FK lookups:

### Step 4.1: Batch Fetch Implementation

```typescript
/**
 * Efficiently fetch multiple points by UUID
 * Uses Qdrant's retrieve endpoint with batch IDs
 */
async batchFetchPoints(qdrantIds: string[]): Promise<Map<string, any>> {
  if (qdrantIds.length === 0) return new Map();

  // Qdrant retrieve supports batch ID lookup
  const results = await this.qdrant.retrieve(PIPELINE_CONFIG.DATA_COLLECTION, {
    ids: qdrantIds,
    with_payload: true,
    with_vector: false  // Don't need vectors for traversal
  });

  const map = new Map();
  for (const point of results) {
    map.set(point.id, point);
  }
  return map;
}
```

### Performance Benchmark

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Single point retrieve | < 50ms | Qdrant timing |
| Batch retrieve (10 points) | < 100ms | Qdrant timing |
| Batch retrieve (50 points) | < 200ms | Qdrant timing |
| Incoming scroll (20 results) | < 300ms | Qdrant timing |

---

## Phase 5: Payload Index Optimization

Based on [Qdrant payload indexing](https://qdrant.tech/documentation/concepts/indexing/):

### Step 5.1: Add UUID Index for FK Fields

The `uuid` index type is optimized for UUID values (available since Qdrant v1.11):

```typescript
// In createPipelineDataCollection()
const fkIndexFields = [
  'partner_id_qdrant',
  'move_id_qdrant',
  'account_id_qdrant',
  'journal_id_qdrant',
  'user_id_qdrant',
  'company_id_qdrant',
  'analytic_account_id_qdrant',
  'product_id_qdrant'
];

for (const field of fkIndexFields) {
  await qdrantClient.createPayloadIndex(collectionName, {
    field_name: field,
    field_schema: 'uuid'  // Memory-efficient UUID index
  });
}
```

### Test Scenario 5.1: Index Performance

```bash
# Before indexing: Filter on partner_id_qdrant
# Measure query time with 50K+ records

# After indexing: Same filter
# Expected: 5-10x faster queries
```

---

## Voyage AI Integration Notes

Based on [Voyage AI documentation](https://docs.voyageai.com/docs/embeddings):

### Current Implementation (Already Correct)
- Model: `voyage-3.5-lite` (1024 dimensions)
- Input type: `document` for data sync (already using)
- Batch size: 50 records (conservative, max is 128)
- Token limit: 1M per batch for voyage-3.5-lite

### No Changes Required
The current embedding implementation in `embedding-service.ts` follows best practices.

---

## MCP Tool Schema Design

Based on [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25):

### Tool Registration Pattern
```typescript
// Follow MCP 2025-11-25 schema
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'graph_traverse',
      description: 'Navigate FK relationships in the knowledge graph',
      inputSchema: {
        type: 'object',
        properties: { /* ... */ },
        required: ['start_point']
      }
    }
  ]
}));
```

---

## Implementation Summary

### Files to Create
1. `src/utils/fk-id-builder.ts` - UUID builder for FK targets
2. `src/services/graph-traverse-service.ts` - Traversal logic
3. `src/tools/graph-traverse-tool.ts` - MCP tool definition
4. `scripts/test-phase1-fk-payload.ts` - Phase 1 test script
5. `scripts/test-phase2-reference-models.ts` - Phase 2 test script
6. `scripts/test-phase3-traversal.ts` - Phase 3 test script

### Files to Modify
1. `src/services/pipeline-data-transformer.ts` - Add `*_qdrant` to payload
2. `src/services/vector-client.ts` - Add UUID indexes
3. `src/index.ts` - Register graph_traverse tool

### Data Migration Strategy

**Approach**: Re-sync all models after FK Qdrant ID implementation

```bash
# Phase 1 Complete → Re-sync in priority order:

# Priority 1: Reference models (run first)
pipeline_res.partner_1984
pipeline_res.users_1984
pipeline_res.company_1984
pipeline_account.account_1984

# Priority 2: Secondary reference models
pipeline_account.journal_1984
pipeline_crm.stage_1984
pipeline_product.product_1984

# Priority 3: Transactional models
pipeline_crm.lead_1984
pipeline_account.move_1984
pipeline_account.move.line_1984  # Largest - sync last
```

### Risk Mitigation
- Each phase is independent
- Can rollback by reverting code and re-syncing
- FK Qdrant IDs don't break existing functionality
- Graceful degradation for missing targets
- Test scripts verify each phase before proceeding

---

## Automated Test Scripts

### scripts/test-phase1-fk-payload.ts

```typescript
/**
 * Phase 1 Test: Verify FK Qdrant IDs in Payload
 * Run: npx ts-node scripts/test-phase1-fk-payload.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { buildFkQdrantId } from '../src/utils/fk-id-builder';

async function testPhase1() {
  console.log('=== Phase 1: FK Payload Test ===\n');

  // Test 1: UUID format validation
  console.log('Test 1: UUID format...');
  const testCases = [
    { modelId: 78, recordId: 282161, expected: '00000078-0000-0000-0000-000000282161' },
    { modelId: 312, recordId: 688535, expected: '00000312-0000-0000-0000-000000688535' },
    { modelId: 9, recordId: 1, expected: '00000009-0000-0000-0000-000000000001' },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = buildFkQdrantId(tc.modelId, tc.recordId);
    if (result === tc.expected) {
      passed++;
      console.log(`  ✅ ${tc.modelId}^${tc.recordId} → ${result}`);
    } else {
      console.log(`  ❌ ${tc.modelId}^${tc.recordId} → ${result} (expected: ${tc.expected})`);
    }
  }
  console.log(`\nTest 1 Result: ${passed}/${testCases.length} passed\n`);

  // Test 2: Verify FK fields in synced record
  console.log('Test 2: FK fields in payload...');
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
  });

  const result = await qdrant.scroll('nexsus_data', {
    filter: { must: [{ key: 'model_name', match: { value: 'crm.stage' } }] },
    limit: 1,
    with_payload: true
  });

  if (result.points.length > 0) {
    const payload = result.points[0].payload as Record<string, any>;
    const fkFields = Object.keys(payload).filter(k => k.endsWith('_qdrant'));

    if (fkFields.length > 0) {
      console.log(`  ✅ Found ${fkFields.length} FK Qdrant fields:`);
      fkFields.forEach(f => console.log(`     - ${f}: ${payload[f]}`));
    } else {
      console.log('  ❌ No *_qdrant fields found in payload');
    }
  } else {
    console.log('  ⚠️ No crm.stage records found. Run: pipeline_crm.stage_1984');
  }

  console.log('\n=== Phase 1 Test Complete ===');
}

testPhase1().catch(console.error);
```

### scripts/test-phase2-reference-models.ts

```typescript
/**
 * Phase 2 Test: Verify Reference Model Coverage
 * Run: npx ts-node scripts/test-phase2-reference-models.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const REQUIRED_MODELS = [
  { model: 'res.partner', minCount: 100, priority: 'HIGH' },
  { model: 'res.users', minCount: 10, priority: 'HIGH' },
  { model: 'res.company', minCount: 1, priority: 'HIGH' },
  { model: 'account.account', minCount: 50, priority: 'HIGH' },
  { model: 'account.journal', minCount: 5, priority: 'MEDIUM' },
  { model: 'crm.stage', minCount: 5, priority: 'MEDIUM' },
];

async function testPhase2() {
  console.log('=== Phase 2: Reference Model Coverage ===\n');

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
  });

  let passed = 0;
  let warnings = 0;

  for (const { model, minCount, priority } of REQUIRED_MODELS) {
    const count = await qdrant.count('nexsus_data', {
      filter: { must: [{ key: 'model_name', match: { value: model } }] },
      exact: true
    });

    const actual = count.count;
    if (actual >= minCount) {
      passed++;
      console.log(`  ✅ ${model}: ${actual} records (min: ${minCount})`);
    } else if (actual > 0) {
      warnings++;
      console.log(`  ⚠️ ${model}: ${actual} records (min: ${minCount}) [${priority}]`);
    } else {
      console.log(`  ❌ ${model}: NOT SYNCED [${priority}]`);
    }
  }

  console.log(`\nResult: ${passed}/${REQUIRED_MODELS.length} models ready`);
  if (warnings > 0) console.log(`Warnings: ${warnings} models below minimum`);

  console.log('\n=== Phase 2 Test Complete ===');
}

testPhase2().catch(console.error);
```

### scripts/test-phase3-traversal.ts

```typescript
/**
 * Phase 3 Test: Graph Traversal
 * Run: npx ts-node scripts/test-phase3-traversal.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';

async function testPhase3() {
  console.log('=== Phase 3: Graph Traversal Test ===\n');

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
  });

  // Test 1: Outgoing traversal
  console.log('Test 1: Outgoing traversal...');

  // Get a record with FK fields
  const records = await qdrant.scroll('nexsus_data', {
    filter: { must: [{ key: 'model_name', match: { value: 'crm.lead' } }] },
    limit: 1,
    with_payload: true
  });

  if (records.points.length > 0) {
    const payload = records.points[0].payload as Record<string, any>;
    const partnerQdrant = payload.partner_id_qdrant;

    if (partnerQdrant) {
      // Fetch the FK target
      const targets = await qdrant.retrieve('nexsus_data', {
        ids: [partnerQdrant],
        with_payload: true
      });

      if (targets.length > 0) {
        const target = targets[0].payload as Record<string, any>;
        console.log(`  ✅ Traversed: crm.lead → partner_id → ${target.model_name} #${target.record_id}`);
        console.log(`     Partner name: ${target.name || 'N/A'}`);
      } else {
        console.log(`  ⚠️ FK target not found: ${partnerQdrant}`);
        console.log('     This means res.partner is not synced yet');
      }
    } else {
      console.log('  ⚠️ No partner_id_qdrant in payload');
    }
  } else {
    console.log('  ⚠️ No crm.lead records found');
  }

  // Test 2: Incoming traversal
  console.log('\nTest 2: Incoming traversal...');

  // Find a partner and look for references
  const partners = await qdrant.scroll('nexsus_data', {
    filter: { must: [{ key: 'model_name', match: { value: 'res.partner' } }] },
    limit: 1,
    with_payload: true
  });

  if (partners.points.length > 0) {
    const partnerUuid = partners.points[0].id as string;

    // Find records that reference this partner
    const incoming = await qdrant.scroll('nexsus_data', {
      filter: {
        should: [
          { key: 'partner_id_qdrant', match: { value: partnerUuid } }
        ]
      },
      limit: 5,
      with_payload: true
    });

    if (incoming.points.length > 0) {
      console.log(`  ✅ Found ${incoming.points.length} records referencing partner ${partnerUuid}:`);
      for (const p of incoming.points) {
        const pl = p.payload as Record<string, any>;
        console.log(`     - ${pl.model_name} #${pl.record_id}`);
      }
    } else {
      console.log(`  ⚠️ No incoming references found for partner`);
    }
  }

  console.log('\n=== Phase 3 Test Complete ===');
}

testPhase3().catch(console.error);
```

### Testing Checklist

| Test | Phase | Script | Expected Outcome |
|------|-------|--------|------------------|
| FK UUID format | 1 | test-phase1 | `00000078-0000-0000-0000-000000282161` |
| FK fields in payload | 1 | test-phase1 | `partner_id_qdrant` present |
| Reference model sync | 2 | test-phase2 | res.partner, res.users have records |
| Outgoing traversal | 3 | test-phase3 | Related records returned |
| Incoming traversal | 3 | test-phase3 | Referencing records found |
| Missing target handling | 3 | test-phase3 | Graceful degradation with display_name |
| Batch fetch performance | 4 | Manual | < 100ms for 10 points |
| UUID index performance | 5 | Manual | 5-10x faster filters |
