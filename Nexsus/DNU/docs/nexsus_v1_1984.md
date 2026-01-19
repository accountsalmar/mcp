# Implementation Plan: Unified Interconnected Vector Database for Nexsus

## Overview

Implement a **unified vector database architecture** where Schema, Data, and Knowledge Graph are stored in a **single collection** with deterministic UUIDs and cross-references, enabling:
- Human-readable UUIDs with namespace prefixes
- O(1) direct lookups across all data types
- **Bidirectional links** between data points and graph relationships
- **Cross-type semantic search** (find schema + data + relationships together)
- Alignment with VISION.md's "Logical UID Generation and Clustering" principle

## User Decisions
- **Migration Strategy:** Fresh Re-sync (delete and rebuild)
- **Graph Sequence:** Field Name Hash (deterministic)
- **Model ID Range:** Under 1000 (4 digits sufficient)
- **Relationship Types:** Encoded in graph UUID (2-digit code)
- **Collection Strategy:** Single unified collection (not 3 separate)
- **Cross-References:** Each data point links to its graph relationships
- **Schema Generation:** Option B - Auto-generate from Odoo (Stage 0)

---

## ⚠️ DEEP RESEARCH: Compatibility & Risk Analysis

### Component Compatibility Matrix

| Component A | Component B | Compatibility | Risk | Notes |
|-------------|-------------|---------------|------|-------|
| **V2 UUID (Data)** | **V2 UUID (Graph)** | ✅ COMPATIBLE | Low | Same namespace prefix pattern, different segment usage |
| **V2 UUID (Data)** | **V2 UUID (Schema)** | ✅ COMPATIBLE | Low | Cross-references use consistent format |
| **V2 UUID** | **Current V1 UUID** | ⚠️ BREAKING | High | Cannot coexist - requires fresh re-sync |
| **Unified Collection** | **Existing 3 Collections** | ⚠️ BREAKING | High | Requires backup before migration |
| **Semantic Grouping** | **Current buildVectorText()** | ✅ COMPATIBLE | Medium | Same field iteration, different output format |
| **graph_refs** | **Existing FK Qdrant IDs** | ✅ COMPATIBLE | Low | Extends current pattern, doesn't replace |
| **point_type Filter** | **Qdrant Search** | ✅ COMPATIBLE | Low | Standard payload filtering |
| **Auto-gen Schema** | **Excel-based Schema** | ✅ COMPATIBLE | Medium | Generates same format, different source |

### Existing Codebase Compatibility Analysis

Based on deep exploration of the codebase:

#### Current UUID System (18 Callers Identified)

| File | Line | Function | Impact | Migration |
|------|------|----------|--------|-----------|
| `vector-client.ts` | 564 | `vectorIdToUuid()` | 🔴 Core | Must update |
| `vector-client.ts` | 608 | `uuidToVectorId()` | 🔴 Core | Must update |
| `fk-id-builder.ts` | 39 | `buildFkQdrantId()` | 🔴 Core | Must update |
| `fk-id-builder.ts` | 71 | `parseFkQdrantId()` | 🔴 Core | Must update |
| `knowledge-graph.ts` | 156 | `generateRelationshipId()` | 🔴 Core | Replace with V2 |
| `pipeline-data-transformer.ts` | 265, 282 | FK building | 🟡 Medium | Switch to V2 |
| `cascade-sync.ts` | multiple | UUID generation | 🟡 Medium | Switch to V2 |
| `nexsus-link.ts` | 131 | `isValidFkQdrantId()` | 🟡 Medium | Update regex |
| `fk-dependency-discovery.ts` | 293 | `vectorIdToUuid()` | 🟡 Medium | Switch to V2 |
| `tools/pipeline-tool.ts` | 329 | UUID conversion | 🟢 Low | Auto-updated |
| `tools/graph-tool.ts` | 555, 557 | FK lookups | 🟢 Low | Auto-updated |

#### Current Hardcoded Formats (BREAKING CHANGES)

```typescript
// vector-client.ts:564-598 - Current V1 format
Format: MMMMMMMM-0000-0000-0000-RRRRRRRRRRRR
Regex:  /^\d{8}-0000-0000-0000-\d{12}$/

// fk-id-builder.ts:39-99 - Same V1 format
Format: MMMMMMMM-0000-0000-0000-RRRRRRRRRRRR

// knowledge-graph.ts:156-165 - SHA256 hash format
Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (hash-based)
```

**V2 Formats (New) - CORRECTED in Stage 2:**
```typescript
Data:   00000002-MMMM-0000-0000-RRRRRRRRRRRR  // Valid 5-segment UUID
Schema: 00000003-0004-0000-0000-FFFFFFFFFFFF  // Model 0004 + Field ID
Graph:  00000001-SSSS-TTTT-00RR-FFFFFFFFFFFF  // Source + Target + 00+RelType + Field ID
```

### Risk Mitigation Procedures

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data loss during migration** | Medium | Critical | Backup all 3 collections before any changes |
| **UUID format mismatch** | High | High | Add V1/V2 detection + conversion layer |
| **Broken FK references** | High | High | Validate ALL FK Qdrant IDs after migration |
| **Schema sync failure** | Medium | High | Test with single model first |
| **Semantic search quality drop** | Low | Medium | Compare before/after embeddings |
| **Performance degradation** | Low | Medium | Index point_type, model_id, model_name |
| **Cascade sync breakage** | High | High | Isolated test with 10 records first |

### Critical Pre-Implementation Checks

```
Before Stage 0:
□ Verify Odoo API access to ir.model.fields
□ Confirm all 17,933 fields accessible
□ Check ir.model.id values for all models
□ Verify Qdrant backup mechanism works

Before Stage 1:
□ Unit tests for V2 UUID functions pass
□ V1 detection regex works correctly
□ Field name hash is deterministic

Before Stage 2:
□ Unified collection creates successfully
□ All 3 indexes create properly
□ Backup collections renamed (not deleted)

Before Stage 3: ✅ COMPLETED
☑ Schema sync to unified collection works
☑ point_type filter returns correct results
☑ 17,932 schema points created

Before Stage 4: ✅ COMPLETED
☑ Small batch sync (10 records) succeeds
☑ FK Qdrant IDs use V2 format
☑ graph_refs populated correctly

Before Stage 5:
□ Full cascade sync completes
□ All FK targets synced
□ Knowledge graph populated
□ Cross-references navigable
```

---

## Relationship Type Codes

| Relationship | Code | Odoo ttype | Example |
|--------------|------|------------|---------|
| One to One   | `11` | one2one    | (rare in Odoo) |
| One to Many  | `21` | one2many   | move_id.line_ids → account.move.line |
| Many to One  | `31` | many2one   | partner_id → res.partner (most common FK) |
| Many to Many | `41` | many2many  | tag_ids → tags |

**Code Structure:**
- First digit: Relationship type (1=1:1, 2=1:N, 3=N:1, 4=N:N)
- Second digit: Reserved for future use (always 1)

**Detection Logic:**
- Use Odoo's `ttype` field to determine relationship:
  - `one2one` → `11` (One to one)
  - `one2many` → `21` (One to many)
  - `many2one` → `31` (Many to one) - most common FK type
  - `many2many` → `41` (Many to many)
  - Other → `11` (default to one-to-one)

---

## Unified Collection Architecture

### Current State (3 Collections)
```
nexsus        → 17,933 vectors (schema definitions)
nexsus_data   → 610,000+ vectors (records)
nexsus_graph  → 395 vectors (relationships)
❌ No direct links between collections
```

### New State (1 Unified Collection)
```
nexsus_unified → All vectors in single semantic space
  ├── 00000001-* → Knowledge Graph (relationships)
  ├── 00000002-* → Data Points (records)
  └── 00000003-* → Schema (field definitions)
✅ All interconnected via cross-references
```

### Benefits of Unified Collection

| Benefit | Description |
|---------|-------------|
| **Cross-type semantic search** | Query "partners" returns schema fields + data records + relationships |
| **Logical clustering** | Namespace prefixes group related data (VISION.md principle) |
| **Bidirectional navigation** | Data → Graph → Schema and back |
| **Simplified architecture** | One collection, one index, one backup |
| **Rich context for AI** | Semantic search spans all knowledge types |

### Point Type Discrimination
All points have `point_type` field for filtering:
```typescript
point_type: "schema" | "data" | "graph"
```

---

## UUID Format Specification (CORRECTED in Stage 2)

> **IMPORTANT:** V2 UUIDs must use valid 5-segment format (8-4-4-4-12 = 36 chars with hyphens).
> Qdrant rejects UUIDs with fewer than 5 segments.

### Data Points (nexsus_data)
```
00000002-MMMM-0000-0000-RRRRRRRRRRRR
    │      │    │    │        │
    │      │    │    │        └── Record ID (12 digits)
    │      │    │    └── Reserved (always 0000)
    │      │    └── Reserved (always 0000)
    │      └── Model ID from ir.model (4 digits)
    └── Namespace: 00000002 = Data

Example: 00000002-0312-0000-0000-000000691174
         (account.move.line record 691174)
```

### Knowledge Graph (nexsus_graph)
```
00000001-SSSS-TTTT-00RR-FFFFFFFFFFFF
    │      │    │    │ │       │
    │      │    │    │ │       └── Field ID (12 digits)
    │      │    │    │ └── Relationship type code (2 digits)
    │      │    │    └── Padding (always 00)
    │      │    └── Target model ID (4 digits)
    │      └── Source model ID (4 digits)
    └── Namespace: 00000001 = Graph

Example: 00000001-0312-0078-0031-000000005012
                          ││││
                          ││└└── Field ID 5012 (partner_id)
                          └└── Type: 31 (many-to-one)

         Meaning: account.move.line.partner_id → res.partner
                  (many-to-one relationship)
```

### Schema Points (Namespace 00000003)
```
00000003-0004-0000-0000-FFFFFFFFFFFF
    │      │    │    │        │
    │      │    │    │        └── Field ID (12 digits, from Odoo ir.model.fields.id)
    │      │    │    └── Reserved (always 0000)
    │      │    └── Reserved (always 0000)
    │      └── Model ID (always 0004 = ir.model.fields)
    └── Namespace: 00000003 = Schema

Example: 00000003-0004-0000-0000-000000005012
         (ir.model.fields field with id=5012)
```

---

## 🎯 STAGED IMPLEMENTATION PLAN (Manageable Stages)

### Stage Overview

| Stage | Name | Risk Level | Dependencies | Test Scenario | Status |
|-------|------|------------|--------------|---------------|--------|
| **0** | Auto-Generate Schema from Odoo | 🟢 Low | None | Compare generated vs existing Excel | ✅ COMPLETED |
| **1** | V2 UUID Functions (Non-Breaking) | 🟢 Low | None | Unit tests only | ✅ COMPLETED |
| **2** | Unified Collection Setup | 🟡 Medium | Stage 1 | Empty collection + indexes | ✅ COMPLETED |
| **3** | Schema Sync to Unified | 🟡 Medium | Stage 0, 2 | 17,932 points with point_type='schema' | ✅ COMPLETED |
| **4** | Small Batch Data Sync | 🟡 Medium | Stage 3 | 10 records with V2 UUIDs | ✅ COMPLETED |
| **5** | Full Cascade Sync | 🔴 High | Stage 4 | account.move.line Q1 2025 | ⏳ Pending |
| **6** | MCP Tools Migration | 🟢 Low | Stage 5 | All tools use V2 UUIDs | ✅ COMPLETED |

---

## 🔄 STAGE 0: Auto-Generate Schema from Odoo

### Status: ✅ COMPLETED & FIXED (2025-12-26)

### Implementation Log

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 0.1 | Create odoo-schema-fetcher.ts | ✅ | Fetch ir.model and ir.model.fields |
| 0.2 | Create generate-schema-from-odoo.ts | ✅ | Main script with xlsx output |
| 0.3 | Run and verify output | ✅ | All tests passed |
| 0.4 | Fix buildSemanticText() to include FK metadata | ✅ | Added FK params to function |
| 0.5 | Replace hardcoded FK field_id with dynamic lookup | ✅ | Added modelIdFieldMap |

### Files Created/Modified

- `src/services/odoo-schema-fetcher.ts` - Odoo schema fetching service (UPDATED)
  - Added `modelIdFieldMap` for dynamic FK field_id lookup
  - Fixed `buildSemanticText()` to accept and use FK parameters
  - Replaced hardcoded `2675` with actual 'id' field lookup
- `scripts/generate-schema-from-odoo.ts` - Main generation script
- `nexsus_schema_v2_generated.xlsx` - Generated output (10.45 MB, 17,932 rows)

### Test Results

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| T0.1 Fetch ir.model count | > 400 models | **812 models** | ✅ PASS |
| T0.2 account.move.line fields | > 100 fields | **109 fields** | ✅ PASS |
| T0.3 V2 UUID format | 00000003-0004-... | `00000003-0004-0000-0000-000000005012` | ✅ PASS |
| T0.4 FK Vector includes FK metadata | FK location field model... | ✅ Included | ✅ PASS |
| T0.5 FK has graph_ref | Valid graph UUID | `00000001-0312-0078-210000005581` | ✅ PASS |
| T0.6 Write Excel file | ~17,933 rows | **17,932 rows** | ✅ PASS |
| T0.7 Dynamic FK field_id lookup | Not hardcoded 2675 | `672 model id fields` mapped | ✅ PASS |

### V2 Format Verification

**Regular Field (row 2):**
```
Qdrant ID: 00000003-0004-0000-0000-000000005012
Vector: In model ir.model.fields ,Field_ID - 5012, Model_ID - 292, Field_Name - name, Field_Label - Account Name, Field_Type - char, Model_Name - account.account, Stored - Yes
Payload: Data_type - 3, Field_ID - 5012, Model_ID - 292, Field_Name - name, Field_Label - Account Name, Field_Type - char, Model_Name - account.account, Stored - Yes
```

**FK Field (row 3 - currency_id):**
```
Qdrant ID: 00000003-0004-0000-0000-000000005013
Vector: In model ir.model.fields ,Field_ID - 5013, Model_ID - 292, Field_Name - currency_id, Field_Label - Account Currency, Field_Type - many2one, Model_Name - account.account, FK location field model - res.currency, FK location field model id - 85, FK location record Id - 1041, Qdrant ID for FK - 00000003-0085-0000-0000-000000001041, Stored - Yes
Payload: Data_type - 3, Field_ID - 5013, ..., FK location field model - res.currency, FK location field model id - 85, FK location record Id - 1041, Qdrant ID for FK - 00000003-0085-0000-0000-000000001041
```

### Output Statistics

```
Total Fields:     17,932
Total Models:     709
Stored Fields:    11,545
Computed Fields:  6,387
FK Fields:        5,679
Model ID Fields:  672 (for dynamic FK lookup)

Field Type Breakdown:
  many2one        4,054
  char            3,061
  boolean         2,366
  integer         2,018
  datetime        1,496
  selection       1,088
  one2many        935
  many2many       689
  float           681
  date            380

Sample V2 UUIDs (correct format):
  00000003-0004-0000-0000-000000005012
  00000003-0004-0000-0000-000000005013
  00000003-0004-0000-0000-000000005014
```

### Commands Used

```bash
# Generate schema from Odoo
npx tsx scripts/generate-schema-from-odoo.ts

# Output: nexsus_schema_v2_generated.xlsx (10.45 MB, 17,932 rows)
```

---

## 🔄 STAGE 1: V2 UUID Functions (Non-Breaking)

### Status: ✅ COMPLETED (2025-12-26)

### Implementation Summary

Added V2 UUID generation and parsing functions as pure additions. These functions use **field_id directly** (no hash) for deterministic, Odoo-lookup-capable UUIDs.

### Files Created/Modified

| File | Action | Changes |
|------|--------|---------|
| `src/constants.ts` | Modified | Added UUID_NAMESPACES, RELATIONSHIP_TYPES, TTYPE_TO_RELATIONSHIP_CODE |
| `src/types.ts` | Modified | Added FieldCategory type, updated NexsusSchemaRow with field_category |
| `src/utils/uuid-v2.ts` | **Created** | All V2 UUID functions (build, parse, validate, helpers) |
| `scripts/test-uuid-v2.ts` | **Created** | Comprehensive test suite (34 tests) |

### V2 UUID Format Reference (CORRECTED in Stage 2)

| Type | Format | Example |
|------|--------|---------|
| **Data** | `00000002-MMMM-0000-0000-RRRRRRRRRRRR` | `00000002-0312-0000-0000-000000691174` |
| **Schema** | `00000003-0004-0000-0000-FFFFFFFFFFFF` | `00000003-0004-0000-0000-000000005012` |
| **Graph** | `00000001-SSSS-TTTT-00RR-FFFFFFFFFFFF` | `00000001-0312-0078-0031-000000005012` |

**Key Design:**
- ✅ Valid 5-segment UUID format (8-4-4-4-12 = 36 chars with hyphens)
- ✅ No hash - use field_id directly (unique from Odoo's ir.model.fields)
- ✅ Schema UUID always uses 0004 in segment 2 (ir.model.fields model_id)
- ✅ Relationship types: 11 (1:1), 21 (1:N), 31 (N:1), 41 (N:N)
- ✅ Graph UUID uses 00RR format in 4th segment (00 padding + 2-digit relationship code)

### Functions Added

**Data UUID:**
- `buildDataUuidV2(modelId, recordId)` - Generate data point UUID
- `parseDataUuidV2(uuid)` - Extract modelId and recordId
- `isValidDataUuidV2(uuid)` - Validate format

**Schema UUID:**
- `buildSchemaUuidV2(fieldId)` - Generate schema field UUID
- `buildSchemaFkRefUuidV2(targetModelId, targetFieldId)` - Generate FK reference UUID
- `parseSchemaUuidV2(uuid)` - Extract fieldId
- `parseSchemaFkRefUuidV2(uuid)` - Extract target model/field IDs
- `isValidSchemaUuidV2(uuid)` - Validate format

**Graph UUID:**
- `buildGraphUuidV2(sourceModelId, targetModelId, fieldId, relationshipType)` - Generate relationship UUID
- `parseGraphUuidV2(uuid)` - Extract all components
- `isValidGraphUuidV2(uuid)` - Validate format

**Helpers:**
- `getUuidType(uuid)` - Detect 'graph' | 'data' | 'schema' | null
- `isV2Uuid(uuid)` - Check if valid V2 format (any type)
- `getRelationshipTypeCode(fieldType)` - Convert Odoo ttype to code
- `getRelationshipName(code)` - Get human-readable name
- `getOdooTtype(code)` - Reverse lookup code to ttype

### Test Results (34/34 Passed)

| Category | Tests | Status |
|----------|-------|--------|
| Data UUID | 5 tests | ✅ All passed |
| Schema UUID | 7 tests | ✅ All passed |
| Graph UUID | 7 tests | ✅ All passed |
| Type Detection | 6 tests | ✅ All passed |
| Relationship Helpers | 6 tests | ✅ All passed |
| Error Handling | 3 tests | ✅ All passed |

### Test Command

```bash
# Run V2 UUID tests
npx tsx scripts/test-uuid-v2.ts

# Output:
# SUMMARY: 34 passed, 0 failed
# 🎉 All tests passed! V2 UUID functions are working correctly.
```

### Non-Breaking Guarantee

These additions are **pure additions** with no breaking changes:
- Existing V1 functions in `src/utils/fk-id-builder.ts` remain unchanged
- Existing `vector-client.ts` functions remain unchanged
- V2 functions will be used in Stage 4 when we switch to the unified collection

---

## 🔄 STAGE 2: Unified Collection Setup

### Status: ✅ COMPLETED (2025-12-26)

### Implementation Summary

Created the `nexsus_unified` collection with proper configuration and 32 payload indexes. This stage also **corrected the V2 UUID format** to use valid 5-segment UUIDs that Qdrant accepts.

### Critical Learning: UUID Format Fix

During Stage 2 testing, we discovered that **V2 UUIDs had an invalid format**:

| Issue | Original Format (INVALID) | Fixed Format (VALID) |
|-------|---------------------------|----------------------|
| Data UUID | `00000002-0312-0000-000000691174` (4 segments) | `00000002-0312-0000-0000-000000691174` (5 segments) |
| Graph UUID | `00000001-0312-0078-310000005012` (4 segments) | `00000001-0312-0078-0031-000000005012` (5 segments) |

**Root Cause:** Qdrant requires valid UUIDs with 5 segments (8-4-4-4-12 = 36 chars with hyphens). Our original format only had 4 segments (28-32 chars).

**Fix Applied:** Updated `src/utils/uuid-v2.ts`:
- Data UUID: Added extra `0000-` segment between model ID and record ID
- Graph UUID: Changed relationship type format from `RR` to `00RR` (4 chars with padding)

### Files Created/Modified

| File | Action | Changes |
|------|--------|---------|
| `src/constants.ts` | Modified | Added UNIFIED_CONFIG (collection settings) |
| `src/services/vector-client.ts` | Modified | Added createUnifiedCollection(), getUnifiedCollectionInfo(), deleteUnifiedCollection(), getUnifiedCollectionIndexes() |
| `src/utils/uuid-v2.ts` | Modified | **Fixed UUID formats to valid 5-segment format** |
| `scripts/create-unified-collection.ts` | **Created** | Script to create unified collection |
| `scripts/test-unified-collection.ts` | **Created** | Test suite (15 tests) |
| `scripts/test-uuid-v2.ts` | Modified | Updated expected values for corrected formats |

### UNIFIED_CONFIG

```typescript
export const UNIFIED_CONFIG = {
  COLLECTION_NAME: 'nexsus_unified',
  VECTOR_SIZE: 1024,                    // Voyage AI voyage-3.5-lite
  DISTANCE_METRIC: 'Cosine',
  ENABLE_SCALAR_QUANTIZATION: true,     // 75% memory reduction
  SCALAR_QUANTILE: 0.99,
  HNSW_M: 32,                           // Tuned for 600K+ vectors
  HNSW_EF_CONSTRUCT: 200,
  HNSW_EF_SEARCH: 128,
};
```

### Unified Collection Indexes (32 Total)

```
Common indexes (all point types):
  - point_type (PRIMARY DISCRIMINATOR)
  - model_name, model_id

Schema-specific indexes:
  - field_name, field_type, stored, field_id
  - fk_location_model, fk_qdrant_id, primary_data_location

Data-specific indexes:
  - record_id, account_id_id, date, parent_state
  - journal_id_id, partner_id_id, move_id_id
  - debit, credit, balance

FK Qdrant reference indexes (for graph traversal):
  - partner_id_qdrant, user_id_qdrant, company_id_qdrant
  - move_id_qdrant, account_id_qdrant, journal_id_qdrant
  - stage_id_qdrant, team_id_qdrant, currency_id_qdrant

Graph-specific indexes:
  - source_model, target_model, is_leaf
```

### Test Results (15/15 Passed)

| Category | Tests | Status |
|----------|-------|--------|
| Collection Creation | T2.1-T2.3 (3 tests) | ✅ All passed |
| Index Verification | T2.4-T2.8 (5 tests) | ✅ All passed |
| Legacy Collections | T2.9-T2.11 (3 tests) | ✅ All passed |
| V2 UUID Insertion | T2.12-T2.15 (4 tests) | ✅ All passed |

### Test Commands

```bash
# Create unified collection
npx tsx scripts/create-unified-collection.ts

# Run Stage 2 verification tests
npx tsx scripts/test-unified-collection.ts

# Output:
# SUMMARY: 15 passed, 0 failed
# 🎉 All Stage 2 tests passed!
```

### Collection Info After Creation

```
Collection: nexsus_unified
Vectors:    0 (empty, ready for Stage 3)
Indexes:    32

Legacy Collections (untouched):
  nexsus:       exists ✅
  nexsus_data:  exists ✅
  nexsus_graph: exists ✅
```

### Pre-Completion Checklist

- [x] UNIFIED_CONFIG added to src/constants.ts
- [x] createUnifiedCollection() added to vector-client.ts
- [x] getUnifiedCollectionInfo() added to vector-client.ts
- [x] deleteUnifiedCollection() added to vector-client.ts
- [x] getUnifiedCollectionIndexes() added to vector-client.ts
- [x] scripts/create-unified-collection.ts created
- [x] scripts/test-unified-collection.ts created
- [x] **V2 UUID format corrected to valid 5-segment format**
- [x] Build succeeds with no errors
- [x] All 15 test scenarios pass
- [x] Legacy collections verified untouched

---

## 🔄 STAGE 3: Schema Sync to Unified Collection

### Status: ✅ COMPLETED (2025-12-26)

### Implementation Summary

Synced 17,932 schema rows from `nexsus_schema_v2_generated.xlsx` to the `nexsus_unified` collection using V2 UUID format. All schema points have `point_type: 'schema'` discriminator for filtering.

### Key Implementation Details

1. **V2 UUID Generation:** Uses `buildSchemaUuidV2(field_id)` directly (no hash)
2. **Point Type Discriminator:** All payloads include `point_type: 'schema'`
3. **FK References:** Converted to V2 format using `buildSchemaFkRefUuidV2(modelId, fieldId)`
4. **Idempotent Upserts:** Second sync updates same points without creating duplicates

### Files Created/Modified

| File | Action | Changes |
|------|--------|---------|
| `src/services/unified-schema-sync.ts` | **Created** | Main sync service with syncSchemaToUnified(), getUnifiedSchemaSyncStatus() |
| `scripts/test-stage3-schema-sync.ts` | **Created** | Test suite (10 tests) |
| `.env` | Modified | Fixed NEXSUS_EXCEL_FILE path |

### Functions Added

**src/services/unified-schema-sync.ts:**

```typescript
// Sync schema to unified collection
export async function syncSchemaToUnified(options?: {
  excelSource?: 'v1' | 'v2';     // Default: 'v1'
  forceRecreate?: boolean;        // Clear existing schema points first
  onProgress?: (phase, current, total) => void;
}): Promise<NexsusSyncResult>

// Get status of schema sync
export async function getUnifiedSchemaSyncStatus(): Promise<{
  collection: string;
  schemaCount: number;
  lastSync: string | null;
}>

// Check if sync is running
export function isUnifiedSchemaSyncRunning(): boolean

// Clear only schema points from unified collection
export async function clearUnifiedSchemaPoints(): Promise<number>
```

### Payload Structure (Unified Schema Point)

```typescript
{
  // DISCRIMINATOR (required)
  point_type: 'schema',

  // Core fields
  field_id: number,
  model_id: number,
  field_name: string,
  field_label: string,
  field_type: string,
  model_name: string,
  stored: boolean,
  semantic_text: string,
  raw_payload: string,
  sync_timestamp: string,

  // FK fields (optional)
  fk_location_model?: string,
  fk_location_model_id?: number,
  fk_location_record_id?: number,
  fk_qdrant_id?: string,          // V2 format!
  primary_data_location?: string,
}
```

### Test Results (10/10 Passed)

| Test | Description | Result |
|------|-------------|--------|
| T3.1 | syncSchemaToUnified() completes | ✅ 17,932 uploaded, 0 failed, 594.0s |
| T3.2 | Schema point count is ~17,932 | ✅ 17,936 points |
| T3.3 | All points have point_type=schema | ✅ 100% match |
| T3.4 | Sample points have valid V2 UUID format | ✅ All valid |
| T3.5 | UUID field_id matches payload field_id | ✅ Verified |
| T3.6 | FK field has V2 format fk_qdrant_id | ✅ 8 FK fields checked |
| T3.7 | Semantic search returns schema results | ✅ 5 results found |
| T3.8 | Search results have expected payload fields | ✅ All required fields present |
| T3.9 | Second sync updates same points (no duplicates) | ✅ Before: 17,936, After: 17,936 |
| T3.10 | Legacy nexsus collection still exists | ✅ Exists |

### Test Commands

```bash
# Run Stage 3 verification tests
npx tsx scripts/test-stage3-schema-sync.ts

# Output:
# SUMMARY: 10 passed, 0 failed
# 🎉 All Stage 3 tests passed!
```

### Collection Info After Sync

```
Collection: nexsus_unified
Vectors:    17,936 (schema points)
  - point_type: 'schema' ✅
  - V2 UUID format: 00000003-0004-0000-0000-FFFFFFFFFFFF ✅
  - FK refs: 00000003-MMMM-0000-0000-FFFFFFFFFFFF ✅

Legacy Collections (untouched):
  nexsus:       exists ✅
  nexsus_data:  exists ✅
  nexsus_graph: exists ✅
```

### Pre-Completion Checklist

- [x] src/services/unified-schema-sync.ts created
- [x] syncSchemaToUnified() uses V2 UUIDs
- [x] point_type: 'schema' added to all payloads
- [x] FK references converted to V2 format
- [x] scripts/test-stage3-schema-sync.ts created
- [x] All 10 test scenarios pass
- [x] Legacy nexsus collection verified untouched
- [x] Build succeeds with no errors

---

## 🔄 STAGE 4: Small Batch Data Sync

### Status: ✅ COMPLETED (2025-12-26)

Stage 4 syncs 10 crm.lead records to the unified collection using V2 UUIDs, with graph relationships and cross-references.

### Implementation Log

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 4.1 | Create unified-graph-sync.ts | ✅ | Graph points with V2 UUIDs |
| 4.2 | Create unified-data-sync.ts | ✅ | Data points with V2 UUIDs |
| 4.3 | Create test-stage4-data-sync.ts | ✅ | 13 test scenarios |
| 4.4 | Build and verify no errors | ✅ | TypeScript build successful |
| 4.5 | Run tests and verify all pass | ✅ | All 13 tests passed |

### Files Created

| File | Purpose |
|------|---------|
| `src/services/unified-graph-sync.ts` | Graph relationship sync with V2 Graph UUIDs |
| `src/services/unified-data-sync.ts` | Data record sync with V2 Data UUIDs |
| `scripts/test-stage4-data-sync.ts` | Stage 4 verification test suite |

### Key Functions

**unified-graph-sync.ts:**
- `upsertUnifiedRelationship()` - Create single graph point
- `batchUpsertUnifiedRelationships()` - Batch upsert graph points
- `getUnifiedGraphCount()` - Count graph points
- `clearUnifiedGraphPoints()` - Clear graph points only

**unified-data-sync.ts:**
- `syncDataToUnified()` - Main sync function
- `syncRecordsToUnified()` - Sync specific record IDs
- `getUnifiedDataSyncStatus()` - Get all point type counts
- `clearUnifiedDataPoints()` - Clear data points only

### V2 UUID Examples from Test

```
Data UUID:  00000002-0344-0000-0000-000000054189  (crm.lead record 54189)
Graph UUID: 00000001-0344-0071-0031-000000006315  (crm.lead → account.analytic.account FK)
FK ref:     00000002-0078-0000-0000-000000000201  (res.partner record 201)
```

### Test Results

| Test | Description | Result |
|------|-------------|--------|
| T4.1 | syncDataToUnified() syncs 10 crm.lead records | ✅ 10 uploaded, 24 graph created |
| T4.2 | Data point UUIDs are V2 format | ✅ All valid V2 Data format |
| T4.3 | UUID model_id matches payload model_id | ✅ All matched |
| T4.4 | All synced data points have point_type=data | ✅ 10 data points |
| T4.5 | FK *_qdrant fields use V2 Data UUID format | ✅ 20 FK fields valid |
| T4.6 | Graph relationships were created | ✅ 24 graph points |
| T4.7 | Graph point UUIDs are V2 format | ✅ All valid V2 Graph format |
| T4.8 | Data points have graph_refs arrays | ✅ 5/5 with refs, 105 total |
| T4.9 | Semantic search returns data results | ✅ 5 results found |
| T4.10 | Second sync updates same points (no duplicates) | ✅ Before=10, After=10 |
| T4.11 | Schema points unchanged after data sync | ✅ 17,936 unchanged |
| T4.12 | Legacy nexsus collection still exists | ✅ Exists |
| T4.13 | Legacy nexsus_data collection still exists | ✅ Exists |

### Test Commands

```bash
# Run Stage 4 verification tests
npx tsx scripts/test-stage4-data-sync.ts

# Output:
# SUMMARY: 13 passed, 0 failed
# 🎉 All Stage 4 tests passed!
```

### Collection Info After Sync

```
Collection: nexsus_unified
Vectors:    17,970 total
  - 17,936 schema points (point_type: 'schema') ✅
  - 10 data points (point_type: 'data') ✅
  - 24 graph points (point_type: 'graph') ✅

V2 UUID Formats:
  - Data:  00000002-MMMM-0000-0000-RRRRRRRRRRRR ✅
  - Graph: 00000001-SSSS-TTTT-00RR-FFFFFFFFFFFF ✅
  - FK refs in payloads use V2 Data UUID format ✅

Legacy Collections (untouched):
  nexsus:       exists ✅
  nexsus_data:  exists ✅
  nexsus_graph: exists ✅
```

### Pre-Completion Checklist

- [x] src/services/unified-graph-sync.ts created
- [x] src/services/unified-data-sync.ts created
- [x] syncDataToUnified() uses V2 Data UUIDs
- [x] upsertUnifiedRelationship() uses V2 Graph UUIDs
- [x] point_type: 'data' on all data points
- [x] point_type: 'graph' on all graph points
- [x] FK *_qdrant fields use V2 Data UUID format
- [x] graph_refs arrays populated on data points
- [x] scripts/test-stage4-data-sync.ts created
- [x] All 13 test scenarios pass
- [x] Schema points unchanged (~17,936)
- [x] Legacy collections intact
- [x] Build succeeds with no errors

---

## 🔄 STAGE 6: MCP Tools Migration

### Status: ✅ COMPLETED (2025-12-27)

### Implementation Summary

Migrated all MCP tools to use V2 UUIDs when `USE_UNIFIED_COLLECTION=true`. This enables Railway production to use the unified collection with deterministic V2 UUIDs while preserving rollback capability via the feature flag.

### Implementation Log

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 6.1 | Update inspect_record in pipeline-tool.ts | ✅ | Uses buildDataUuidV2/buildSchemaUuidV2 |
| 6.2 | Update graph_traverse in graph-tool.ts | ✅ | Uses buildDataUuidV2 for starting point |
| 6.3 | Update cascade-sync.ts | ✅ | V2 UUIDs + upserts to unified collection |
| 6.4 | Update types.ts | ✅ | PipelineDataPayload accepts 'data' \| 'pipeline_data' |
| 6.5 | Update vector-client.ts | ✅ | Added upsertToUnifiedCollection() |
| 6.6 | Update CLAUDE.md documentation | ✅ | New architecture diagram + V2 UUID formats |
| 6.7 | Add deprecation comments | ✅ | nexsus-sync.ts, knowledge-graph.ts, fk-id-builder.ts |

### Files Modified

| File | Changes |
|------|---------|
| `src/tools/pipeline-tool.ts` | V2 UUID generation for inspect_record |
| `src/tools/graph-tool.ts` | V2 UUID generation for graph_traverse |
| `src/services/cascade-sync.ts` | V2 UUID generation + unified collection upsert |
| `src/services/vector-client.ts` | Added upsertToUnifiedCollection() |
| `src/types.ts` | point_type accepts 'data' \| 'pipeline_data' |
| `CLAUDE.md` | Updated architecture + environment variables |
| `src/services/nexsus-sync.ts` | Added @deprecated comment |
| `src/services/knowledge-graph.ts` | Added @deprecated comment |
| `src/utils/fk-id-builder.ts` | Added @deprecated comment |

### V2 UUID Usage in Tools

| Tool | UUID Type | Function Used |
|------|-----------|---------------|
| `inspect_record` (data) | Data | `buildDataUuidV2(modelId, recordId)` |
| `inspect_record` (schema) | Schema | `buildSchemaUuidV2(fieldId)` |
| `graph_traverse` | Data | `buildDataUuidV2(modelId, recordId)` |
| `pipeline_sync` | Data | `buildDataUuidV2(modelId, recordId)` |

### Rollback Strategy

**Quick Rollback (Feature Flag):**
```bash
# Railway ENV - disable unified mode instantly
USE_UNIFIED_COLLECTION="false"
```
All tools revert to legacy collections immediately.

**Full Rollback (Git):**
```bash
git revert <commit-hash>
```

### Railway ENV Configuration

```
USE_UNIFIED_COLLECTION="true"        # ✅ Enable unified mode
UNIFIED_COLLECTION_NAME="nexsus_unified"  # Collection name
EMBEDDING_MODEL="voyage-3.5-lite"    # Recommended model
```

### Build Verification

```bash
npm run build
# Output: tsc (no errors)
```

### Pre-Completion Checklist

- [x] inspect_record uses V2 UUIDs for data + schema
- [x] graph_traverse uses V2 UUIDs
- [x] cascade-sync.ts uses V2 UUIDs + upsertToUnifiedCollection
- [x] vector-client.ts has upsertToUnifiedCollection()
- [x] types.ts updated for point_type flexibility
- [x] CLAUDE.md updated with unified architecture
- [x] Deprecation comments added to legacy services
- [x] Build succeeds with no errors
- [x] Rollback strategy documented

---

## 🔄 ROLLBACK STRATEGY (Per Stage)

### Stage-Specific Rollback Procedures

| Stage | Rollback Procedure | Time Required |
|-------|-------------------|---------------|
| **0** | Delete generated Excel, use existing | Immediate |
| **1** | No rollback needed - pure additions | N/A |
| **2** | Rename backups back to original names | ~5 min |
| **3** | Clear nexsus_unified, restore from backup | ~10 min |
| **4** | Clear 10 records from unified | ~1 min |
| **5** | Delete nexsus_unified, restore all backups | ~30 min |
| **6** | Set `USE_UNIFIED_COLLECTION=false` in Railway ENV | Immediate |

---

## 📁 CRITICAL FILES REFERENCE

### Files to Create (New)

| File | Stage | Purpose | Status |
|------|-------|---------|--------|
| `scripts/generate-schema-from-odoo.ts` | 0 | Auto-generate V2 Excel schema | ✅ Created |
| `src/services/odoo-schema-fetcher.ts` | 0 | Fetch ir.model.fields from Odoo | ✅ Created |
| `src/utils/uuid-v2.ts` | 1 | V2 UUID functions (build, parse, validate) | ✅ Created |
| `scripts/test-uuid-v2.ts` | 1 | V2 UUID test suite | ✅ Created |
| `scripts/create-unified-collection.ts` | 2 | Create unified with indexes | ✅ Created |
| `scripts/test-unified-collection.ts` | 2 | Stage 2 test suite | ✅ Created |
| `src/services/unified-schema-sync.ts` | 3 | Schema sync to unified collection | ✅ Created |
| `scripts/test-stage3-schema-sync.ts` | 3 | Stage 3 test suite | ✅ Created |
| `src/services/unified-graph-sync.ts` | 4 | Graph sync to unified collection | ✅ Created |
| `src/services/unified-data-sync.ts` | 4 | Data sync to unified collection | ✅ Created |
| `scripts/test-stage4-data-sync.ts` | 4 | Stage 4 test suite | ✅ Created |
| `src/utils/cross-reference-builder.ts` | 5+ | Build graph_refs, schema_ref | ⏳ Pending |
| `scripts/test-semantic-grouping.ts` | 6 | Test vector text format | ⏳ Pending |

### Files to Modify (Existing)

| File | Stage | Changes | Impact | Status |
|------|-------|---------|--------|--------|
| `src/constants.ts` | 1, 2 | Add UUID_NAMESPACES, RELATIONSHIP_TYPES, UNIFIED_CONFIG | 🟢 Low | ✅ Done |
| `src/types.ts` | 1, 6 | Add FieldCategory, update NexsusSchemaRow | 🟢 Low | ✅ Done (Stage 1) |
| `src/services/vector-client.ts` | 2 | Add createUnifiedCollection, getUnifiedCollectionInfo, deleteUnifiedCollection | 🟡 Medium | ✅ Done |
| `src/utils/uuid-v2.ts` | 2 | Fixed UUID formats to valid 5-segment format | 🟡 Medium | ✅ Done |
| `src/utils/fk-id-builder.ts` | 4 | Add V2 FK functions | 🟢 Low | ⏳ Pending |
| `src/services/knowledge-graph.ts` | 4 | V2 IDs, add schema_ref | 🟡 Medium | ⏳ Pending |

---

## Summary

This plan provides a **step-by-step migration** from the current 3-collection V1 architecture to a **unified V2 architecture** with:

1. **Stage 0 First**: Auto-generate schema from Odoo (foundation)
2. **Incremental Stages**: Each builds on previous, with clear tests
3. **Low-Risk Approach**: V1 backups preserved, rollback at any stage
4. **Clear Verification**: Both Claude Code and Claude.ai can verify
5. **Complete Test Matrix**: 40+ test scenarios across all stages
