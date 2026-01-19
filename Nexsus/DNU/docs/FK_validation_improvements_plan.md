# Nexsus Data Intelligence System - Implementation Plan

## Vision
Build a comprehensive FK validation and data intelligence system that combines **structural relationships** (knowledge graph) with **semantic similarity** (vector embeddings) to create a self-aware, self-learning data grid.

---

## Phase Overview

| Phase | Name | Status | Goal |
|-------|------|--------|------|
| 1 | Graph-Enhanced FK Validation | ✅ COMPLETED | Use graph to guide validation, store orphan info |
| 2 | Bidirectional Consistency Check | ✅ COMPLETED | Verify A→B and B→A are consistent |
| 3 | Pattern Extraction | ✅ COMPLETED | Extract relationship patterns for ML training |
| 4 | Same-Model Similarity | ✅ COMPLETED | Find duplicates/similar records within model |
| 5 | Unified Data Grid | 📋 PENDING | Combine semantic + structural intelligence |

---

## Phase 1: Graph-Enhanced FK Validation

### Goal
Enhance existing FK validation to use knowledge graph edges for smarter, faster validation.

### Changes

**1. Add Types in `src/types.ts`**
```typescript
interface OrphanInfo {
  source_model: string;
  source_record_id: number;
  fk_field: string;
  missing_target_model: string;
  missing_target_id: number;
  missing_uuid: string;
  detected_at: string;
}

interface ValidationReport {
  model_name: string;
  total_records: number;
  fk_fields_validated: Array<{
    field_name: string;
    target_model: string;
    total_references: number;
    missing_count: number;
    orphan_samples: OrphanInfo[];
  }>;
  integrity_score: number;
  graph_metadata_used: boolean;
}
```

**2. Enhance `src/sync/commands/validate-fk.ts`**
- Query knowledge graph FIRST to get FK fields (instead of scanning payloads)
- Use `getModelRelationships(modelName)` from knowledge-graph.ts
- Store validation results in graph payload

**3. Extend Graph Payload in `src/services/knowledge-graph.ts`**
Add to RelationshipPayload:
```typescript
last_validation?: string;
orphan_count?: number;
integrity_score?: number;
validation_samples?: OrphanInfo[];
```

**4. CLI Enhancement**
```bash
npm run sync -- validate-fk --model crm.lead --store-orphans
```

### Validation Checkpoint
- [ ] Run validate-fk on model with known orphans
- [ ] Verify graph edges are used to find FK fields
- [ ] Verify orphan info stored in graph payload
- [ ] Verify validation is faster (fewer Qdrant queries)

### Files to Modify
- `src/types.ts` - Add new interfaces
- `src/sync/commands/validate-fk.ts` - Enhance validation logic
- `src/services/knowledge-graph.ts` - Add validation metadata

---

## Phase 2: Bidirectional Consistency Check (Performance-First Design)

### Goal
Verify FK relationships are consistent in both directions **WITHOUT impacting data upload**.

### Key Design Decisions

**1. NO new service file** - Extend existing validate-fk.ts (less code, reuses infrastructure)

**2. POST-SYNC only** - Never runs during data upload, always CLI invoked

**3. Lightweight comparison** - Compare graph metadata vs actual data, don't re-scan everything

**4. Optional --fix** - Repair discrepancies by updating graph edge metadata

---

### What "Bidirectional" Means

```
Forward Check (Data → Graph):
  - Count actual *_qdrant references in data points
  - Compare with graph edge's edge_count
  - If mismatch: graph edge is stale

Reverse Check (Graph → Data):
  - Graph edge says "partner_id → res.partner has 5000 edges"
  - Validate that target records actually exist
  - Uses existing orphan detection from Phase 1
```

---

### Changes

**1. Add Types in `src/types.ts`**
```typescript
interface ConsistencyResult {
  /** Graph edge UUID */
  edge_id: string;
  source_model: string;
  target_model: string;
  field_name: string;

  /** Forward check: Data → Graph */
  actual_fk_count: number;      // Counted from data points
  graph_edge_count: number;     // Stored in graph edge
  forward_consistent: boolean;  // actual == graph (within tolerance)

  /** Reverse check: Graph → Data (orphan detection) */
  orphan_count: number;         // From Phase 1 validation
  reverse_consistent: boolean;  // orphan_count == 0

  /** Summary */
  is_consistent: boolean;       // Both directions pass
  discrepancy_type?: 'stale_graph' | 'orphan_fks' | 'both';
}
```

**2. Extend `src/sync/commands/validate-fk.ts`**

Add `--bidirectional` flag that:
1. Runs Phase 1 validation first (get orphan counts)
2. Then compares graph `edge_count` with actual FK counts
3. Reports discrepancies
4. With `--fix`: updates graph edges to match reality

```typescript
// Add to ValidateFkOptions
interface ValidateFkOptions {
  model?: string;
  fix: boolean;
  limit: string;
  storeOrphans: boolean;
  bidirectional: boolean;  // NEW
}

// New function in validate-fk.ts
async function checkBidirectionalConsistency(
  client: QdrantClient,
  modelName: string,
  validationResult: FkValidationResult,  // From Phase 1
  graphRelationships: RelationshipInfo[]
): Promise<ConsistencyResult[]>
```

**3. CLI Command**
```bash
# Standard validation (Phase 1 - already works)
npm run sync -- validate-fk --model account.move.line

# Bidirectional check (Phase 2)
npm run sync -- validate-fk --bidirectional

# Fix discrepancies
npm run sync -- validate-fk --bidirectional --fix
```

---

### Implementation Logic

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Run Phase 1 Validation (existing code)                 │
│  ───────────────────────────────────────────────────────────────│
│  • Get FK fields from graph (getModelRelationships)             │
│  • Scroll data points, count *_qdrant references                │
│  • Check if target UUIDs exist (orphan detection)               │
│  • Result: total_fk_references, missing_references              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Forward Consistency (Data → Graph)                     │
│  ───────────────────────────────────────────────────────────────│
│  • For each FK field, compare:                                  │
│    - actual_count (from Phase 1 scroll)                         │
│    - graph.edge_count (stored in graph edge)                    │
│  • Allow ±5% tolerance for incremental syncs                    │
│  • Flag if actual_count >> graph.edge_count (stale graph)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Reverse Consistency (Graph → Data)                     │
│  ───────────────────────────────────────────────────────────────│
│  • Already done in Phase 1 (orphan detection)                   │
│  • If orphan_count > 0, reverse is inconsistent                 │
│  • Graph says "target exists" but target record missing         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Report & Fix (Optional)                                │
│  ───────────────────────────────────────────────────────────────│
│  • Report: Show all discrepancies with types                    │
│  • Fix (--fix flag):                                            │
│    - Update graph edge_count to match actual                    │
│    - Update orphan_count in graph edge                          │
│    - NO re-embedding (just payload update)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

### Performance Guarantee

| Operation | During Sync | During validate-fk |
|-----------|-------------|-------------------|
| Data upload | ✅ Critical path | ❌ Never |
| Graph edge creation | ✅ After upload | ❌ Never |
| Bidirectional check | ❌ Never | ✅ Post-sync only |
| Graph edge fix | ❌ Never | ✅ Optional --fix |

**Key:** All Phase 2 operations are CLI-invoked, POST-SYNC only. Zero impact on data upload.

---

### Validation Checkpoint
- [ ] Run `validate-fk --bidirectional` on synced model
- [ ] Verify it detects stale graph edges (edge_count mismatch)
- [ ] Verify it reports orphans from Phase 1
- [ ] Run with `--fix` and verify graph edges updated
- [ ] Re-run check - should pass

### Files to Modify
- `src/types.ts` - Add ConsistencyResult interface
- `src/sync/commands/validate-fk.ts` - Add bidirectional logic
- `src/sync/index.ts` - Add --bidirectional CLI flag

---

## Phase 3: Pattern Extraction (Redesigned with Phase 1 & 2 Learnings)

### Goal
Extract FK traversal patterns for ML training - enabling the system to "remember and learn the relationship and flow of FK traversal."

### Key Learnings Applied
1. **Reuse existing infrastructure** - No new service files, extend validate-fk.ts
2. **Store in graph edges** - Add optional pattern fields to RelationshipPayload
3. **POST-SYNC only** - All pattern extraction via CLI command
4. **ML-friendly export** - JSON format with models, edges, correlations

---

### Pattern Types to Extract

#### A. Cardinality Patterns (Per Edge)
```typescript
type CardinalityClass =
  | 'one_to_one'   // ratio >= 0.95 (almost unique references)
  | 'one_to_few'   // ratio 0.2-0.95 (1-5 refs per target)
  | 'one_to_many'; // ratio < 0.2 (many refs per target)

// Calculated: ratio = unique_targets / edge_count
```

#### B. Model Role Patterns
```typescript
type ModelRole =
  | 'hub'       // High in + out: central entity (res.partner)
  | 'source'    // High out, low in: originators (crm.lead)
  | 'sink'      // High in, low out: aggregation (account.account)
  | 'leaf'      // Zero out: terminal nodes (crm.stage)
  | 'bridge'    // Connects otherwise unconnected clusters
  | 'isolated'; // Few total connections
```

#### C. Validation History (Rolling Window)
```typescript
interface ValidationHistoryEntry {
  timestamp: string;
  integrity_score: number;
  orphan_count: number;
  edge_count: number;
  delta_from_previous: number;  // Track trend
}
// Store last 10 entries per edge for trend analysis
```

#### D. Integrity Trend
```typescript
integrity_trend: 'improving' | 'stable' | 'degrading'
// Computed from validation_history slope
```

---

### Changes

**1. Add Types in `src/types.ts`**

```typescript
// Cardinality classification
export type CardinalityClass = 'one_to_one' | 'one_to_few' | 'one_to_many';

// Model role classification
export type ModelRole = 'hub' | 'source' | 'sink' | 'leaf' | 'bridge' | 'isolated';

// Validation history entry
export interface ValidationHistoryEntry {
  timestamp: string;
  integrity_score: number;
  orphan_count: number;
  edge_count: number;
  delta_from_previous: number;
}

// Edge pattern metadata (added to RelationshipPayload)
export interface EdgePatternMetadata {
  cardinality_class: CardinalityClass;
  cardinality_ratio: number;
  avg_refs_per_target: number;
  validation_history?: ValidationHistoryEntry[];
  integrity_trend?: 'improving' | 'stable' | 'degrading';
}

// Model pattern metadata
export interface ModelPatternMetadata {
  model_name: string;
  model_id: number;
  role: ModelRole;
  incoming_degree: number;
  outgoing_degree: number;
  total_degree: number;
  avg_integrity_score: number;
  worst_fk_field?: string;
  worst_integrity_score?: number;
  validation_count: number;
}

// ML training export format
export interface PatternExport {
  export_timestamp: string;
  version: string;
  models: ModelPatternMetadata[];
  edges: Array<RelationshipPayload & EdgePatternMetadata>;
  summary: {
    total_models: number;
    total_edges: number;
    hubs: string[];
    sources: string[];
    sinks: string[];
    leaves: string[];
    avg_global_integrity: number;
  };
}
```

**2. Extend RelationshipPayload in `src/types.ts`**

Add optional pattern fields:
```typescript
export interface RelationshipPayload {
  // ... existing fields ...

  // Pattern metadata (Phase 3)
  cardinality_class?: CardinalityClass;
  cardinality_ratio?: number;
  avg_refs_per_target?: number;
  validation_history?: ValidationHistoryEntry[];
  integrity_trend?: 'improving' | 'stable' | 'degrading';
}
```

**3. Add Functions in `src/services/knowledge-graph.ts`**

```typescript
// Classify cardinality from edge_count and unique_targets
export function classifyCardinality(
  edgeCount: number,
  uniqueTargets: number
): { class: CardinalityClass; ratio: number; avgRefs: number }

// Classify model role from in/out degree
export function classifyModelRole(
  incomingDegree: number,
  outgoingDegree: number
): ModelRole

// Append validation entry to history (rolling window of 10)
export async function appendValidationHistory(
  pointId: string,
  entry: Omit<ValidationHistoryEntry, 'delta_from_previous'>
): Promise<void>

// Compute trend from history
export function computeIntegrityTrend(
  history: ValidationHistoryEntry[]
): 'improving' | 'stable' | 'degrading'

// Get model pattern metadata
export async function getModelPattern(modelName: string): Promise<ModelPatternMetadata>

// Export all patterns for ML training
export async function exportPatterns(): Promise<PatternExport>
```

**4. Extend `src/sync/commands/validate-fk.ts`**

Add CLI flags:
```bash
--extract-patterns    Extract cardinality and role patterns during validation
--track-history       Append to validation history (enables trend analysis)
```

Integration points:
- After per-field FK stats collected, compute cardinality class
- After validation complete, update graph edges with pattern metadata
- If --track-history, append to validation_history array

**5. Add CLI Command in `src/sync/index.ts`**

```typescript
program
  .command('analyze-patterns')
  .description('Analyze and export FK patterns for ML training')
  .option('--model <model_name>', 'Analyze specific model only')
  .option('--export <format>', 'Export format: json or csv', 'json')
  .option('--output <path>', 'Output file path', 'data/patterns_export.json')
  .option('--verbose', 'Show detailed pattern analysis')
  .action(analyzePatternsCommand);
```

**6. Create `src/sync/commands/analyze-patterns.ts`** (NEW)

Main command implementation:
1. Scroll through all graph edges
2. Compute cardinality class for each edge
3. Compute model roles from in/out degrees
4. Aggregate into PatternExport format
5. Write to output file

---

### CLI Usage

```bash
# Extract patterns during validation
npm run sync -- validate-fk --extract-patterns --track-history

# Dedicated pattern analysis with export
npm run sync -- analyze-patterns --output data/ml_training.json --verbose

# Analyze specific model
npm run sync -- analyze-patterns --model account.move.line
```

---

### Sample ML Export Output

```json
{
  "export_timestamp": "2025-12-29T10:00:00Z",
  "version": "1.0.0",
  "models": [
    {
      "model_name": "res.partner",
      "role": "hub",
      "incoming_degree": 47,
      "outgoing_degree": 12,
      "avg_integrity_score": 98.5
    }
  ],
  "edges": [
    {
      "source_model": "account.move.line",
      "target_model": "res.partner",
      "field_name": "partner_id",
      "cardinality_class": "one_to_many",
      "cardinality_ratio": 0.177,
      "integrity_trend": "stable"
    }
  ],
  "summary": {
    "total_models": 45,
    "total_edges": 312,
    "hubs": ["res.partner", "res.users"],
    "avg_global_integrity": 97.8
  }
}
```

---

### Performance Guarantee

| Operation | During Sync | During CLI |
|-----------|-------------|------------|
| Data upload | ✅ Critical path | ❌ Never |
| Pattern extraction | ❌ Never | ✅ Post-sync only |
| History tracking | ❌ Never | ✅ Optional flag |
| ML export | ❌ Never | ✅ analyze-patterns |

---

### Validation Checkpoint
- [ ] `classifyCardinality(100, 95)` returns 'one_to_one'
- [ ] `classifyCardinality(1000, 50)` returns 'one_to_many'
- [ ] `classifyModelRole(50, 3)` returns 'sink'
- [ ] `classifyModelRole(5, 50)` returns 'source'
- [ ] validate-fk --extract-patterns stores cardinality_class
- [ ] validate-fk --track-history appends to validation_history
- [ ] analyze-patterns --output exports valid JSON
- [ ] Build succeeds with all new types

### Files to Modify
- `src/types.ts` - Add pattern interfaces (~6 new types)
- `src/services/knowledge-graph.ts` - Add 6 pattern functions
- `src/sync/commands/validate-fk.ts` - Integrate pattern extraction
- `src/sync/index.ts` - Add analyze-patterns command

### Files to Create
- `src/sync/commands/analyze-patterns.ts` - Pattern analysis command

---

## Phase 4: Same-Model Similarity (Redesigned with Infrastructure Learnings)

### Goal
Find similar/duplicate records within the same model using existing vector embeddings.

### Key Insight
**We don't need to re-embed.** Each data point already has a 1024-dimensional Voyage AI vector stored in Qdrant. We can:
1. Retrieve the reference record's vector
2. Search for similar vectors within the same model
3. Return ranked results by similarity score

This is much faster than re-embedding and provides exact reproducibility.

---

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  find_similar MCP Tool                                           │
│  ────────────────────────────────────────────────────────────────│
│  Input: point_id (UUID) or model_name + record_id                │
│                                                                  │
│  Step 1: Retrieve reference point WITH vector                    │
│  Step 2: Extract model_name from UUID (if not provided)          │
│  Step 3: Qdrant search() with reference vector                   │
│  Step 4: Filter by model_name + point_type='data'                │
│  Step 5: Exclude self from results                               │
│  Step 6: Optional graph boost for connection-aware ranking       │
│                                                                  │
│  Output: Similar records with similarity_score (0-1)             │
└──────────────────────────────────────────────────────────────────┘
```

---

### Changes

**1. Add Types in `src/types.ts`**

```typescript
/**
 * A similar record found within the same model
 */
export interface SimilarRecord {
  /** Qdrant UUID of the similar record */
  point_id: string;
  /** Odoo record ID */
  record_id: number;
  /** Model name */
  model_name: string;
  /** Cosine similarity score (0-1, higher = more similar) */
  similarity_score: number;
  /** Key payload fields for comparison */
  payload_summary: Record<string, unknown>;
  /** Optional: Graph connection count */
  connection_count?: number;
}

/**
 * Result of find_similar tool
 */
export interface SimilaritySearchResult {
  /** Reference record that was searched from */
  reference_point_id: string;
  reference_record_id: number;
  model_name: string;
  /** Similar records found */
  similar_records: SimilarRecord[];
  /** Total records in model (for context) */
  total_model_records: number;
  /** Search parameters used */
  search_params: {
    limit: number;
    min_similarity: number;
    graph_boost_applied: boolean;
  };
  /** Search duration in ms */
  search_time_ms: number;
}
```

**2. Add Function in `src/services/vector-client.ts`**

```typescript
/**
 * Find records similar to a reference record within the same model
 * Uses the reference record's existing vector (no re-embedding needed)
 */
export async function findSimilarRecords(
  referencePointId: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    modelName?: string;  // Auto-extracted from UUID if not provided
    applyGraphBoost?: boolean;
  }
): Promise<SimilaritySearchResult>
```

**Implementation Logic:**
```typescript
async function findSimilarRecords(referencePointId, options = {}) {
  const { limit = 10, minSimilarity = 0.5, applyGraphBoost = false } = options;

  // 1. Retrieve reference point with its vector
  const refPoint = await client.retrieve(collectionName, {
    ids: [referencePointId],
    with_payload: true,
    with_vector: true,  // CRITICAL: Get the vector
  });

  if (!refPoint.length || !refPoint[0].vector) {
    throw new Error('Reference point not found or has no vector');
  }

  const refPayload = refPoint[0].payload;
  const modelName = options.modelName || refPayload.model_name;

  // 2. Search for similar vectors within same model
  const results = await client.search(collectionName, {
    vector: refPoint[0].vector,
    limit: limit + 1,  // +1 to account for self
    score_threshold: minSimilarity,
    filter: {
      must: [
        { key: 'point_type', match: { value: 'data' } },
        { key: 'model_name', match: { value: modelName } },
      ],
    },
    with_payload: true,
  });

  // 3. Filter out self and format results
  const similarRecords = results
    .filter(r => r.id !== referencePointId)
    .slice(0, limit)
    .map(r => ({
      point_id: r.id,
      record_id: r.payload.record_id,
      model_name: r.payload.model_name,
      similarity_score: r.score,
      payload_summary: extractPayloadSummary(r.payload),
    }));

  // 4. Optional: Apply graph boost
  if (applyGraphBoost) {
    await applyGraphBoostToResults(similarRecords, modelName);
  }

  return {
    reference_point_id: referencePointId,
    reference_record_id: refPayload.record_id,
    model_name: modelName,
    similar_records: similarRecords,
    ...
  };
}
```

**3. Add MCP Tool in `src/tools/search-tool.ts`**

```typescript
server.tool(
  'find_similar',
  'Find records similar to a reference record within the same model',
  {
    point_id: z.string().optional().describe('Qdrant UUID of reference record'),
    model_name: z.string().optional().describe('Model name (e.g., "crm.lead")'),
    record_id: z.number().optional().describe('Odoo record ID'),
    limit: z.number().optional().default(10).describe('Max results'),
    min_similarity: z.number().optional().default(0.5).describe('Min similarity score (0-1)'),
    graph_boost: z.boolean().optional().default(false).describe('Rank by connections'),
  },
  async (input) => {
    // Build point_id from model_name + record_id if not provided
    const pointId = input.point_id || buildDataUuidV2(modelId, input.record_id);

    const result = await findSimilarRecords(pointId, {
      limit: input.limit,
      minSimilarity: input.min_similarity,
      applyGraphBoost: input.graph_boost,
    });

    return formatSimilarityResults(result);
  }
);
```

---

### CLI Command (Optional)

```bash
# Find similar records via CLI
npm run sync -- find-similar --model crm.lead --record-id 12345 --limit 10
```

---

### Use Cases

| Use Case | Example |
|----------|---------|
| **Find duplicates** | "Find leads similar to lead 12345" |
| **Pattern discovery** | "What other partners look like this one?" |
| **Data quality** | "Are there duplicate journal entries?" |
| **Recommendation** | "Similar products to product 456" |

---

### Performance

| Metric | Value |
|--------|-------|
| Vector retrieval | ~10ms (single point) |
| Similarity search | ~50ms (HNSW with ef=128) |
| Total response | <100ms for 10 results |
| Memory | Uses existing vectors (no new storage) |

---

### Validation Checkpoint
- [ ] `findSimilarRecords()` retrieves reference vector correctly
- [ ] Search returns results within same model only
- [ ] Self is excluded from results
- [ ] Similarity scores are in correct range (0-1)
- [ ] MCP tool `find_similar` works from Claude
- [ ] Optional graph_boost affects ranking

### Files to Modify
- `src/types.ts` - Add SimilarRecord, SimilaritySearchResult
- `src/services/vector-client.ts` - Add findSimilarRecords()
- `src/tools/search-tool.ts` - Add find_similar MCP tool

### Files to Create
- None (extend existing files)

---

## Phase 5: Unified Data Grid (Comprehensive Design)

### Goal
Combine semantic search + structural relationships + validation status + similarity into a unified query interface that provides "intelligent" query results with full context.

### Key Design Principles (From Previous Phases)

1. **Extend existing tools** - Enhance nexsus_search rather than creating new tool
2. **Optional enrichment** - Each intelligence layer is opt-in via flags
3. **Performance-conscious** - Parallel fetches where possible, caching
4. **No sync impact** - All enrichment happens at query time

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UNIFIED DATA GRID QUERY                                                    │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Input: nexsus_search with optional enrichment flags                        │
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │  Semantic   │   │   Graph     │   │ Validation  │   │ Similarity  │     │
│  │   Search    │   │  Context    │   │   Status    │   │   Matches   │     │
│  │             │   │             │   │             │   │             │     │
│  │ vector      │   │ FK paths    │   │ orphan FKs  │   │ find_similar│     │
│  │ similarity  │   │ connections │   │ integrity   │   │ per record  │     │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘     │
│         │                 │                 │                 │             │
│         └─────────────────┴────────┬────────┴─────────────────┘             │
│                                    │                                        │
│                          ┌─────────▼─────────┐                              │
│                          │  DataGridResult   │                              │
│                          │  (enriched)       │                              │
│                          └───────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Changes

**1. Add Types in `src/types.ts`**

```typescript
// =============================================================================
// UNIFIED DATA GRID TYPES (Phase 5)
// =============================================================================

/**
 * Enrichment options for data grid queries
 */
export interface DataGridEnrichment {
  /** Include FK relationship context from knowledge graph */
  include_graph_context?: boolean;
  /** Include validation status (orphan FKs, integrity score) */
  include_validation_status?: boolean;
  /** Include similar records within same model */
  include_similar?: boolean;
  /** Number of similar records to include per result (default: 3) */
  similar_limit?: number;
}

/**
 * Graph context for a record
 */
export interface RecordGraphContext {
  /** Outgoing FK relationships from this record */
  outgoing_fks: Array<{
    field_name: string;
    target_model: string;
    target_record_id: number | null;
    target_qdrant_id: string | null;
  }>;
  /** Count of incoming references TO this record */
  incoming_reference_count: number;
  /** Models that reference this record */
  referencing_models: string[];
  /** Total connection count (for ranking) */
  total_connections: number;
}

/**
 * Validation status for a record
 */
export interface RecordValidationStatus {
  /** Does this record have orphan FK references? */
  has_orphan_fks: boolean;
  /** List of orphan FK fields */
  orphan_fk_fields: string[];
  /** Integrity score (100 = all FKs valid) */
  integrity_score: number;
  /** Last validation timestamp (if available) */
  last_validated?: string;
}

/**
 * Similar record summary (lighter than full SimilarRecord)
 */
export interface SimilarRecordSummary {
  record_id: number;
  similarity_score: number;
  name?: string;
}

/**
 * Enriched record in data grid result
 */
export interface EnrichedRecord {
  /** Original record data */
  record: Record<string, unknown>;
  /** Qdrant point ID */
  point_id: string;
  /** Semantic similarity score (if from search) */
  semantic_score?: number;
  /** Graph context (if include_graph_context=true) */
  graph_context?: RecordGraphContext;
  /** Validation status (if include_validation_status=true) */
  validation_status?: RecordValidationStatus;
  /** Similar records (if include_similar=true) */
  similar_records?: SimilarRecordSummary[];
}

/**
 * Data grid query result
 */
export interface DataGridResult {
  /** Model being queried */
  model_name: string;
  /** Enriched records */
  records: EnrichedRecord[];
  /** Aggregation results (if requested) */
  aggregations?: Record<string, number>;
  /** Total matching records (before limit) */
  total_records: number;
  /** Query execution time */
  query_time_ms: number;
  /** Which intelligence layers were used */
  intelligence_used: {
    semantic: boolean;
    graph: boolean;
    validation: boolean;
    similarity: boolean;
  };
  /** Performance breakdown */
  timing_breakdown?: {
    search_ms: number;
    graph_enrichment_ms: number;
    validation_enrichment_ms: number;
    similarity_enrichment_ms: number;
  };
}
```

**2. Create `src/services/data-grid.ts`**

Core service that orchestrates enrichment:

```typescript
/**
 * Data Grid Service
 *
 * Orchestrates enrichment of search results with graph context,
 * validation status, and similar records.
 *
 * Design: All enrichment is optional and happens in parallel where possible.
 */

import { getModelRelationships, countIncomingReferences } from './knowledge-graph.js';
import { findSimilarRecords } from './vector-client.js';
import type {
  EnrichedRecord,
  RecordGraphContext,
  RecordValidationStatus,
  SimilarRecordSummary,
  DataGridEnrichment,
} from '../types.js';

/**
 * Enrich a single record with optional intelligence layers
 */
export async function enrichRecord(
  record: Record<string, unknown>,
  pointId: string,
  modelName: string,
  enrichment: DataGridEnrichment
): Promise<EnrichedRecord>

/**
 * Enrich multiple records in parallel
 */
export async function enrichRecords(
  records: Array<{ record: Record<string, unknown>; pointId: string; score?: number }>,
  modelName: string,
  enrichment: DataGridEnrichment
): Promise<EnrichedRecord[]>

/**
 * Get graph context for a record
 */
async function getRecordGraphContext(
  record: Record<string, unknown>,
  modelName: string
): Promise<RecordGraphContext>

/**
 * Get validation status for a record
 */
async function getRecordValidationStatus(
  record: Record<string, unknown>,
  modelName: string
): Promise<RecordValidationStatus>

/**
 * Get similar records summary
 */
async function getSimilarRecordsSummary(
  pointId: string,
  limit: number
): Promise<SimilarRecordSummary[]>
```

**3. Enhance `src/tools/nexsus-search.ts`**

Add enrichment parameters to existing nexsus_search tool:

```typescript
// Add to NexsusSearchSchema
include_graph_context: z.boolean().optional().default(false)
  .describe('Include FK relationships and connection counts'),
include_validation_status: z.boolean().optional().default(false)
  .describe('Include orphan FK detection and integrity score'),
include_similar: z.boolean().optional().default(false)
  .describe('Include similar records within same model'),
similar_limit: z.number().optional().default(3)
  .describe('Number of similar records per result (max 5)'),
```

Integration in handler:
```typescript
// After getting search results...
if (input.include_graph_context || input.include_validation_status || input.include_similar) {
  const enrichment: DataGridEnrichment = {
    include_graph_context: input.include_graph_context,
    include_validation_status: input.include_validation_status,
    include_similar: input.include_similar,
    similar_limit: Math.min(input.similar_limit || 3, 5),
  };

  enrichedRecords = await enrichRecords(searchResults, modelName, enrichment);
}
```

---

### Implementation Logic

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Execute Base Query (existing nexsus_search)            │
│  ───────────────────────────────────────────────────────────────│
│  • Semantic search OR filter-based retrieval                    │
│  • Aggregations if requested                                    │
│  • Returns: records[], total_count, aggregations                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Check Enrichment Flags                                 │
│  ───────────────────────────────────────────────────────────────│
│  • If no enrichment flags → return base results                 │
│  • Otherwise → proceed to enrichment                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Parallel Enrichment (Promise.all)                      │
│  ───────────────────────────────────────────────────────────────│
│  • For each record in results:                                  │
│    ├─ [if graph] getRecordGraphContext()                        │
│    ├─ [if validation] getRecordValidationStatus()               │
│    └─ [if similar] getSimilarRecordsSummary()                   │
│  • Batch where possible (e.g., all graph contexts together)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Format & Return DataGridResult                         │
│  ───────────────────────────────────────────────────────────────│
│  • Combine base record with enrichments                         │
│  • Include timing breakdown                                     │
│  • Flag which intelligence layers were used                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### CLI Usage Examples

```bash
# Basic search (no enrichment)
nexsus_search: { "model_name": "crm.lead", "limit": 10 }

# With graph context
nexsus_search: {
  "model_name": "crm.lead",
  "limit": 10,
  "include_graph_context": true
}

# With validation status (detect orphan FKs)
nexsus_search: {
  "model_name": "account.move.line",
  "filters": [{ "field": "partner_id", "operator": "!=", "value": null }],
  "include_validation_status": true
}

# Full data grid (all intelligence layers)
nexsus_search: {
  "query": "hospital projects Victoria",
  "model_name": "crm.lead",
  "include_graph_context": true,
  "include_validation_status": true,
  "include_similar": true,
  "similar_limit": 3
}
```

---

### Sample Output (Full Data Grid)

```json
{
  "model_name": "crm.lead",
  "records": [
    {
      "record": {
        "record_id": 12345,
        "name": "Hospital Project - Royal Melbourne",
        "expected_revenue": 450000,
        "partner_id": 286798,
        "stage_id": 5
      },
      "point_id": "00000002-0312-0000-0000-000000012345",
      "semantic_score": 0.89,
      "graph_context": {
        "outgoing_fks": [
          { "field_name": "partner_id", "target_model": "res.partner", "target_record_id": 286798 },
          { "field_name": "stage_id", "target_model": "crm.stage", "target_record_id": 5 }
        ],
        "incoming_reference_count": 12,
        "referencing_models": ["sale.order", "account.move"],
        "total_connections": 14
      },
      "validation_status": {
        "has_orphan_fks": false,
        "orphan_fk_fields": [],
        "integrity_score": 100
      },
      "similar_records": [
        { "record_id": 12350, "similarity_score": 0.92, "name": "Hospital Project - Alfred" },
        { "record_id": 12348, "similarity_score": 0.88, "name": "Healthcare Centre - Monash" }
      ]
    }
  ],
  "total_records": 47,
  "query_time_ms": 234,
  "intelligence_used": {
    "semantic": true,
    "graph": true,
    "validation": true,
    "similarity": true
  },
  "timing_breakdown": {
    "search_ms": 45,
    "graph_enrichment_ms": 78,
    "validation_enrichment_ms": 56,
    "similarity_enrichment_ms": 55
  }
}
```

---

### Performance Considerations

| Enrichment | Per-Record Cost | Optimization |
|------------|-----------------|--------------|
| Graph Context | ~20ms | Batch graph queries by model |
| Validation Status | ~15ms | Cache recent validation results |
| Similar Records | ~50ms | Limit to 3-5 per record |
| **Total (all on)** | ~85ms/record | Parallel execution |

**Mitigation Strategies:**
1. **Parallel enrichment** - All three layers run concurrently
2. **Batching** - Graph context fetched in single query for all records
3. **Caching** - Validation results cached for 5 minutes
4. **Limits** - Max 5 similar records, max 20 records enriched

---

### Validation Checkpoint

- [ ] `enrichRecord()` returns correct graph context
- [ ] `enrichRecord()` detects orphan FKs correctly
- [ ] `enrichRecord()` returns similar records
- [ ] nexsus_search with `include_graph_context=true` works
- [ ] nexsus_search with `include_validation_status=true` works
- [ ] nexsus_search with `include_similar=true` works
- [ ] All three flags together work
- [ ] Timing breakdown is accurate
- [ ] Performance stays under 500ms for 10 records with all enrichment

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/services/data-grid.ts` | Core enrichment orchestration (~300 lines) |

### Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add ~80 lines of data grid types |
| `src/tools/nexsus-search.ts` | Add enrichment flags and integration (~100 lines) |
| `src/schemas/index.ts` | Extend NexsusSearchSchema with enrichment params |

---

### Phase 5 Implementation Steps

1. **Add Types** - Add DataGridEnrichment, RecordGraphContext, RecordValidationStatus, SimilarRecordSummary, EnrichedRecord, DataGridResult to types.ts
2. **Create data-grid.ts** - Core service with enrichRecord(), enrichRecords(), and helper functions
3. **Update NexsusSearchSchema** - Add include_graph_context, include_validation_status, include_similar, similar_limit
4. **Integrate in nexsus-search.ts** - Call enrichRecords() when enrichment flags are set
5. **Add formatEnrichedResults()** - Format DataGridResult for display
6. **Test** - Verify each enrichment layer works independently and together
7. **Performance test** - Ensure <500ms for 10 records with all enrichment

---

## Critical Files Summary

| File | Phases | Action |
|------|--------|--------|
| `src/types.ts` | 1,2,3,4,5 | Add all new interfaces |
| `src/sync/commands/validate-fk.ts` | 1,2,3 | Enhance with graph, bidirectional, patterns |
| `src/services/knowledge-graph.ts` | 1 | Add validation metadata to payload |
| `src/services/consistency-checker.ts` | 2 | NEW - bidirectional consistency |
| `src/services/analytics-service.ts` | 3 | Add pattern extraction |
| `src/services/similarity-engine.ts` | 4 | NEW - similarity detection |
| `src/tools/search-tool.ts` | 4 | Add find_similar tool |
| `src/services/data-grid.ts` | 5 | NEW - unified query interface |
| `src/tools/nexsus-search.ts` | 5 | Extend with data grid features |

---

## Execution Order

**Phase 1: COMPLETED** ✅
- OrphanInfo, ValidationReport types added
- RelationshipPayload extended with validation metadata
- Graph-enhanced FK validation implemented
- --store-orphans flag added

**Phase 2: COMPLETED** ✅
- ConsistencyResult, ConsistencyReport types added
- FieldFkStats interface for per-field tracking
- updateGraphEdgeCount() function added to knowledge-graph.ts
- Bidirectional consistency checking implemented
- --bidirectional and --fix CLI flags added
- Tested: Detected 3 stale graphs, 6 orphan FKs, fixed 22 edges

**Phase 3: COMPLETED** ✅
- CardinalityClass, ModelRole, ValidationHistoryEntry types added
- EdgePatternMetadata, ModelPatternMetadata, PatternExport interfaces added
- classifyCardinality(), classifyModelRole(), computeIntegrityTrend() functions
- appendValidationHistory(), updateEdgePatternMetadata() functions
- exportPatterns() for ML training data
- validate-fk --extract-patterns and --track-history flags
- analyze-patterns CLI command with JSON/CSV export
- Tested: 219 models, 1691 edges, 13 hubs identified

**Phase 4: COMPLETED** ✅ (December 29, 2025)
- SimilarRecord and SimilaritySearchResult types added to types.ts
- findSimilarRecords() function in vector-client.ts (~250 lines)
  - Retrieves reference point WITH its vector (no re-embedding)
  - Searches for similar vectors within same model
  - Excludes self from results
  - Optional graph boost to rank by FK connections
  - extractPayloadSummary() for key field display
  - applyGraphBoostToResults() for connection-aware ranking
- find_similar MCP tool in search-tool.ts
  - Accepts point_id OR (model_name + record_id)
  - Uses buildDataUuidV2() for point_id construction
  - formatSimilarityResults() for readable output
- QueryLogEntry type extended with 'find_similar'
- Test results: Found 5 similar partners with 93%+ similarity in 237ms
- Git commit: ed05b43 feat: Add Phase 4 Same-Model Similarity (find_similar)

**Phase 5: PENDING** 📋 (Unified Data Grid)
- Comprehensive design documented above
- Key concept: Enrich nexsus_search results with graph/validation/similarity
- Implementation steps defined (7 steps)
- Estimated: ~500 lines of code across 4 files

---

## Phase 4 Implementation Steps (COMPLETED)

1. **Add Types** - Add SimilarRecord and SimilaritySearchResult to types.ts ✅
2. **Add findSimilarRecords()** - Function in vector-client.ts that retrieves reference vector and searches ✅
3. **Add MCP Tool** - find_similar tool in search-tool.ts ✅
4. **Test** - Build succeeds ✅

### Key Files Modified
- `src/types.ts` - Added 2 interfaces (SimilarRecord, SimilaritySearchResult)
- `src/services/vector-client.ts` - Added findSimilarRecords() and helpers (~200 lines)
- `src/tools/search-tool.ts` - Added find_similar MCP tool and helpers (~180 lines)
- `src/utils/query-logger.ts` - Extended tool type with 'find_similar'

---

## Phase 3 Implementation Steps (COMPLETED)

1. **Add Types** - Add CardinalityClass, ModelRole, ValidationHistoryEntry, EdgePatternMetadata, ModelPatternMetadata, PatternExport to types.ts
2. **Extend RelationshipPayload** - Add optional pattern fields (cardinality_class, cardinality_ratio, validation_history, integrity_trend)
3. **Add Classification Functions** - classifyCardinality(), classifyModelRole(), computeIntegrityTrend()
4. **Add History Function** - appendValidationHistory() with rolling window of 10
5. **Add Export Function** - exportPatterns() for ML training data
6. **Extend validate-fk** - Add --extract-patterns and --track-history flags
7. **Create analyze-patterns** - New CLI command for dedicated pattern analysis
8. **Test** - Verify pattern classification and export works

### Key Files to Modify
- `src/types.ts` - Add 6 pattern interfaces
- `src/services/knowledge-graph.ts` - Add 6 pattern functions
- `src/sync/commands/validate-fk.ts` - Integrate pattern extraction
- `src/sync/index.ts` - Add analyze-patterns command

### Key Files to Create
- `src/sync/commands/analyze-patterns.ts` - Pattern analysis command
