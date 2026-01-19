# Context Graphs Implementation for Nexsus1

## Overview

Implement Context Graph features to transform Nexsus1 from a query tool into an **organizational memory system**. Context Graphs capture **decision traces** - the "why" behind queries - making past decisions searchable as precedent.

**Current State**: Nexsus1 has ~60% of Context Graph foundation (Knowledge Graph, Blendthink, session memory)
**Opportunity**: Add decision traces, precedent search, outcome tracking (remaining 40%)

**Source**: [Foundation Capital Article](https://foundationcapital.com/context-graphs-ais-trillion-dollar-opportunity/)

---

## Stages

### Stage 1: Decision Trace Capture
**Goal:** Capture the "why" behind queries without disrupting existing flow
**Estimated effort:** Medium (2-3 hours)

**Tasks:**
- [ ] Add `DecisionTrace` interface to `src/console/blendthink/types.ts`
- [ ] Extend `blendthink_execute` to accept optional `intent` and `context` parameters
- [ ] Modify `BlendthinkEngine.execute()` to capture decision context
- [ ] Extend `ConversationTurn` with intent/context/outcome fields
- [ ] Update session persistence to store decision traces in R2
- [ ] Add `outcome` feedback capture (helpful/partial/unhelpful)

**Key Interfaces to Add:**
```typescript
interface DecisionTrace {
  // Existing (already captured)
  query: string
  timestamp: Date
  questionType: QuestionType
  routePlan: RoutePlan
  results: BlendResult

  // NEW: Decision context
  userIntent?: string           // "Why are you asking?"
  businessContext?: string      // "What decision will this inform?"

  // NEW: Outcome tracking
  outcome?: 'helpful' | 'partial' | 'unhelpful' | 'led_to_action'
  followUpQueries?: string[]    // What did user ask next?
}
```

**Tests (Claude Code - stdio):**
- [ ] Run `blendthink_execute` with intent parameter: `{"query": "revenue by region", "intent": "board presentation"}`
- [ ] Verify intent is captured in session storage
- [ ] Run follow-up query and verify `followUpQueries` linkage
- [ ] Test backward compatibility (queries without intent still work)

**Tests (claude.ai - HTTP):**
- [ ] Call `blendthink_execute` via MCP with intent parameter
- [ ] Verify response includes intent in metadata
- [ ] Check R2 session data shows decision trace

**Success Criteria:**
- Queries with intent parameter persist intent to R2
- Queries without intent work unchanged (backward compatible)
- Session data shows decision trace history

---

### Stage 2: Query Precedent Indexing
**Goal:** Make past queries searchable as knowledge points in Qdrant
**Estimated effort:** Complex (4-5 hours)

**Tasks:**
- [ ] Define `QueryPrecedent` point type in `src/common/types.ts`
- [ ] Create UUID format for precedents: `00000006-YYYY-MM00-0000-SSSSSSSSSSSS`
- [ ] Add `buildPrecedentUuid()` to `src/common/utils/uuid-v2.ts`
- [ ] Create `src/knowledge/precedent/precedent-indexer.ts` for batch indexing
- [ ] Add CLI command: `npm run sync -- sync precedents`
- [ ] Index completed sessions from R2 → Qdrant as precedent points

**Key Interface:**
```typescript
interface QueryPrecedentPayload {
  point_type: 'query_precedent'

  // Semantic text for embedding
  vector_text: string  // "User asked about revenue by region, filtered to Q3..."

  // Payload for filtering
  query_pattern: string
  question_type: QuestionType
  models_involved: string[]
  fields_accessed: string[]
  filters_used: string[]
  outcome: string
  timestamp: string
  session_id: string
}
```

**Tests (Claude Code - stdio):**
- [ ] Run `npm run sync -- sync precedents --dry-run` to preview
- [ ] Run `npm run sync -- sync precedents` to index
- [ ] Verify precedent points appear in Qdrant with correct UUIDs
- [ ] Test semantic search finds precedents: `semantic_search("how did we analyze revenue", point_type: "query_precedent")`

**Tests (claude.ai - HTTP):**
- [ ] Call `semantic_search` with `point_type: "query_precedent"`
- [ ] Verify past query patterns appear in results
- [ ] Check similarity scores make sense (related queries score higher)

**Success Criteria:**
- Completed sessions are indexed as Qdrant points
- Semantic search can find relevant past queries
- Precedent points include enough context for usefulness

---

### Stage 3: Find Precedent Tool
**Goal:** Add MCP tool for searching query precedents
**Estimated effort:** Medium (2-3 hours)

**Tasks:**
- [ ] Create `src/knowledge/precedent/find-precedent-tool.ts`
- [ ] Register `find_precedent` tool in `src/console/index.ts`
- [ ] Add filters: `question_type`, `models_involved`, `date_range`, `min_outcome`
- [ ] Return precedents with similarity scores and context
- [ ] Add tool documentation to CLAUDE.md

**Tool Interface:**
```typescript
find_precedent({
  query: "how did we calculate revenue discrepancies",
  question_type?: "aggregation",     // Optional filter
  models_involved?: ["actual"],      // Optional filter
  date_from?: "2024-01-01",         // Optional filter
  min_outcome?: 0.7,                 // Only helpful queries
  limit?: 5
})
```

**Tests (Claude Code - stdio):**
- [ ] Call `find_precedent` with natural language query
- [ ] Verify results include relevant past queries
- [ ] Test filters (question_type, date_range) work correctly
- [ ] Test empty results case (no matching precedents)

**Tests (claude.ai - HTTP):**
- [ ] Use `find_precedent` tool via MCP
- [ ] Verify response format is usable by Claude
- [ ] Test filter combinations

**Success Criteria:**
- `find_precedent` returns relevant past queries
- Filters narrow results appropriately
- Response includes enough context to be useful

---

### Stage 4: Precedent-Informed Routing
**Goal:** Enhance Blendthink to check precedents before routing
**Estimated effort:** Medium (3-4 hours)

**Tasks:**
- [ ] Add precedent check step to `BlendthinkEngine.execute()`
- [ ] If similar precedent found (>0.8 similarity), suggest route from precedent
- [ ] Add `precedent_used` field to route plan
- [ ] Include precedent references in Claude synthesis prompt
- [ ] Add `skip_precedent_check` option for fresh analysis

**Flow Enhancement:**
```
User Query
    ↓
┌─────────────────────────────────────────┐
│ NEW: Precedent Check                    │
│ - Search query_precedent points         │
│ - If match >0.8: suggest prior route    │
│ - Pass precedent context to synthesis   │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│ Blendthink: Analyze & Route             │
│ - Use precedent as routing hint         │
│ - Override if user specifies different  │
└────────────────────┬────────────────────┘
                     ↓
(rest of pipeline unchanged)
```

**Tests (Claude Code - stdio):**
- [ ] Run similar query twice, verify second uses precedent
- [ ] Test `skip_precedent_check: true` forces fresh analysis
- [ ] Verify precedent reference appears in response metadata

**Tests (claude.ai - HTTP):**
- [ ] Run query that matches existing precedent
- [ ] Verify response mentions "based on similar query from [date]"
- [ ] Check that routing is faster when precedent found

**Success Criteria:**
- Similar queries benefit from precedent (faster, consistent)
- Precedent usage is transparent (shown in metadata)
- Users can override precedent when needed

---

### Stage 5: Outcome Feedback Loop
**Goal:** Capture whether queries were helpful and learn from outcomes
**Estimated effort:** Simple (1-2 hours)

**Tasks:**
- [ ] Add `rate_query` tool for feedback capture
- [ ] Store outcome rating in session and precedent point
- [ ] Update precedent point payload with aggregated ratings
- [ ] Add outcome filter to `find_precedent` (exclude unhelpful)
- [ ] Surface outcome stats in `system_status`

**Tool Interface:**
```typescript
rate_query({
  session_id: "abc123",
  query_index: 2,              // Which query in session
  outcome: "helpful",          // helpful | partial | unhelpful
  feedback?: "Found exactly what I needed"
})
```

**Tests (Claude Code - stdio):**
- [ ] Call `rate_query` after completing a query
- [ ] Verify rating persisted to R2 session
- [ ] Re-index precedents, verify outcome included
- [ ] Test `find_precedent` with `min_outcome` filter

**Tests (claude.ai - HTTP):**
- [ ] Rate a query via MCP tool
- [ ] Verify subsequent `find_precedent` respects rating filter

**Success Criteria:**
- Outcome ratings are captured and persisted
- Unhelpful queries can be filtered from precedent search
- Rating is optional (doesn't block workflow)

---

## Dependencies

- Qdrant vector database running (existing)
- R2 session storage configured (existing in Blendthink)
- Voyage AI embeddings working (existing)
- `blendthink_execute` tool functional (existing)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| User adoption of intent capture | Make intent optional, never block queries |
| Noisy/unhelpful precedents | Quality filters (outcome rating, recency) |
| Storage growth | Set retention policy (e.g., 90 days of precedents) |
| Performance overhead | Async precedent indexing, cached lookups |
| Privacy concerns | Document data retention, add role-based access later |
| Over-engineering | Start with Stage 1-2 only, validate value before Stage 3-5 |

## Notes

### Context Graph Concept (from Foundation Capital)
- **Rules** define general behavior ("use official ARR")
- **Decision Traces** capture specific instances ("we used X definition under policy v3.2")
- Key insight: Capture "why" at **decision time**, not after the fact

### Nexsus1 Alignment
- **Already has**: Knowledge Graph (FK relationships), Blendthink (routing), session memory
- **Missing**: Decision traces ("why"), precedent search, outcome tracking
- **Opportunity**: Transform from query tool → organizational memory

### Implementation Philosophy
- All additions are **optional extensions** (no breaking changes)
- Validate each stage before proceeding to next
- Single-user first, multi-user later (if needed)

### Files to Modify

| Stage | Files |
|-------|-------|
| 1 | `src/console/blendthink/types.ts`, `engine.ts`, `memory/session-persistence.ts`, `src/console/index.ts` |
| 2 | `src/common/types.ts`, `src/common/utils/uuid-v2.ts`, `src/knowledge/precedent/precedent-indexer.ts`, `src/console/sync/commands/` |
| 3 | `src/knowledge/precedent/find-precedent-tool.ts`, `src/console/index.ts` |
| 4 | `src/console/blendthink/engine.ts` |
| 5 | `src/console/index.ts` (new tool), `src/console/blendthink/memory/` |
