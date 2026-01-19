# Nexsus Search Improvement Plan

## Discovery Date: January 9, 2026

## Context
While attempting to query Jan-25 budgeted revenue using the Nexsus1 MCP tools, several usability and functionality issues were discovered. This document captures the improvement opportunities identified during the search process.

---

## Issue Summary

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | Schema cache not refreshed after sync | **High** | New models cannot be queried until MCP server restart |
| 2 | Date fields stored as Unix timestamps | **Medium** | Hard to query by human-readable dates |
| 3 | Semantic search model_filter fails for new models | **Medium** | Model filter unusable for recently synced models |
| 4 | No "refresh schema" MCP tool | **High** | Requires server restart to pick up schema changes |
| 5 | point_id "contains" doesn't auto-resolve model | **Low** | Workaround exists but not intuitive |

---

## Detailed Issues

### Issue 1: Schema Cache Not Refreshed After Sync (HIGH)

**Problem:**
The `schema-lookup.ts` service initializes the schema cache once at MCP server startup via `initializeSchemaLookup()`. When new models are synced via CLI (`npm run sync -- sync schema`), the running MCP server still has the old cached schema.

**Current Behavior:**
```
1. MCP server starts → loads schema with 3 models (schema, master, actual)
2. User syncs new "budget" model via CLI
3. User tries nexsus_search with model_name="budget"
4. Error: "Model 'budget' not found in schema"
```

**Root Cause:**
- `src/common/services/schema-lookup.ts` line 202: `if (initialized) { return; }` - early exit prevents refresh
- `src/console/index.ts` line 274: `initializeSchemaLookup()` called only once at startup

**Proposed Solution:**
1. Add `refreshSchemaLookup()` function to `schema-lookup.ts`
2. Create new MCP tool `refresh_schema` that calls this function
3. Alternatively: Add file watcher to auto-refresh when schema Excel changes

**Files to Modify:**
- `src/common/services/schema-lookup.ts` - Add refresh function
- `src/console/tools/` - Add refresh_schema tool
- `src/console/index.ts` - Register new tool

---

### Issue 2: Date Fields Stored as Unix Timestamps (MEDIUM)

**Problem:**
Date/datetime fields are converted to Unix timestamps (milliseconds) during sync. This makes queries difficult because users must calculate exact timestamps.

**Current Behavior:**
```
Month field in Excel: "2025-01-01"
Stored in Qdrant: 1735689600000
User query: Month = "January 2025" ❌ (doesn't work)
User query: Month = 1735689600000 ✅ (requires calculation)
```

**Why This Matters:**
- Users think in human dates ("Jan 2025"), not Unix timestamps
- Calculating timestamps is error-prone (timezone issues)
- Semantic search can't effectively filter by date range

**Proposed Solution:**
1. Store BOTH Unix timestamp AND human-readable date string in payload:
   ```json
   {
     "Month": 1735689600000,
     "Month_display": "2025-01-01",
     "Month_year_month": "2025-01"
   }
   ```
2. Add date parsing to nexsus_search filter builder:
   - Accept "2025-01" and convert to timestamp range
   - Accept "January 2025" and convert to timestamp range
3. Add date field type detection for smarter semantic search

**Files to Modify:**
- `src/common/services/excel-data-sync.ts` - Add display date to payload
- `src/common/services/filter-builder.ts` - Add date string parsing
- `src/exact/tools/nexsus-search.ts` - Update field validation

---

### Issue 3: Semantic Search model_filter Fails for New Models (MEDIUM)

**Problem:**
The `semantic_search` tool's `model_filter` parameter uses a schema lookup that isn't updated when new models are synced.

**Current Behavior:**
```
semantic_search({ query: "revenue", model_filter: "budget" })
Error: "Model 'budget' not found. Available models: 2"
```

**Root Cause:**
Same as Issue 1 - cached schema not refreshed.

**Proposed Solution:**
- Part of Issue 1 fix - refresh schema lookup will fix this too
- Alternatively: Have semantic search query Qdrant directly for distinct model_name values

---

### Issue 4: No "Refresh Schema" MCP Tool (HIGH)

**Problem:**
There's no way to refresh the schema cache without restarting the MCP server. This breaks the workflow:
1. User syncs new data via CLI
2. User wants to query it immediately via MCP tools
3. Must restart MCP server to make it work

**Proposed Solution:**
Create new MCP tool:
```typescript
server.tool(
  'refresh_schema',
  'Reload schema from Excel file. Use after syncing new models.',
  {},
  async () => {
    refreshSchemaLookup(); // New function
    return { content: [{ type: 'text', text: 'Schema refreshed: X models, Y fields' }] };
  }
);
```

---

### Issue 5: point_id "contains" Operator Doesn't Auto-Resolve Model (LOW)

**Problem:**
When filtering by `point_id` with "eq" operator, the model is auto-resolved from the UUID. But with "contains" operator (for pattern matching), model_name is still required.

**Current Behavior:**
```
// Works - model resolved from UUID
nexsus_search({ filters: [{ field: "point_id", op: "eq", value: "00000002-0004-..." }] })

// Fails - requires model_name
nexsus_search({ filters: [{ field: "point_id", op: "contains", value: "00000002-0004" }] })
Error: "model_name is required unless filtering by point_id"
```

**Impact:** Low - workaround is to provide model_name explicitly

**Proposed Solution:**
- For "contains" on point_id, extract model_id from the pattern if it matches UUID prefix format
- Or: Skip model validation when point_id filter is present with any operator

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 hours)
1. **Add `refresh_schema` MCP tool** - Highest ROI, enables immediate use of synced models
2. **Add `refreshSchemaLookup()` function** - Foundation for above

### Phase 2: Usability (2-4 hours)
3. **Add human-readable date strings to payload** - Store Month_display alongside Month
4. **Add date parsing to filter builder** - Accept "2025-01" format

### Phase 3: Polish (Optional)
5. **Auto-refresh schema on file change** - File watcher for schema Excel
6. **Improve point_id pattern matching** - Better model resolution for contains operator

---

## Test Cases After Implementation

### Test 1: Schema Refresh
```
1. Sync new model via CLI
2. Call refresh_schema tool
3. Query new model with nexsus_search
Expected: Query succeeds without server restart
```

### Test 2: Date Filtering
```
1. Query with Month = "2025-01"
Expected: Converts to timestamp range and returns matching records
```

### Test 3: Jan-25 Budget Revenue (Original Use Case)
```
nexsus_search({
  model_name: "budget",
  filters: [
    { field: "Classification", op: "eq", value: "REV" },
    { field: "Month", op: "eq", value: "2025-01" }  // Human readable!
  ],
  aggregations: [
    { field: "Amount", op: "sum", alias: "total_budget_revenue" }
  ]
})
Expected: Returns sum of all REV records for January 2025
```

---

## Current Workaround

Until these improvements are implemented, users must:

1. **Restart MCP server** after syncing new models
2. **Calculate Unix timestamps** manually for date filters:
   - Jan 2025: 1735689600000 to 1738368000000
3. **Use semantic search** for discovery, then filter results manually
4. **Check exported Excel files** for precise aggregations

---

## Appendix: Jan-25 Budget Revenue (Manual Calculation)

From semantic search results, Jan-25 (Month=1735689600000) REV records found:
- budget #2237: Product-VIC-Gross = $443,495.33
- budget #2248: Cut-to-Size-VIC-Gross = $278.42
- (Incomplete - semantic search doesn't return all matching records)

**Recommendation:** After implementing refresh_schema, re-run the query for accurate total.
