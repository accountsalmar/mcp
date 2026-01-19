# Knowledge Graph-Enhanced Search Implementation Plan

> **Document ID:** KG_improvements_1984
> **Goal:** Leverage the Knowledge Graph (graph points) to improve semantic and exact searches in Nexsus
> **Strategy:** Enhance existing tools with graph features (backward compatible)
> **Skill:** Create formal Claude SKILL.md for graph-search workflows
> **Testing:** Progressive implementation with Claude.ai validation at each phase

---

## Implementation Status

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 1 | Graph Search Engine Service | COMPLETE | 2024-12-27 |
| 2 | semantic_search + graph_boost | COMPLETE | 2024-12-27 |
| 3 | nexsus_search + show_relationships | COMPLETE | 2024-12-27 |
| 4 | graph_traverse + dynamic FK discovery | COMPLETE | 2024-12-27 |
| 5 | Claude Skill for graph-search | COMPLETE | 2024-12-27 |
| 6 | Documentation updates | COMPLETE | 2024-12-27 |

**All phases completed successfully!**

---

## Research Summary

### Current Architecture

```
QDRANT: nexsus_unified (single collection)
├── 00000001-* → Graph Points (point_type: 'graph')     [UNDERUTILIZED]
├── 00000002-* → Data Points (point_type: 'data')
└── 00000003-* → Schema Points (point_type: 'schema')
```

**UUID V2 Linking System:**
| Type | Format | Example |
|------|--------|---------|
| Data | `00000002-MMMM-0000-0000-RRRRRRRRRRRR` | `00000002-0312-0000-0000-000000691174` |
| Schema | `00000003-0004-0000-0000-FFFFFFFFFFFF` | `00000003-0004-0000-0000-000000028105` |
| Graph | `00000001-SSSS-TTTT-00RR-FFFFFFFFFFFF` | `00000001-0312-0078-0031-000000005012` |

**Current Gap:** Graph points are stored during cascade sync but NOT used in searches.

### External Research Findings

**Qdrant 2025:**
- Query API with prefetch for multi-stage retrieval
- RRF (Reciprocal Rank Fusion) for combining search results
- Score boosting with business signals

**GraphRAG Best Practices:**
- Combine vector similarity with graph context
- Use one-hop traversal for high-recall subgraphs
- Connection count as relevance signal

**Claude Skills:**
- SKILL.md with YAML frontmatter (name, description, allowed-tools)
- Automatic discovery from `.claude/skills/` directory
- Tool restriction for focused workflows

---

## Implementation Phases

### Phase 1: Graph Search Engine Service (Foundation)

**Status:** [ ] Not Started

**Create:** `src/services/graph-search-engine.ts`

```typescript
/**
 * Graph Search Engine
 *
 * Provides graph-aware search capabilities by leveraging
 * the Knowledge Graph points in the unified collection.
 */

// Core functions to implement:

/**
 * Fetch graph edges for a model/record
 * Uses existing graph points (00000001-*) from cascade sync
 */
async function getGraphContext(
  modelName: string,
  options?: {
    recordId?: number;
    direction?: 'outgoing' | 'incoming' | 'both';
    limit?: number;
  }
): Promise<RelationshipInfo[]>;

/**
 * Compute connection score for boosting search results
 * Higher score = more connected = more "important"
 */
function computeGraphBoost(
  recordPayload: PipelineDataPayload,
  graphEdges: RelationshipInfo[]
): number;  // Returns 0.0 - 1.0 boost multiplier

/**
 * Count FK connections in a record's payload
 * Outgoing = *_qdrant fields with values
 * Incoming = computed from graph edge_count
 */
function countConnections(payload: PipelineDataPayload): {
  outgoing: number;
  incoming: number;
  total: number;
};

/**
 * Cache graph context to avoid repeated queries
 */
const graphContextCache = new Map<string, {
  data: RelationshipInfo[];
  timestamp: number;
}>();
```

**Key Implementation Details:**
1. Query graph points using existing `getModelRelationships()` in `knowledge-graph.ts`
2. Use `edge_count` from graph payloads for connection scoring
3. Cache graph edges per model (5-minute TTL)

**Files to create/modify:**
- `src/services/graph-search-engine.ts` (NEW)
- `src/services/knowledge-graph.ts` (extend with `getGraphContext`)

**Test Script:** `scripts/test-graph-engine.ts`
```typescript
// Test 1: Get graph context for a model
const context = await getGraphContext('crm.lead');
console.log('Graph edges for crm.lead:', context.length);

// Test 2: Count connections for a record
const connections = countConnections(samplePayload);
console.log('Connections:', connections);

// Test 3: Compute boost
const boost = computeGraphBoost(samplePayload, context);
console.log('Boost factor:', boost);
```

**Claude.ai Test Prompts:**
```
1. "Check system_status - how many graph points exist?"
2. "Search for 'hospital projects' and note the scores"
3. "Use graph_traverse on crm.lead to see relationships"
```

---

### Phase 2: Enhance semantic_search with Graph Boost

**Status:** [ ] Not Started

**Modify:** `src/tools/search-tool.ts`

**Add new parameter to SemanticSearchSchema:**
```typescript
graph_boost: z.boolean()
  .optional()
  .default(false)
  .describe('Boost ranking by connection count (well-connected records rank higher)')
```

**Implementation flow:**
```
1. Perform normal vector search (existing behavior)
2. If graph_boost=true AND point_type='data':
   a. For each result, count *_qdrant fields in payload
   b. Query graph for edge_count per model
   c. Compute boost: score * (1 + connectionBoost * 0.2)
   d. Re-rank results by boosted score
3. Add connection info to result formatting
```

**Result format enhancement:**
```markdown
### 1. [DATA] res.partner #286798
**Score:** 92.3% (+8.1% graph boost)
**Connections:** 3 outgoing, 47 references
**Content:** Hansen Yuncken Pty Ltd | Sydney NSW
```

**Files to modify:**
- `src/tools/search-tool.ts` - Add parameter + boost logic
- `src/schemas/index.ts` - Update SemanticSearchSchema

**Test Script:** `scripts/test-graph-boost.ts`
```typescript
// Compare results with and without graph boost
const normalResults = await semanticSearch({ query: 'hospital', point_type: 'data' });
const boostedResults = await semanticSearch({ query: 'hospital', point_type: 'data', graph_boost: true });

// Verify boosted results have connection info
// Verify ranking changed for connected records
```

**Claude.ai Test Prompts:**
```
1. "semantic_search for 'hospital projects' with graph_boost=false"
2. "semantic_search for 'hospital projects' with graph_boost=true"
3. "Compare the rankings - did well-connected records move up?"
```

---

### Phase 3: Enhance nexsus_search with Graph Awareness

**Status:** [ ] Not Started

**Modify:** `src/tools/nexsus-search.ts`

**Add new parameter:**
```typescript
show_relationships: z.boolean()
  .optional()
  .default(false)
  .describe('Include FK relationship context in results')
```

**Implementation:**
```
1. When show_relationships=true:
   a. Query graph edges for the target model
   b. Include relationship summary in output header
   c. Show edge_count for each FK relationship
   d. Suggest related models for exploration
```

**Output enhancement:**
```markdown
**Model:** account.move.line
**Relationships Found:**
├── partner_id → res.partner (8,234 edges, many2one)
├── account_id → account.account (156 edges, many2one)
└── journal_id → account.journal (45 edges, many2one)

**Suggested Explorations:**
- "Find all journal entries for partner X"
- "Group by account_id to see account distribution"

**Results:** (15 records)
...
```

**Files to modify:**
- `src/tools/nexsus-search.ts` - Add parameter + relationship display

**Test Script:** `scripts/test-relationship-display.ts`
```typescript
// Test with show_relationships enabled
const results = await nexsusSearch({
  model_name: 'account.move.line',
  filters: [{ field: 'partner_id_id', op: 'eq', value: 286798 }],
  show_relationships: true
});

// Verify relationship summary appears in output
```

**Claude.ai Test Prompts:**
```
1. "nexsus_search for account.move.line with any filter"
2. "nexsus_search with show_relationships=true - what relationships exist?"
3. "Follow a suggested exploration from the output"
```

---

### Phase 4: Enhance graph_traverse with Dynamic Discovery

**Status:** [ ] Not Started

**Modify:** `src/tools/graph-tool.ts`

**Current Problem (line 93-129):**
```typescript
// COMMON_FK_FIELDS is hardcoded - misses dynamically discovered FKs
const COMMON_FK_FIELDS = [
  'partner_id_qdrant',
  'user_id_qdrant',
  // ... 25+ more hardcoded
];
```

**Proposed Solution:**
```typescript
/**
 * Get incoming FK fields dynamically from graph points
 * instead of hardcoded COMMON_FK_FIELDS list
 */
async function getIncomingFkFields(modelName: string): Promise<string[]> {
  const incomingEdges = await getIncomingRelationships(modelName);
  return incomingEdges.map(e => `${e.field_name}_qdrant`);
}

// In incoming traversal:
const fkFields = await getIncomingFkFields(modelName);
// Use fkFields instead of COMMON_FK_FIELDS
```

**Benefits:**
- Discovers ALL FK fields that reference a model
- Works with new models automatically (no code changes needed)
- Uses graph points as source of truth

**Files to modify:**
- `src/tools/graph-tool.ts` - Replace hardcoded list with dynamic query

**Test Script:** `scripts/test-dynamic-fk-discovery.ts`
```typescript
// Test dynamic discovery vs hardcoded
const dynamicFields = await getIncomingFkFields('res.partner');
console.log('Dynamically discovered FK fields:', dynamicFields.length);
console.log('Hardcoded COMMON_FK_FIELDS:', COMMON_FK_FIELDS.length);

// Verify dynamic includes all hardcoded + more
```

**Claude.ai Test Prompts:**
```
1. "graph_traverse on res.partner with direction=incoming"
2. "Count how many different models reference res.partner"
3. "Are there any FK fields discovered that weren't in the old list?"
```

---

### Phase 5: Create Claude Skill for Graph Search

**Status:** [ ] Not Started

**Create:** `.claude/skills/graph-search/SKILL.md`

```yaml
---
name: graph-search
description: Intelligent search combining semantic similarity with knowledge graph context. Use when finding connected records, understanding relationships, or discovering data paths.
allowed-tools:
  - semantic_search
  - nexsus_search
  - graph_traverse
  - system_status
version: 1.0.0
---

# Graph-Enhanced Search Skill

Use this skill when users want to:
- Find records related to or connected with other records
- Understand relationships between entities
- Discover the "most important" or "central" records
- Navigate the data graph

## When to Activate

Trigger phrases:
- "related to", "connected to", "linked with"
- "find everything about X"
- "what references Y"
- "most important", "central", "key"

## Strategy Selection

| Query Pattern | Tool + Parameters |
|--------------|-------------------|
| "Find records related to X" | semantic_search + graph_boost=true |
| "What's connected to partner Y" | graph_traverse with direction=both |
| "Total for X and related" | nexsus_search + show_relationships=true |
| "Most important partners" | semantic_search + graph_boost=true, sort by connections |

## Workflow

1. **Check Graph Status**
   - Run `system_status section=data` to verify graph points exist
   - If no graph points, suggest running pipeline_sync first

2. **Understand Intent**
   - Discovery query? → semantic_search + graph_boost
   - Specific traversal? → graph_traverse
   - Aggregation with context? → nexsus_search + show_relationships

3. **Enable Graph Features**
   - Set `graph_boost=true` for semantic searches
   - Set `show_relationships=true` for nexsus searches
   - Use `direction=both` for comprehensive traversal

4. **Interpret Results**
   - Explain connection counts in business terms
   - Suggest follow-up explorations based on relationships
   - Highlight "hub" records with many connections

## Graph Boost Explanation

When graph_boost is enabled:
- Records with more FK references rank higher
- Connection count = outgoing FKs + incoming references from graph
- Boost factor: up to 20% score increase for highly connected records
- Use for: finding "important" or "central" entities

## Example Interactions

**User:** "Find the most important partners"
**Action:** semantic_search with graph_boost=true, then explain why top results are "important" based on connection counts

**User:** "What's connected to partner Hansen Yuncken?"
**Action:** graph_traverse with direction=both, show both outgoing FKs and incoming references

**User:** "Show me invoices for Hansen and explain the relationships"
**Action:** nexsus_search with show_relationships=true, then explain what FK relationships mean
```

**Files to create:**
- `.claude/skills/graph-search/SKILL.md`

**Claude.ai Test Prompts:**
```
1. "/graph-search" - verify skill is discoverable
2. "Find the most important partners in the system"
3. "What's connected to Hansen Yuncken?"
```

---

### Phase 6: Update Documentation

**Status:** [ ] Not Started

**Files to modify:**

1. **CLAUDE.md** - Add graph parameters to tool descriptions
```markdown
### semantic_search
...
- `graph_boost` (optional): Enable graph-boosted ranking

### nexsus_search
...
- `show_relationships` (optional): Include FK relationship context
```

2. **docs/SKILL-nexsus-search.md** - Add graph feature guidance
```markdown
## Graph-Enhanced Features

When working with connected data:
- Use `graph_boost=true` for discovery queries
- Use `show_relationships=true` to understand FK context
```

3. **docs/graph-search-architecture.md** (NEW) - Technical reference
```markdown
# Graph Search Architecture

## How Graph Boost Works
...

## Connection Scoring Algorithm
...

## Cache Strategy
...
```

---

## Critical Files Summary

| File | Action | Phase |
|------|--------|-------|
| `src/services/graph-search-engine.ts` | CREATE | 1 |
| `src/services/knowledge-graph.ts` | MODIFY | 1 |
| `src/tools/search-tool.ts` | MODIFY | 2 |
| `src/schemas/index.ts` | MODIFY | 2 |
| `src/tools/nexsus-search.ts` | MODIFY | 3 |
| `src/tools/graph-tool.ts` | MODIFY | 4 |
| `.claude/skills/graph-search/SKILL.md` | CREATE | 5 |
| `CLAUDE.md` | MODIFY | 6 |
| `docs/SKILL-nexsus-search.md` | MODIFY | 6 |
| `docs/graph-search-architecture.md` | CREATE | 6 |

---

## Testing Strategy

### Per-Phase Testing

Each phase includes:
1. **Unit Test Script:** `scripts/test-<feature>.ts`
2. **Build Verification:** `npm run build`
3. **Claude.ai Integration Test:** Manual prompts to verify behavior

### Regression Testing

After each phase:
- Run existing tool with old parameters (backward compatibility)
- Run tool with new parameters (new functionality)
- Compare results

### Claude.ai Test Sequence

```
Phase 1: "system_status" → verify graph points exist
Phase 2: "semantic_search with graph_boost" → verify boosted ranking
Phase 3: "nexsus_search with show_relationships" → verify FK context
Phase 4: "graph_traverse incoming" → verify dynamic discovery
Phase 5: "/graph-search" → verify skill activation
Phase 6: Check documentation renders correctly
```

---

## Success Metrics

| Phase | Success Criteria |
|-------|------------------|
| 1 | `getGraphContext()` returns edges, `computeGraphBoost()` returns 0-1 |
| 2 | semantic_search re-ranks by connections when graph_boost=true |
| 3 | nexsus_search shows FK relationships when show_relationships=true |
| 4 | graph_traverse uses graph points for incoming discovery |
| 5 | `/graph-search` skill discoverable and provides workflow guidance |
| 6 | Documentation complete and accurate |

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| No graph points synced | Graceful fallback to non-boosted behavior + warning |
| Performance impact | Cache graph edges per model (5-min TTL) |
| Empty graph collection | Surface suggestion to run pipeline_sync first |
| Breaking existing behavior | All new features are opt-in parameters |

---

## Future Phases (Not in Scope)

- **Multi-hop expansion:** Expand results via N-hop traversal
- **Path finding:** Find shortest path between two records
- **GraphRAG:** Vector search on graph edge semantic descriptions
- **RRF fusion:** Properly combine multiple search signals

These can be added incrementally after Phase 1-6 are complete and validated.

---

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1 | [ ] | | | Graph Search Engine |
| 2 | [ ] | | | Semantic Search Graph Boost |
| 3 | [ ] | | | Nexsus Search Relationships |
| 4 | [ ] | | | Dynamic FK Discovery |
| 5 | [ ] | | | Claude Skill |
| 6 | [ ] | | | Documentation |

---

*Document created: 2025-12-27*
*Last updated: 2025-12-27*
