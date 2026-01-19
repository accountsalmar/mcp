# NEXSUS 2.0 Implementation Plan (nexsus2_1984)

## Project Vision

Transform Nexsus from a semantic search tool into a **Semantic Relational Engine** that discovers and navigates Odoo model relationships.

---

## Current State Baseline

### Existing Functionality (MUST PRESERVE)

| Feature | Tool | Status |
|---------|------|--------|
| Semantic search | `nexsus semantic_search` | Working |
| Model filtering | `model_filter` param | Working |
| Field type filtering | `field_type` param | Working |
| References OUT | `search_mode: references_out` | Working |
| References IN | `search_mode: references_in` | Working |
| List mode | `search_mode: list` | Working |
| Vector ID display | In search results | Working |
| Collection sync | `nexsus_sync` | Working |
| Collection status | `nexsus_status` | Working |

### Current Collection Stats
- **Collection:** nexsus
- **Vectors:** 17,931 schema entries
- **Dimensions:** 1024 (Voyage AI voyage-3)
- **Quantization:** Scalar int8 (75% memory reduction)

---

## Implementation Milestones

## MILESTONE 1: Qdrant Recommendations API
**Target:** Add field recommendation capability
**Risk Level:** LOW (additive, no changes to existing)
**Estimated Complexity:** Small

### Todo List - Milestone 1

- [ ] **1.1** Add `recommendRelatedFields()` to `vector-client.ts`
- [ ] **1.2** Create `nexsus_recommend_fields` tool in new file `relationship-tools.ts`
- [ ] **1.3** Add tool registration in `index.ts`
- [ ] **1.4** Test new functionality
- [ ] **1.5** Regression test existing functionality

### Code Changes - Milestone 1

**File: `src/services/vector-client.ts`**
```typescript
// ADD after searchSchemaCollection function (~line 282)

/**
 * Recommend related fields based on positive/negative examples
 * Uses Qdrant's recommendation API to find similar vectors
 */
export async function recommendRelatedFields(
  positiveFieldIds: number[],
  negativeFieldIds: number[] = [],
  limit: number = 10
): Promise<VectorSearchResult[]> {
  if (!qdrantClient) throw new Error('Vector client not initialized');

  const results = await qdrantClient.recommend(NEXSUS_CONFIG.COLLECTION_NAME, {
    positive: positiveFieldIds,
    negative: negativeFieldIds,
    limit,
    with_payload: true,
    strategy: 'average_vector',
  });

  return results.map(r => ({
    id: r.id as number,
    score: r.score,
    payload: r.payload as unknown as SchemaPayload,
  }));
}
```

**File: `src/tools/relationship-tools.ts`** (NEW FILE)
```typescript
/**
 * Relationship Tools for NEXSUS 2.0
 *
 * Progressive enhancement - does not modify existing tools
 */

import { z } from 'zod';
import { recommendRelatedFields } from '../services/vector-client.js';
import type { NexsusPayload } from '../types.js';

// Schema for recommend_fields tool
export const recommendFieldsSchema = z.object({
  positive_field_ids: z.array(z.number()).min(1).describe(
    'Field IDs to use as positive examples (find similar to these)'
  ),
  negative_field_ids: z.array(z.number()).optional().describe(
    'Field IDs to avoid (find dissimilar to these)'
  ),
  limit: z.number().min(1).max(50).default(10).describe(
    'Maximum number of recommendations'
  ),
});

export type RecommendFieldsInput = z.infer<typeof recommendFieldsSchema>;

/**
 * Execute field recommendation
 */
export async function executeRecommendFields(
  input: RecommendFieldsInput
): Promise<string> {
  const { positive_field_ids, negative_field_ids = [], limit } = input;

  const results = await recommendRelatedFields(
    positive_field_ids,
    negative_field_ids,
    limit
  );

  if (results.length === 0) {
    return 'No similar fields found. Try different field IDs.';
  }

  // Format output
  const lines: string[] = [
    '## Recommended Fields',
    '',
    `Based on field IDs: ${positive_field_ids.join(', ')}`,
    negative_field_ids.length > 0 ? `Avoiding: ${negative_field_ids.join(', ')}` : '',
    '',
    '### Results:',
    '',
  ];

  results.forEach((result, index) => {
    const payload = result.payload as unknown as NexsusPayload;
    const similarity = (result.score * 100).toFixed(1);

    lines.push(`**${index + 1}. ${payload.model_name}.${payload.field_name}** (${similarity}% similar)`);
    lines.push(`   - Label: ${payload.field_label}`);
    lines.push(`   - Type: ${payload.field_type}`);
    lines.push(`   - Vector ID: ${payload.vector_id}`);
    lines.push(`   - Field ID: ${payload.field_id}`);
    if (payload.fk_location_model) {
      lines.push(`   - Links to: ${payload.fk_location_model}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
```

### Testing - Milestone 1

#### New Functionality Tests
```
TEST 1.1 - Basic Recommendation:
"Use nexsus_recommend_fields with positive_field_ids [6299, 6301] limit 5"
Expected: Returns 5 fields similar to the provided IDs

TEST 1.2 - With Negative Examples:
"Use nexsus_recommend_fields with positive_field_ids [6299] negative_field_ids [6300] limit 5"
Expected: Returns fields similar to 6299 but NOT like 6300

TEST 1.3 - Edge Case - Invalid ID:
"Use nexsus_recommend_fields with positive_field_ids [999999] limit 5"
Expected: Graceful error or empty results
```

#### Regression Tests (MUST PASS)
```
REGRESSION 1.1 - Semantic Search Still Works:
"Use nexsus semantic_search to find fields about customer"
Expected: Returns customer-related fields with vector IDs displayed

REGRESSION 1.2 - References OUT Still Works:
"Use nexsus semantic_search with query 'out' model_filter 'crm.lead' search_mode 'references_out'"
Expected: Shows outgoing relationships from crm.lead

REGRESSION 1.3 - References IN Still Works:
"Use nexsus semantic_search with query 'in' model_filter 'res.partner' search_mode 'references_in'"
Expected: Shows incoming relationships to res.partner

REGRESSION 1.4 - List Mode Still Works:
"Use nexsus semantic_search with query 'all' model_filter 'crm.lead' search_mode 'list'"
Expected: Lists all fields in crm.lead model
```

### Dependency Impact - Milestone 1
- **Depends on:** Nothing (first milestone)
- **Impacts:** Milestone 2 will use this for grouped recommendations

---

## MILESTONE 2: Search Groups by Model
**Target:** Cluster search results by model automatically
**Risk Level:** LOW (additive enhancement to search)
**Estimated Complexity:** Small

### Todo List - Milestone 2

- [ ] **2.1** Add `searchGroupedByModel()` to `vector-client.ts`
- [ ] **2.2** Add `group_by_model` parameter to semantic_search tool
- [ ] **2.3** Create new formatter `formatGroupedResults()` in `search-tool.ts`
- [ ] **2.4** Test new functionality
- [ ] **2.5** Regression test existing functionality

### Code Changes - Milestone 2

**File: `src/services/vector-client.ts`**
```typescript
// ADD after recommendRelatedFields function

/**
 * Search with results grouped by model_name
 * Uses Qdrant's search_groups for automatic clustering
 */
export async function searchGroupedByModel(
  vector: number[],
  options: {
    limit?: number;      // Number of model groups
    groupSize?: number;  // Results per model
    minScore?: number;
  } = {}
): Promise<{ modelName: string; results: VectorSearchResult[] }[]> {
  if (!qdrantClient) throw new Error('Vector client not initialized');

  const { limit = 5, groupSize = 3, minScore = 0.5 } = options;

  const response = await qdrantClient.searchPointGroups(NEXSUS_CONFIG.COLLECTION_NAME, {
    vector,
    group_by: 'model_name',
    limit,
    group_size: groupSize,
    score_threshold: minScore,
    with_payload: true,
  });

  return response.groups.map(group => ({
    modelName: group.id as string,
    results: group.hits.map(hit => ({
      id: hit.id as number,
      score: hit.score,
      payload: hit.payload as unknown as SchemaPayload,
    })),
  }));
}
```

**File: `src/tools/search-tool.ts`**
```typescript
// MODIFY: Add to schema
group_by_model: z.boolean().optional().default(false).describe(
  'Group results by model name (shows top fields per model)'
),

// ADD: New formatter function
function formatGroupedResults(
  groups: { modelName: string; results: VectorSearchResult[] }[]
): string {
  const lines: string[] = [
    '## Search Results (Grouped by Model)',
    '',
  ];

  for (const group of groups) {
    lines.push(`### ${group.modelName}`);
    lines.push('');

    for (const result of group.results) {
      const payload = result.payload as unknown as NexsusPayload;
      const score = (result.score * 100).toFixed(1);

      lines.push(`- **${payload.field_name}** (${payload.field_label}) - ${score}%`);
      lines.push(`  Type: ${payload.field_type} | Vector ID: ${payload.vector_id}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
```

### Testing - Milestone 2

#### New Functionality Tests
```
TEST 2.1 - Grouped Search:
"Use nexsus semantic_search with query 'customer email' group_by_model true"
Expected: Results grouped by model (crm.lead, res.partner, sale.order, etc.)

TEST 2.2 - Grouped Search with Limit:
"Use nexsus semantic_search with query 'amount total' group_by_model true limit 3"
Expected: Top 3 models with their matching fields
```

#### Regression Tests (MUST PASS)
```
REGRESSION 2.1 - Default Search Unchanged:
"Use nexsus semantic_search to find fields about invoice"
Expected: Normal ungrouped results (group_by_model defaults to false)

REGRESSION 2.2 - Model Filter Still Works:
"Use nexsus semantic_search with query 'partner' model_filter 'crm.lead'"
Expected: Only crm.lead fields returned

REGRESSION 2.3 - Recommendation Still Works (from M1):
"Use nexsus_recommend_fields with positive_field_ids [6299] limit 3"
Expected: Returns recommendations as before
```

### Dependency Impact - Milestone 2
- **Depends on:** Milestone 1 (tests recommendation still works)
- **Impacts:** Milestone 4 will combine grouped search with relationship graph

---

## MILESTONE 3: Bidirectional Relationship Mapping
**Target:** Build relationship graph from FK fields
**Risk Level:** MEDIUM (new service, touches sync)
**Estimated Complexity:** Medium

### Todo List - Milestone 3

- [ ] **3.1** Create `RelationshipEdge` and `RelationshipMap` types in `types.ts`
- [ ] **3.2** Create new service `src/services/relationship-mapper.ts`
- [ ] **3.3** Add `scrollAllFKFields()` helper to `vector-client.ts`
- [ ] **3.4** Implement `buildRelationshipMap()` function
- [ ] **3.5** Implement `findInverseField()` function
- [ ] **3.6** Add caching to avoid rebuilding on every request
- [ ] **3.7** Test new functionality
- [ ] **3.8** Regression test existing functionality

### Code Changes - Milestone 3

**File: `src/types.ts`**
```typescript
// ADD: Relationship types

export interface RelationshipEdge {
  sourceModel: string;
  sourceField: string;
  sourceFieldId: number;
  targetModel: string;
  targetField?: string;      // Inverse field name (if found)
  targetFieldId?: number;    // Inverse field ID (if found)
  relationshipType: 'many2one' | 'one2many' | 'many2many';
}

export interface RelationshipMap {
  edges: RelationshipEdge[];
  bySourceModel: Map<string, RelationshipEdge[]>;
  byTargetModel: Map<string, RelationshipEdge[]>;
  computedAt: string;
}
```

**File: `src/services/relationship-mapper.ts`** (NEW FILE)
```typescript
/**
 * Relationship Mapper Service
 *
 * Builds bidirectional relationship graph from nexsus schema data.
 * Caches results to avoid repeated computation.
 */

import { scrollSchemaCollection } from './vector-client.js';
import type { RelationshipEdge, RelationshipMap, NexsusPayload } from '../types.js';

// Cache for relationship map
let cachedRelationshipMap: RelationshipMap | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cacheTimestamp = 0;

/**
 * Get all FK fields from the nexsus collection
 */
async function scrollAllFKFields(): Promise<NexsusPayload[]> {
  const fkTypes = ['many2one', 'one2many', 'many2many'];
  const results: NexsusPayload[] = [];

  for (const fieldType of fkTypes) {
    const fields = await scrollSchemaCollection({
      filter: { field_type: fieldType },
      limit: 5000, // Adjust based on schema size
    });

    results.push(...fields.map(f => f.payload as unknown as NexsusPayload));
  }

  return results;
}

/**
 * Build the complete relationship map
 */
export async function buildRelationshipMap(forceRefresh = false): Promise<RelationshipMap> {
  // Return cache if valid
  if (!forceRefresh && cachedRelationshipMap && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRelationshipMap;
  }

  console.error('[RelationshipMapper] Building relationship map...');
  const fkFields = await scrollAllFKFields();
  console.error(`[RelationshipMapper] Found ${fkFields.length} FK fields`);

  const edges: RelationshipEdge[] = [];
  const bySourceModel = new Map<string, RelationshipEdge[]>();
  const byTargetModel = new Map<string, RelationshipEdge[]>();

  for (const field of fkFields) {
    if (!field.fk_location_model) continue;

    const edge: RelationshipEdge = {
      sourceModel: field.model_name,
      sourceField: field.field_name,
      sourceFieldId: field.field_id,
      targetModel: field.fk_location_model,
      relationshipType: field.field_type as 'many2one' | 'one2many' | 'many2many',
    };

    // Try to find inverse field
    if (field.field_type === 'many2one') {
      const inverse = fkFields.find(f =>
        f.model_name === field.fk_location_model &&
        f.field_type === 'one2many' &&
        f.fk_location_model === field.model_name
      );
      if (inverse) {
        edge.targetField = inverse.field_name;
        edge.targetFieldId = inverse.field_id;
      }
    }

    edges.push(edge);

    // Index by source model
    if (!bySourceModel.has(edge.sourceModel)) {
      bySourceModel.set(edge.sourceModel, []);
    }
    bySourceModel.get(edge.sourceModel)!.push(edge);

    // Index by target model
    if (!byTargetModel.has(edge.targetModel)) {
      byTargetModel.set(edge.targetModel, []);
    }
    byTargetModel.get(edge.targetModel)!.push(edge);
  }

  cachedRelationshipMap = {
    edges,
    bySourceModel,
    byTargetModel,
    computedAt: new Date().toISOString(),
  };
  cacheTimestamp = Date.now();

  console.error(`[RelationshipMapper] Built map with ${edges.length} edges`);
  return cachedRelationshipMap;
}

/**
 * Get outgoing relationships from a model
 */
export async function getOutgoingRelationships(modelName: string): Promise<RelationshipEdge[]> {
  const map = await buildRelationshipMap();
  return map.bySourceModel.get(modelName) || [];
}

/**
 * Get incoming relationships to a model
 */
export async function getIncomingRelationships(modelName: string): Promise<RelationshipEdge[]> {
  const map = await buildRelationshipMap();
  return map.byTargetModel.get(modelName) || [];
}

/**
 * Clear the relationship cache (call after sync)
 */
export function clearRelationshipCache(): void {
  cachedRelationshipMap = null;
  cacheTimestamp = 0;
}
```

### Testing - Milestone 3

#### New Functionality Tests
```
TEST 3.1 - Build Relationship Map:
(Internal test - add console logging)
Expected: Map builds with ~2000+ edges from 17,931 schema entries

TEST 3.2 - Get Outgoing Relationships:
"Use nexsus to get outgoing relationships from crm.lead"
Expected: Lists all FK fields pointing FROM crm.lead

TEST 3.3 - Get Incoming Relationships:
"Use nexsus to get incoming relationships to res.partner"
Expected: Lists all FK fields pointing TO res.partner

TEST 3.4 - Inverse Field Detection:
Expected: many2one fields show their one2many inverse where exists
```

#### Regression Tests (MUST PASS)
```
REGRESSION 3.1 - Semantic Search:
"Use nexsus semantic_search to find customer fields"
Expected: Normal search results

REGRESSION 3.2 - References OUT (existing):
"Use nexsus semantic_search query 'out' model_filter 'crm.lead' search_mode 'references_out'"
Expected: Still works (this is the OLD implementation)

REGRESSION 3.3 - Grouped Search (from M2):
"Use nexsus semantic_search query 'amount' group_by_model true"
Expected: Grouped results by model

REGRESSION 3.4 - Recommendations (from M1):
"Use nexsus_recommend_fields positive_field_ids [6299] limit 3"
Expected: Returns recommendations
```

### Dependency Impact - Milestone 3
- **Depends on:** Milestones 1 & 2 (must not break them)
- **Impacts:** Milestone 4 uses relationship map for graph visualization
- **Special:** Must call `clearRelationshipCache()` after nexsus_sync

---

## MILESTONE 4: Relationship Graph Tool
**Target:** New MCP tool to visualize model relationships
**Risk Level:** LOW (new tool, uses M3 services)
**Estimated Complexity:** Medium

### Todo List - Milestone 4

- [ ] **4.1** Add `nexsus_relationship_graph` schema to `relationship-tools.ts`
- [ ] **4.2** Implement BFS traversal for multi-hop exploration
- [ ] **4.3** Create tree-style output formatter
- [ ] **4.4** Register tool in `index.ts`
- [ ] **4.5** Test new functionality
- [ ] **4.6** Regression test all previous milestones

### Testing - Milestone 4

#### New Functionality Tests
```
TEST 4.1 - Basic Graph:
"Use nexsus_relationship_graph for model 'crm.lead' with max_hops 1"
Expected: Shows direct connections (partner_id → res.partner, etc.)

TEST 4.2 - Extended Graph:
"Use nexsus_relationship_graph for model 'crm.lead' with max_hops 2 direction 'both'"
Expected: Shows 2-hop network with tree visualization

TEST 4.3 - Incoming Only:
"Use nexsus_relationship_graph for model 'res.partner' direction 'incoming'"
Expected: Shows all models that point TO res.partner
```

#### Regression Tests (MUST PASS)
```
REGRESSION 4.1-4.4: Run all tests from Milestones 1-3
```

---

## MILESTONE 5: Anchor Points Detection
**Target:** Identify hub models in schema
**Risk Level:** LOW (analysis only, read-only)
**Estimated Complexity:** Small

### Todo List - Milestone 5

- [ ] **5.1** Create `identifyAnchorPoints()` in `relationship-mapper.ts`
- [ ] **5.2** Add `nexsus_anchor_points` tool to `relationship-tools.ts`
- [ ] **5.3** Register tool in `index.ts`
- [ ] **5.4** Test new functionality
- [ ] **5.5** Full regression test suite

### Testing - Milestone 5

#### New Functionality Tests
```
TEST 5.1 - Identify Hubs:
"Use nexsus_anchor_points with min_connections 10"
Expected: Lists res.partner, res.users, product.product as top hubs

TEST 5.2 - With Details:
"Use nexsus_anchor_points min_connections 5 include_details true"
Expected: Shows connected models for each hub
```

---

## Full Regression Test Suite

Run this complete suite after EACH milestone:

```
=== CORE FUNCTIONALITY ===

1. "Use nexsus semantic_search to find fields about customer email"
   Expected: Returns customer/email related fields

2. "Use nexsus semantic_search query 'partner' model_filter 'crm.lead'"
   Expected: Only crm.lead fields returned

3. "Use nexsus semantic_search query 'amount' field_type 'float'"
   Expected: Only float fields related to amounts

4. "Use nexsus semantic_search query 'out' model_filter 'crm.lead' search_mode 'references_out'"
   Expected: Outgoing FK relationships from crm.lead

5. "Use nexsus semantic_search query 'in' model_filter 'res.partner' search_mode 'references_in'"
   Expected: Incoming FK relationships to res.partner

6. "Use nexsus semantic_search query 'all' model_filter 'sale.order' search_mode 'list'"
   Expected: All fields in sale.order listed

7. "Use nexsus_status"
   Expected: Shows collection status with vector count

=== MILESTONE 1: RECOMMENDATIONS ===

8. "Use nexsus_recommend_fields positive_field_ids [6299, 6301] limit 5"
   Expected: Returns 5 similar fields

=== MILESTONE 2: GROUPED SEARCH ===

9. "Use nexsus semantic_search query 'invoice total' group_by_model true"
   Expected: Results grouped by model

=== MILESTONE 3: RELATIONSHIP MAP ===

10. Internal: Verify relationship map builds without errors

=== MILESTONE 4: RELATIONSHIP GRAPH ===

11. "Use nexsus_relationship_graph model 'crm.lead' max_hops 2"
    Expected: Tree visualization of relationships

=== MILESTONE 5: ANCHOR POINTS ===

12. "Use nexsus_anchor_points min_connections 10"
    Expected: Hub models listed with connection counts
```

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing search | HIGH | LOW | Regression tests after each milestone |
| Performance degradation | MEDIUM | MEDIUM | Cache relationship map, lazy loading |
| Qdrant API incompatibility | MEDIUM | LOW | Check Qdrant JS client version |
| Memory issues with large graphs | MEDIUM | MEDIUM | Limit max_hops, pagination |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-XX-XX | Initial NEXSUS 2.0 plan |

---

## Notes for Implementation

1. **Always commit after each milestone** - Easy rollback if issues
2. **Run full regression suite** - Before moving to next milestone
3. **Update CLAUDE.md** - Document new tools as they're added
4. **Monitor Railway logs** - Watch for errors after deployment
5. **Keep backward compatibility** - New parameters should have defaults

