# Rename Nexsus1 to Finance_Reports1

## Overview
Rename all instances of "Nexsus/Nexsus1" to "Finance_Reports/Finance_Reports1" for legal compliance. The MCP server must remain fully functional after each stage.

**Exclusions (DO NOT rename):**
- `nexsus1_unified` - Qdrant collection name (no data migration)
- Environment variable names (e.g., `NEXSUS_EXCEL_FILE`)

---

## Stages

### Stage 1: MCP Tool Name - COMPLETED
**Goal:** Rename the user-visible `nexsus_search` tool to `finance_reports_search`
**Estimated effort:** Simple

**Tasks:**
- [x] Update tool registration in `src/exact/tools/nexsus-search.ts` line 271: `'nexsus_search'` → `'finance_reports_search'`
- [x] Update console.error log message in the same file

**Tests (Claude Code - stdio):**
- [x] `npm run build` - TypeScript compiles without errors
- [x] `npm start` - Server starts, check logs show `finance_reports_search` registered
- [ ] In Claude Code, call `finance_reports_search` with `{"model_name": "master", "limit": 1}` - returns data

**Tests (claude.ai - HTTP):**
- [ ] Deploy to Railway (auto-deploys on push)
- [ ] In claude.ai, ask: "Use finance_reports_search to get 1 record from master"
- [ ] Verify tool executes and returns results

**Success Criteria:**
- [x] Old tool name `nexsus_search` no longer appears in tool list
- [x] New tool name `finance_reports_search` is callable and functional

---

### Stage 2: CLI Binary Names
**Goal:** Rename CLI commands from `nexsus1`/`nexsus1-sync` to `finance-reports1`/`finance-reports1-sync`
**Estimated effort:** Simple

**Tasks:**
- [ ] Update `package.json` line 8: `"nexsus1"` → `"finance-reports1"`
- [ ] Update `package.json` line 9: `"nexsus1-sync"` → `"finance-reports1-sync"`

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - Compiles without errors
- [ ] `npm run sync -- status` - CLI works via npm script
- [ ] `npx finance-reports1-sync status` - Binary name works

**Tests (claude.ai - HTTP):**
- [ ] N/A - CLI binaries not used in HTTP mode

**Success Criteria:**
- `finance-reports1-sync` command works
- Old binary names no longer exist

---

### Stage 3: Documentation Updates
**Goal:** Update all user-facing documentation to reflect new naming
**Estimated effort:** Medium

**Tasks:**
- [ ] `CLAUDE.md` (root) - Update title, tool references, CLI commands
- [ ] `README.md` - Update project name, tool names, CLI commands
- [ ] `README-MCP-SETUP.md` - Update setup instructions
- [ ] `STANDALONE-SETUP-COMPLETE.md` - Update references
- [ ] `docs/SKILL-nexsus-search.md` - Rename to `SKILL-finance-reports-search.md` and update content
- [ ] `src/knowledge/static/tool-guidelines/nexsus-search.md` - Rename and update
- [ ] `.mcp.json` - Update description (keep server ID for now)

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - Still compiles
- [ ] `npm start` - Server still starts
- [ ] Grep for `nexsus_search` in docs - should return 0 matches

**Tests (claude.ai - HTTP):**
- [ ] N/A - Documentation changes only

**Success Criteria:**
- No user-facing documentation references `nexsus_search` or `nexsus1` CLI
- All docs reference `finance_reports_search` and `finance-reports1`

---

### Stage 4: File Renames
**Goal:** Rename source files containing "nexsus" in their names
**Estimated effort:** Medium

**Tasks:**
- [ ] `git mv src/exact/tools/nexsus-search.ts src/exact/tools/finance-reports-search.ts`
- [ ] `git mv src/common/services/nexsus-link.ts src/common/services/finance-reports-link.ts`
- [ ] `git mv docs/plans/fix-nexsus-search-boolean-indexing.md docs/plans/fix-finance-reports-search-boolean-indexing.md`
- [ ] `git mv docs/plans/nexsus-search-improvements.md docs/plans/finance-reports-search-improvements.md`
- [ ] `git mv docs/plans/nexsus-interconnectivity-audit.md docs/plans/finance-reports-interconnectivity-audit.md`
- [ ] `git mv scripts/archive/inspect-nexsus-export.ts scripts/archive/inspect-finance-reports-export.ts`
- [ ] Rename `nexsus_schema_v2_generated.xlsx` → `finance_reports_schema_v2_generated.xlsx`
- [ ] Update all import statements to reference new file paths

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - TypeScript compiles (imports resolve correctly)
- [ ] `npm start` - Server starts without errors
- [ ] Call `finance_reports_search` - Still works

**Tests (claude.ai - HTTP):**
- [ ] Deploy to Railway
- [ ] Call `finance_reports_search` via claude.ai

**Success Criteria:**
- No source files with "nexsus" in the name (except archived exports)
- All imports updated and working

---

### Stage 5: Constants and Config Rename
**Goal:** Rename internal constants and configuration objects
**Estimated effort:** Simple

**Tasks:**
- [ ] `src/common/constants.ts` line 58: `NEXSUS_CONFIG` → `FINANCE_REPORTS_CONFIG`
- [ ] Update all files importing `NEXSUS_CONFIG` to use new name:
  - `src/common/services/excel-schema-loader.ts`
  - `src/knowledge/dynamic/loaders/excel-knowledge-loader.ts`
- [ ] `src/common/services/r2-client.ts` line 228: `'nexsus_export'` → `'finance_reports_export'`

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - Compiles without errors
- [ ] `npm start` - Server starts
- [ ] Call `system_status` - Returns valid response

**Tests (claude.ai - HTTP):**
- [ ] Deploy and verify `system_status` works

**Success Criteria:**
- No constants named `NEXSUS_*` (except for env var references)
- Export filename prefix changed to `finance_reports_export`

---

### Stage 6: Type and Interface Renames
**Goal:** Rename all TypeScript types/interfaces containing "Nexsus"
**Estimated effort:** Complex

**Tasks:**
- [ ] `src/common/types.ts` - Rename 7 interfaces:
  - `NexsusSchemaRow` → `FinanceReportsSchemaRow`
  - `NexsusPayload` → `FinanceReportsPayload`
  - `NexsusPoint` → `FinanceReportsPoint`
  - `NexsusSyncResult` → `FinanceReportsSyncResult`
  - `NexsusSyncStatus` → `FinanceReportsSyncStatus`
  - `NexsusSearchInput` → `FinanceReportsSearchInput`
  - `NexsusSearchResult` → `FinanceReportsSearchResult`
- [ ] `src/common/schemas/index.ts` - Rename 2 exports:
  - `NexsusSyncSchema` → `FinanceReportsSyncSchema`
  - `NexsusSyncInput` → `FinanceReportsSyncInput`
- [ ] `src/exact/tools/finance-reports-search.ts` - Rename 2 types:
  - `NexsusSearchSchema` → `FinanceReportsSearchSchema`
  - `NexsusSearchSchemaInput` → `FinanceReportsSearchSchemaInput`
- [ ] Update all files importing these types (use IDE/grep to find all references)

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - TypeScript compiles (all type references resolve)
- [ ] `npm start` - Server starts
- [ ] Call `finance_reports_search` with filters - Works correctly
- [ ] Call `semantic_search` - Works (uses NexsusPayload internally)

**Tests (claude.ai - HTTP):**
- [ ] Deploy to Railway
- [ ] Test `finance_reports_search` and `semantic_search` via claude.ai

**Success Criteria:**
- No types named `Nexsus*` in codebase
- All tools still functional

---

### Stage 7: Function Renames
**Goal:** Rename all functions containing "Nexsus" in their names
**Estimated effort:** Medium

**Tasks:**
- [ ] `src/exact/tools/finance-reports-search.ts`: `registerNexsusSearchTool()` → `registerFinanceReportsSearchTool()`
- [ ] `src/console/index.ts`: Update import and call to use new function name
- [ ] `src/common/services/excel-schema-loader.ts`:
  - `loadNexsusSchema()` → `loadFinanceReportsSchema()`
  - `clearNexsusSchemaCache()` → `clearFinanceReportsSchemaCache()`
  - `getNexsusSchemaStats()` → `getFinanceReportsSchemaStats()`
- [ ] `src/common/services/simple-schema-converter.ts`: `convertSimpleSchemaToNexsus()` → `convertSimpleSchemaToFinanceReports()`
- [ ] `src/semantic/tools/search-tool.ts`: `isNexsusPayload()` → `isFinanceReportsPayload()`
- [ ] Update all callers of these functions

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - Compiles without errors
- [ ] `npm start` - Server starts
- [ ] `npm run sync -- sync schema --dry-run` - Schema sync preview works
- [ ] Call all 15 MCP tools - All functional

**Tests (claude.ai - HTTP):**
- [ ] Deploy to Railway
- [ ] Test `blendthink_execute` with a complex query

**Success Criteria:**
- No functions named `*Nexsus*` in codebase
- All 15 MCP tools functional
- CLI sync commands functional

---

### Stage 8: Package Metadata and MCP Config
**Goal:** Update package name and MCP server ID
**Estimated effort:** Simple

**Tasks:**
- [ ] `package.json` line 2: `"name": "nexsus1-mcp"` → `"name": "finance-reports1-mcp"`
- [ ] `.mcp.json`: Server ID `"nexsus1"` → `"finance-reports1"`
- [ ] Update description in `.mcp.json`

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - Compiles
- [ ] `npm start` - Server starts with new identity
- [ ] Verify Claude Code connects to `finance-reports1` server

**Tests (claude.ai - HTTP):**
- [ ] Update Railway environment if needed
- [ ] Verify claude.ai can connect to renamed server

**Success Criteria:**
- Package identified as `finance-reports1-mcp`
- MCP clients connect using new server ID

---

### Stage 9: Final Cleanup
**Goal:** Remove any remaining "nexsus" references (comments, logs, etc.)
**Estimated effort:** Simple

**Tasks:**
- [ ] Search codebase for remaining "nexsus" (case-insensitive)
- [ ] Update comments referencing "Nexsus"
- [ ] Update console.error log messages
- [ ] Verify exclusions are still intact (`nexsus1_unified` collection, env vars)
- [ ] Clean build: `rm -rf dist && npm run build`

**Tests (Claude Code - stdio):**
- [ ] `grep -ri "nexsus" src/` - Only shows exclusions (collection name, env vars)
- [ ] `npm run build && npm start` - Clean build works
- [ ] Run full tool test suite

**Tests (claude.ai - HTTP):**
- [ ] Deploy final version
- [ ] End-to-end test: Ask complex question using blendthink

**Success Criteria:**
- Only allowed "nexsus" references remain (collection name, env vars)
- All functionality verified working

---

## Dependencies
- Node.js 20+
- Access to Railway for HTTP deployment testing
- Qdrant collection `nexsus1_unified` must remain unchanged

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Breaking import paths | Use `git mv` for file renames, update imports immediately |
| Missing type references | Use TypeScript compiler errors to find all usages |
| Railway deployment fails | Test locally first, deploy after each stage |
| Qdrant collection mismatch | NEVER rename `nexsus1_unified` references |

## Notes
- Commit after each stage with descriptive message
- Can rollback individual stage with `git checkout .` if tests fail
- Total estimated time: 2-3 hours for all stages
- Consider running `npm run test` if test suite exists
