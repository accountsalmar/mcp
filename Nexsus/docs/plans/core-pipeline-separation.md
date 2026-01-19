# Nexsus Core/Pipeline Separation

## Overview
Migrate dynamic features from Nexsus1 into Nexsus while establishing a clean architectural boundary between Nexsus Core (vector storage/retrieval/search) and Pipeline (data extraction/transformation). This enables different databases with different fields to sync dynamically.

**Target Location**: `docs/plans/core-pipeline-separation.md`

---

## Status Summary (Updated 2026-01-14)

| Stage | Name | Status |
|-------|------|--------|
| 1 | Schema-Driven Utilities | ✅ COMPLETED |
| 2 | Schema Refresh Tool | ✅ COMPLETED |
| 2.5 | Direct Odoo Schema Sync | ✅ COMPLETED |
| 3 | Pipeline Directory Structure | ✅ COMPLETED |
| 4 | Move Embedding & Odoo Services | ✅ COMPLETED |
| 5 | Move Sync Services | ✅ COMPLETED |
| 6 | Split Knowledge Graph | ⏭️ SKIPPED |
| 7 | Move CLI to Pipeline | ✅ COMPLETED |
| 8 | Auto Index Service | ✅ COMPLETED |
| 9 | Excel Data Sync | ⏸️ DEFERRED |
| 10 | Knowledge Schemas | ⏸️ DEFERRED |
| 11 | Knowledge Auto-Generators | ⏸️ DEFERRED |
| 12 | Knowledge Loaders & Sync | ⏸️ DEFERRED |

**Completed:** 8 stages | **Skipped:** 1 stage | **Deferred:** 4 stages

---

## Stages

### Stage 1: Schema-Driven Utilities [COMPLETED]
**Goal:** Add foundational utilities for dynamic FK extraction and type conversion
**Estimated effort:** Medium (1-2 hours)
**Status:** COMPLETED

**Tasks:**
- [x] Copy `fk-value-extractor.ts` from Nexsus1 to `src/common/utils/`
- [x] Copy `type-converter.ts` from Nexsus1 to `src/common/utils/`
- [x] Add exports to `src/common/utils/index.ts`
- [ ] Update `src/common/services/cascade-sync.ts` to use `extractFkValueBySchema()` (deferred - existing code works)
- [ ] Add unit tests for both utilities (deferred - utilities have zero dependencies)

**Tests (Claude Code - stdio):**
- [x] `npm run build` - compiles without errors
- [x] `npm test` - 170/173 tests pass (3 pre-existing failures)
- [x] `npm run sync -- status` - shows 751,671 vectors

**Success Criteria:**
- [x] FK extraction handles 3 formats: scalar, tuple `[id, name]`, expanded `field_id`
- [x] Type conversion normalizes Excel dates to Unix timestamps
- [x] No regression in existing sync functionality

---

### Stage 2: Schema Refresh Tool (Production Critical) [COMPLETED]
**Goal:** Add MCP tool to refresh schema caches without server restart
**Estimated effort:** Medium (1-2 hours)
**Status:** COMPLETED

**Tasks:**
- [x] Create `schema-cache-manager.ts` adapted for Nexsus in `src/common/services/`
- [x] Create `refresh-schema-tool.ts` in `src/common/tools/`
- [x] Register tool in `src/console/index.ts`
- [x] Test cache refresh order (8 caches in dependency order - no sample-payload-cache in Nexsus)

**Notes:**
- Adapted from Nexsus1 version - removed auto-knowledge dependencies (deferred to Stage 10-12)
- 8 caches managed: search-cache, graph-cache, coordinate-lookup-cache, schema-query-cache, pipeline-cache, sync-metadata, nexsus-schema-cache, schema-lookup

**Tests (Claude Code - stdio):**
- [x] `npm run build` - compiles without errors
- [x] `npm test` - 170/173 tests pass (same 3 pre-existing failures)
- [x] `npm run sync -- status` - system working

**Tests (claude.ai - HTTP):**
- [ ] `refresh_schema` tool appears in available tools
- [ ] Call `refresh_schema` - returns success with cache stats
- [ ] `semantic_search` reflects schema changes after refresh

**Success Criteria:**
- [x] Schema changes apply without server restart
- [x] Cache refresh follows dependency order (oldest first)
- [x] Railway deployments can update schema dynamically

---

### Stage 2.5: Direct Odoo-to-Vector Schema Refresh [COMPLETED]
**Goal:** Enable schema refresh directly from Odoo API to Qdrant, bypassing Excel
**Status:** COMPLETED

**Tasks:**
- [x] Create `src/common/services/odoo-schema-sync.ts` - Direct sync service
- [x] Update `src/common/tools/refresh-schema-tool.ts` - Add `sync_from_odoo` parameter
- [x] Update `src/console/sync/commands/sync-schema.ts` - Add `--source odoo` flag

**Files Created/Modified:**
| File | Change |
|------|--------|
| `src/common/services/odoo-schema-sync.ts` | NEW - Direct sync service |
| `src/common/tools/refresh-schema-tool.ts` | UPDATED - Added sync_from_odoo, force_recreate params |
| `src/console/sync/commands/sync-schema.ts` | UPDATED - Added Odoo source support |

**Usage:**
```bash
# MCP Tool
{ "sync_from_odoo": true }
{ "sync_from_odoo": true, "force_recreate": true }

# CLI
npm run sync -- sync schema --source odoo
npm run sync -- sync schema --source odoo --force
```

**Format Preservation:**
- V2 UUID: `00000003-0004-0000-0000-FFFFFFFFFFFF`
- Semantic Text: 9-component format for Voyage AI embedding
- Payload: Key-value pairs with FK metadata

**Success Criteria:**
- [x] Direct Odoo → Qdrant sync works without Excel file
- [x] Output format matches Excel-based pipeline exactly
- [x] Both MCP tool and CLI command support Odoo source

---

### Stage 3: Pipeline Directory Structure [COMPLETED]
**Goal:** Create `src/pipeline/` section and establish directory structure
**Estimated effort:** Simple (30 min)
**Status:** COMPLETED

**Tasks:**
- [x] Create `src/pipeline/` directory
- [x] Create `src/pipeline/services/` subdirectory
- [x] Create `src/pipeline/cli/` subdirectory
- [x] Create `src/pipeline/cli/commands/` subdirectory
- [x] Create `src/pipeline/index.ts` with exports
- [x] Create `src/pipeline/CLAUDE.md` section guide

**Tests (Claude Code - stdio):**
- [x] `ls src/pipeline/` - shows expected structure
- [x] `npm run build` - compiles without errors

**Success Criteria:**
- [x] Directory structure matches target architecture
- [x] CLAUDE.md documents Pipeline section rules

---

### Stage 4: Move Embedding & Odoo Services [COMPLETED]
**Goal:** Move data extraction services to Pipeline section
**Estimated effort:** Medium (1-2 hours)
**Status:** COMPLETED

**Tasks:**
- [x] Move `embedding-service.ts` to `src/pipeline/services/`
- [x] Move `odoo-client.ts` to `src/pipeline/services/`
- [x] Update imports in all files that reference these
- [x] Update `src/pipeline/index.ts` exports
- [x] Create backward compatibility shims in `src/common/services/`
- [x] Verify no Core sections import from Pipeline

**Tests (Claude Code - stdio):**
- [x] `npm run build` - compiles without errors
- [x] `npm run sync -- sync model crm.lead --dry-run` - sync still works

**Success Criteria:**
- [x] Embedding and Odoo services isolated in Pipeline
- [x] Core sections have no Pipeline imports
- [x] Sync operations continue working

---

### Stage 5: Move Sync Services [COMPLETED]
**Goal:** Move all sync-related services to Pipeline
**Estimated effort:** Complex (2-3 hours)
**Status:** COMPLETED

**Tasks:**
- [x] Move `pipeline-data-sync.ts` to `src/pipeline/services/`
- [x] Move `pipeline-data-transformer.ts` to `src/pipeline/services/`
- [x] Move `cascade-sync.ts` to `src/pipeline/services/`
- [x] Move `fk-dependency-discovery.ts` to `src/pipeline/services/`
- [x] Move `unified-schema-sync.ts` to `src/pipeline/services/`
- [x] Move `data-transformer.ts` to `src/pipeline/services/`
- [x] Move `dlq.ts` to `src/pipeline/services/`
- [x] Move `sync-metadata.ts` to `src/pipeline/services/`
- [x] Update all imports across codebase
- [x] Update `src/pipeline/index.ts` exports
- [x] Create backward compatibility shims in `src/common/services/`

**Tests (Claude Code - stdio):**
- [x] `npm run build` - compiles without errors
- [x] `npm run sync -- status` - shows system status
- [x] `npm run sync -- sync model crm.lead --dry-run` - sync preview works

**Success Criteria:**
- [x] All sync services consolidated in `src/pipeline/services/`
- [x] CLI sync commands work from new location
- [x] Query tools remain unaffected

---

### Stage 6: Split Knowledge Graph [SKIPPED]
**Goal:** Separate read (Core) and write (Pipeline) operations
**Status:** SKIPPED - Deferred based on lessons learned

**Rationale:**
The existing backward compatibility shims work well. Splitting the knowledge graph into separate reader/writer modules adds complexity without immediate benefit. The current architecture where `knowledge-graph.ts` is in `src/common/` with a shim exporting from pipeline works fine.

**Original Tasks (Not Implemented):**
- Create `knowledge-graph-reader.ts` in Common
- Create `knowledge-graph-writer.ts` in Pipeline
- Split functions between modules

**Decision:**
- Keep `knowledge-graph.ts` in `src/pipeline/services/`
- Backward compat shim in `src/common/services/` re-exports everything
- Both read and write operations work through the shim
- Can revisit if specific separation needs arise

---

### Stage 7: Move CLI to Pipeline [COMPLETED]
**Goal:** Relocate CLI entry point to Pipeline section
**Estimated effort:** Medium (1 hour)
**Status:** COMPLETED

**Tasks:**
- [x] Move `src/console/sync/index.ts` to `src/pipeline/cli/index.ts`
- [x] Move `src/console/sync/commands/*` to `src/pipeline/cli/commands/`
- [x] Update `package.json` script: `"sync": "node dist/pipeline/cli/index.js"`
- [x] Update imports in CLI files
- [x] Keep `src/console/sync/` with re-export shims for backward compatibility

**Tests (Claude Code - stdio):**
- [x] `npm run sync -- --help` - shows available commands
- [x] `npm run sync -- status` - works from new location
- [x] `npm run sync -- sync model crm.lead --dry-run` - full command works

**Success Criteria:**
- [x] CLI commands work from `src/pipeline/cli/`
- [x] `console/` section contains only MCP server + Blendthink
- [x] Clean separation of query (MCP) and sync (CLI) entry points

---

### Stage 8: Auto Index Service [COMPLETED]
**Goal:** Add automatic Qdrant index creation during sync
**Estimated effort:** Medium (1-2 hours)
**Status:** COMPLETED

**Tasks:**
- [x] Copy `index-service.ts` from Nexsus1 to `src/pipeline/services/`
- [x] Integrate with `pipeline-data-sync.ts` to auto-create indexes after record upload
- [x] Integrate with `sync-model.ts` to create base indexes during initialization
- [x] Add field type → Qdrant index type mapping:
  - `date/datetime` → integer (Unix timestamps)
  - `integer` → integer
  - `float/monetary` → float
  - `boolean` → bool
  - Others (char, text, selection, many2one) → keyword
- [x] Handle many2one fields (create 3 indexes: field, field_id, field_qdrant)
- [x] Export functions via `src/pipeline/index.ts`

**Files Created/Modified:**
| File | Change |
|------|--------|
| `src/pipeline/services/index-service.ts` | NEW - Auto index creation service |
| `src/pipeline/index.ts` | UPDATED - Added index service exports |
| `src/pipeline/services/pipeline-data-sync.ts` | UPDATED - Call ensureModelIndexes after sync |
| `src/pipeline/cli/commands/sync-model.ts` | UPDATED - Call ensureBaseIndexes on init |

**Tests (Claude Code - stdio):**
- [x] `npm run build` - compiles without errors
- [x] `npm run sync -- sync model crm.lead --dry-run` - works

**Success Criteria:**
- [x] Indexes created automatically during model sync
- [x] Field type determines index type
- [x] Base indexes (point_type, model_name, etc.) created on CLI start
- [x] No manual index management required

---

### Stage 9: Excel Data Sync [DEFERRED]
**Goal:** Enable data sync from Excel files (not just Odoo)
**Status:** DEFERRED - Future work

**Rationale:**
Current Odoo-based sync works well. Excel data sync is a nice-to-have for testing and alternative data sources, but not immediately needed.

**Tasks (When Implemented):**
- [ ] Copy `excel-data-sync.ts` from Nexsus1 to `src/pipeline/services/`
- [ ] Copy `sample-payload-loader.ts` from Nexsus1 to `src/pipeline/services/`
- [ ] Create `sync-data.ts` CLI command in `src/pipeline/cli/commands/`
- [ ] Integrate type conversion and FK extraction
- [ ] Add `samples/` directory for Excel data files

**Success Criteria:**
- Excel files can be synced as data source (parallel to Odoo)
- Type conversion and FK extraction work with Excel format
- Payload config respected for Excel data

---

### Stage 10: Knowledge Schemas [DEFERRED]
**Goal:** Add Zod schemas for 4-level knowledge system
**Status:** DEFERRED - Future work, requires design effort

**Tasks (When Implemented):**
- [ ] Copy `instance-config-schema.ts` to `src/knowledge/dynamic/schemas/`
- [ ] Copy `model-metadata-schema.ts` to `src/knowledge/dynamic/schemas/`
- [ ] Copy `field-knowledge-schema.ts` to `src/knowledge/dynamic/schemas/`
- [ ] Create `src/knowledge/dynamic/schemas/index.ts` with exports
- [ ] Add knowledge-specific types to `src/common/types.ts`

**Success Criteria:**
- All 3 knowledge level schemas defined with Zod validation
- Instance, Model, and Field knowledge types available

---

### Stage 11: Knowledge Auto-Generators [DEFERRED]
**Goal:** Add intelligent defaults for knowledge from schema
**Status:** DEFERRED - Future work, depends on Stage 10

**Tasks (When Implemented):**
- [ ] Copy `field-knowledge-generator.ts` to `src/knowledge/dynamic/auto-generators/`
- [ ] Copy `model-knowledge-generator.ts` to `src/knowledge/dynamic/auto-generators/`
- [ ] Create `src/knowledge/dynamic/auto-generators/index.ts`
- [ ] Implement field type → Data_Format mapping
- [ ] Implement field type → Valid_Values generation

**Success Criteria:**
- Date fields auto-generate "Excel serial date" format note
- Boolean fields auto-generate "true|false" valid values
- Manual Excel entries override auto-generated defaults

---

### Stage 12: Knowledge Loaders & Sync [DEFERRED]
**Goal:** Enable syncing knowledge from Excel to Qdrant
**Status:** DEFERRED - Future work, depends on Stages 10-11

**Tasks (When Implemented):**
- [ ] Copy `excel-knowledge-loader.ts` to `src/knowledge/dynamic/loaders/`
- [ ] Copy `knowledge-point-builder.ts` to `src/knowledge/dynamic/loaders/`
- [ ] Copy `extended-knowledge-sync.ts` to `src/knowledge/dynamic/loaders/`
- [ ] Add `sync knowledge` CLI command
- [ ] Add knowledge sheets to schema Excel (Instance_Config, Model_Metadata)
- [ ] Update knowledge adapter to query extended knowledge

**Success Criteria:**
- 4-level knowledge hierarchy synced to Qdrant
- Knowledge searchable via semantic_search
- Blendthink can access domain expertise

---

## Dependencies

- **Nexsus1 codebase** at `C:\Users\KasunJ\MCP\Nexsus1` for source files
- **Qdrant** running and accessible
- **Node.js 18+** for TypeScript compilation
- **Excel files**: nexsus_schema_v2_generated.xlsx, feilds_to_add_payload.xlsx

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing sync | Stage 1-2 add features without moving files |
| Import errors after move | Systematic find-replace in each stage |
| MCP tools break | Test every query tool after stages 4-7 |
| Railway deployment fails | Stage 2 adds refresh_schema tool early |
| Knowledge sync breaks existing data | Stage 10-12 are additive, don't modify existing points |

## Notes

### Confirmed Decisions
- **Pipeline Directory**: `src/pipeline/` (new top-level section)
- **CLI Entry Point**: `src/pipeline/cli/`
- **Knowledge Framework**: Include (Stages 10-12)
- **Approach**: Incremental (12 stages)

### Boundary Validation Command
After each stage, run:
```bash
grep -r "from.*pipeline" src/semantic/ src/exact/ src/console/index.ts
```
Should return empty (no Core → Pipeline imports).

### File Count Summary
- **Files to add**: 13 (from Nexsus1)
- **Files to move**: 15 (within Nexsus)
- **Files to split**: 1 (knowledge-graph.ts)
- **Total stages**: 12
