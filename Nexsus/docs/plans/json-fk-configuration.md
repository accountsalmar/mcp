# JSON FK Configuration & Dynamic Detection

## Overview
Add JSON FK configurations for all `analytic_distribution` fields and build a dynamic detection system to auto-discover JSON FK fields during schema sync. This enables uniform handling of all 40 JSON fields in the system (11 FK + 17 metadata + 12 computed/excluded).

**Key Innovation:** New `mapping_type` field distinguishes FK fields (need UUID resolution) from metadata fields (track only).

---

## Stages

### Stage 1: Schema & Type Updates
**Goal:** Add `mapping_type` to JsonFkMapping interface and update configuration file
**Estimated effort:** Simple

**Tasks:**
- [ ] Update `src/common/types.ts` - Add `mapping_type: 'fk' | 'metadata' | 'computed'` to JsonFkMapping interface
- [ ] Update `data/json_fk_mappings.json` - Add all 28 mappings (11 FK + 17 metadata)
- [ ] Bump config version to 2

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - TypeScript compiles without errors
- [ ] `npm run sync -- status` - Config loads: "Loaded 28 JSON field mappings"

**Tests (claude.ai - HTTP):**
- [ ] Call `system_status` tool - Should show no errors
- [ ] Check MCP server logs for JsonFkConfig loaded message

**Success Criteria:**
- TypeScript builds successfully
- Config file validates with new schema
- Existing sync functionality unchanged

---

### Stage 2: Transformer Logic Update
**Goal:** Only build Qdrant UUIDs for FK fields, skip metadata fields
**Estimated effort:** Simple

**Tasks:**
- [ ] Update `src/pipeline/services/pipeline-data-transformer.ts` line 308
- [ ] Change condition from `if (jsonFkMapping)` to `if (jsonFkMapping?.mapping_type === 'fk')`
- [ ] Add logging for metadata fields (optional)

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - Compiles without errors
- [ ] `npm run sync -- sync model account.move.line --dry-run` - FK fields show _qdrant UUIDs
- [ ] Sync a model with metadata field (e.g., crm.lead) - No _qdrant for duration_tracking

**Tests (claude.ai - HTTP):**
- [ ] `semantic_search` for crm.lead records - Check duration_tracking stored but no _qdrant
- [ ] `nexsus_search` with `link_json: ["analytic_distribution"]` - FK resolution works

**Success Criteria:**
- FK fields get `_qdrant` UUIDs as before
- Metadata fields stored but no UUID generation
- No performance regression

---

### Stage 3: Config Service Enhancements
**Goal:** Add write functions for programmatic config updates
**Estimated effort:** Medium

**Tasks:**
- [ ] Add `getConfigFilePath()` to `src/common/services/json-fk-config.ts`
- [ ] Add `hasJsonFkMapping(sourceModel, fieldName)` function
- [ ] Add `addJsonFkMapping(mapping)` function with backup
- [ ] Add `getJsonFkMappingsByType(type)` function

**Tests (Claude Code - stdio):**
- [ ] Unit test: `hasJsonFkMapping('account.move.line', 'analytic_distribution')` returns true
- [ ] Unit test: `getJsonFkMappingsByType('fk')` returns 11 entries
- [ ] Unit test: `getJsonFkMappingsByType('metadata')` returns 17 entries

**Tests (claude.ai - HTTP):**
- [ ] N/A - Internal service, no MCP tool exposure yet

**Success Criteria:**
- All new functions work correctly
- Config file backup created before modifications
- Backward compatible with existing callers

---

### Stage 4: JSON FK Detector Service
**Goal:** Build detection engine for auto-discovering JSON FK fields
**Estimated effort:** Complex

**Tasks:**
- [ ] Create `src/pipeline/services/json-fk-detector.ts`
- [ ] Implement naming convention detection (patterns: *_distribution, *_ids)
- [ ] Implement non-FK pattern exclusion (*_search, *_settings, *_config)
- [ ] Implement data sampling detection (query Odoo for 5 sample records)
- [ ] Calculate confidence scores (0.0-1.0)
- [ ] Export `detectJsonFkFields(options)` function
- [ ] Export `generateConfigEntries(candidates, minConfidence)` function

**Tests (Claude Code - stdio):**
- [ ] `npm run build` - Compiles without errors
- [ ] Unit test: `detectJsonFkFields({modelFilter: 'account.move.line'})` finds analytic_distribution
- [ ] Unit test: Non-FK patterns correctly excluded

**Tests (claude.ai - HTTP):**
- [ ] N/A - Internal service, exposed via CLI in Stage 5

**Success Criteria:**
- Naming convention detection: 70%+ confidence
- Data sampling detection: 95%+ confidence when data exists
- Non-FK fields correctly identified and excluded

---

### Stage 5: CLI Command
**Goal:** Create `discover-json-fk` CLI command
**Estimated effort:** Medium

**Tasks:**
- [ ] Create `src/pipeline/cli/commands/discover-json-fk.ts`
- [ ] Register command in `src/pipeline/cli/index.ts`
- [ ] Implement `--model <name>` filter option
- [ ] Implement `--min-confidence <n>` threshold option
- [ ] Implement `--add-config` auto-update flag
- [ ] Implement `--dry-run` preview mode
- [ ] Add colored output with ora spinners

**Tests (Claude Code - stdio):**
- [ ] `npm run sync -- discover-json-fk` - Shows all JSON fields
- [ ] `npm run sync -- discover-json-fk --model crm.lead` - Filters to one model
- [ ] `npm run sync -- discover-json-fk --min-confidence 0.9` - Shows high-confidence only
- [ ] `npm run sync -- discover-json-fk --add-config --dry-run` - Previews without changing

**Tests (claude.ai - HTTP):**
- [ ] N/A - CLI only, not MCP tool

**Success Criteria:**
- Command runs without errors
- Output clearly shows FK vs metadata fields
- Confidence scores displayed
- --add-config updates json_fk_mappings.json correctly

---

## Dependencies
- Node.js and npm installed
- Qdrant connection configured
- Odoo API access for data sampling
- Existing schema synced to Qdrant

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| False positives in detection | Default to --dry-run, require explicit --add-config |
| Breaking existing sync | mapping_type defaults to 'fk' for backward compatibility |
| API rate limits during sampling | Sample only 5 records per field, add delays |
| Config file corruption | Backup before any modifications, version number in config |
| Numeric-looking keys in metadata | Check mapping_type before UUID generation |

## Notes

### JSON Field Inventory (40 total)
- **11 FK fields**: All `analytic_distribution` variants targeting `account.analytic.account`
- **17 Metadata fields**: duration_tracking, send_and_print_values, homemenu_config, etc.
- **12 Computed fields**: *_search variants (excluded from config)

### Key Design Decisions
1. **mapping_type field**: Explicit type prevents accidental FK resolution on metadata
2. **Manual config authoritative**: Auto-detection suggests, doesn't override existing entries
3. **Backward compatible**: Existing config entries work with new schema (default to 'fk')

### Configuration Schema v2
```json
{
  "version": 2,
  "description": "JSON field mappings - FK fields for resolution, metadata for tracking",
  "mappings": [
    {
      "source_model": "account.move.line",
      "field_name": "analytic_distribution",
      "mapping_type": "fk",
      "key_target_model": "account.analytic.account",
      "key_target_model_id": 177,
      "key_type": "record_id",
      "value_type": "percentage"
    },
    {
      "source_model": "crm.lead",
      "field_name": "duration_tracking",
      "mapping_type": "metadata",
      "description": "Time spent in each workflow stage",
      "key_type": "string",
      "value_type": "duration_ms"
    }
  ]
}
```

### Files to Modify/Create
| File | Action |
|------|--------|
| `data/json_fk_mappings.json` | MODIFY - Add 28 mappings |
| `src/common/types.ts` | MODIFY - Add mapping_type to interface |
| `src/pipeline/services/pipeline-data-transformer.ts` | MODIFY - Check mapping_type |
| `src/common/services/json-fk-config.ts` | MODIFY - Add write functions |
| `src/pipeline/services/json-fk-detector.ts` | CREATE - Detection engine |
| `src/pipeline/cli/commands/discover-json-fk.ts` | CREATE - CLI command |
| `src/pipeline/cli/index.ts` | MODIFY - Register command |
