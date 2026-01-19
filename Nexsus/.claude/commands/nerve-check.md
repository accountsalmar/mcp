# /nerve-check - Nexsus 5-Section Nervous System Health Check

**Role**: You are the **Nervous System Doctor** for the Nexsus codebase. Your job is to diagnose the health of communication pathways between the 5 sections, identify "nerve damage" (broken connections), detect "inflammation" (degrading architecture), and prescribe treatment.

**Scope**: This command runs ONLY within `C:\Users\KasunJ\MCP\Nexsus`. Always run the FULL examination (all 6 phases) - no quick modes, no shortcuts.

**Execution**: Run ALL 6 phases sequentially. Generate the diagnostic report AND fix instruction files at the end.

---

## The 5-Section Anatomy

| Section | Nervous System Role | Key Responsibility |
|---------|--------------------|--------------------|
| **common/** | Spinal Cord | Shared infrastructure - all signals pass through here |
| **exact/** | Left Brain | Precise, logical, factual data retrieval |
| **semantic/** | Right Brain | Pattern recognition, similarity, discovery |
| **knowledge/** | Memory Centers | Domain expertise, learned rules, operational manual |
| **console/** | Prefrontal Cortex | Orchestration, decision-making, synthesis |

---

## Severity Classification (Diagnosis Tiers)

You MUST classify every finding into one of these four tiers:

### CRITICAL - Nerve Damage (Immediate Failure)
*System cannot function correctly. Stop and fix before proceeding.*

| Condition | Why It's Critical |
|-----------|-------------------|
| `common/` imports from ANY other section (semantic/, exact/, knowledge/, console/) | Architecture foundation corrupted - common must be the base |
| Any section imports from `console/` | Dependency inversion - signals flowing backward |
| `npm run build` fails with errors | System won't compile - nothing works |
| MCP server won't start | Tools unavailable to Claude |
| CLAUDE.md file missing from any section | Section rules undefined - boundaries unclear |

### HIGH - Nerve Strain (Must Fix Soon)
*System runs but architecture is degrading. Fix before next deployment.*

| Condition | Why It's High Priority |
|-----------|------------------------|
| Semantic results appearing in exact/ output (similarity scores in nexsus_search) | Section bleed - boundaries violated |
| Missing exports that other sections depend on | Broken contracts between sections |
| Circular dependencies detected | Signal loops causing confusion |
| Knowledge files >30 days stale on CHANGED features | Operational manual outdated for active code |
| File in manifest doesn't exist | CLAUDE.md promises broken |
| exact/ importing console/ services | Wrong dependency direction |

### WARNING - Inflammation (Monitor)
*Technical debt accumulating. Note it, fix when convenient.*

| Condition | Why It's a Warning |
|-----------|-------------------|
| Knowledge files outdated but feature unchanged | Low priority - feature stable |
| Missing similarity scores in semantic results | Semantic contract partially violated |
| Console duplicating logic instead of calling sections | Redundancy, not breakage |
| File exists but not listed in section manifest | Manifest incomplete |
| Unused imports in section files | Cleanup opportunity |

### INFO - Routine Checkup Notes
*Observations for awareness. Does not affect pass/fail.*

| Condition | Why It's Informational |
|-----------|------------------------|
| Section has fewer files than manifest lists | Files may have been intentionally deleted |
| New files created but not yet added to manifest | Manifest needs updating |
| Comments mentioning TODO or FIXME | Developer notes for future |
| Section directory exists but is empty (knowledge/) | Placeholder section - expected |

---

## Examination Procedure (5 Phases)

Execute ALL phases in order. Do not skip any phase.

---

### Phase 1: Structural Integrity (The Skeleton)

**Objective**: Verify the 5-section structure exists and is complete.

**Step 1.1 - Check Directories Exist:**
```bash
dir /B src\exact
dir /B src\semantic
dir /B src\knowledge
dir /B src\common
dir /B src\console
```

**Step 1.2 - Check CLAUDE.md Files Exist and Have Content:**

Read each section's CLAUDE.md file:
- `src/exact/CLAUDE.md`
- `src/semantic/CLAUDE.md`
- `src/knowledge/CLAUDE.md`
- `src/common/CLAUDE.md`
- `src/console/CLAUDE.md`

Verify each contains:
- "Section Objective" heading
- "File Ownership Manifest" section
- "Anti-Patterns" section
- "Access Control" section

**Step 1.3 - Verify File Ownership Manifests:**

For each section, read the files listed under "File Ownership Manifest" and verify they exist:

**Common Section Files to Check:**
```
src/types.ts
src/constants.ts
src/schemas/index.ts
src/services/vector-client.ts
src/services/embedding-service.ts
src/services/odoo-client.ts
src/services/schema-loader.ts
src/services/schema-lookup.ts
src/services/knowledge-graph.ts
src/services/nexsus-link.ts
src/services/logger.ts
src/services/circuit-breaker.ts
src/services/metrics.ts
src/services/dlq.ts
src/services/cache-service.ts
```

**Semantic Section Files to Check:**
```
src/tools/search-tool.ts
src/services/analytics-service.ts
src/services/graph-search-engine.ts
```

**Exact Section Files to Check:**
```
src/tools/nexsus-search.ts
src/tools/data-tool.ts
src/services/aggregation-engine.ts
src/services/filter-builder.ts
src/services/scroll-engine.ts
src/services/token-estimator.ts
src/services/dot-notation-resolver.ts
src/services/data-grid.ts
```

**Console Section Files to Check:**
```
src/sync/index.ts
src/services/pipeline-data-sync.ts
src/services/cascade-sync.ts
src/services/sync-metadata.ts
src/console/blendthink/engine.ts (if exists)
```

**Knowledge Section Files to Check:**
```
src/knowledge/adapter/knowledge-adapter.ts (if exists)
src/knowledge/static/ directory (if exists)
```

**Record findings for each file: EXISTS / MISSING / MOVED**

---

### Phase 2: Communication Pathways (The Nerves)

**Objective**: Analyze imports to verify section boundaries are respected.

**Access Control Matrix (The Rules):**

| Section | CAN Import From | CANNOT Import From (VIOLATION) |
|---------|-----------------|-------------------------------|
| common/ | External packages ONLY | semantic/, exact/, knowledge/, console/ |
| semantic/ | common/, external | console/, (exact/ read-only) |
| exact/ | common/, external, semantic/ (calls only) | console/ |
| knowledge/ | common/, exact/, semantic/, external | console/ |
| console/ | ALL sections, external | - (top of tree) |

**Step 2.1 - Scan for CRITICAL Violations (common/ importing from sections):**

Search for imports in common/ that reference other sections:
```bash
findstr /S /N "from.*\.\.\/semantic\|from.*\.\.\/exact\|from.*\.\.\/console\|from.*\.\.\/knowledge" src\services\*.ts src\types.ts src\constants.ts src\utils\*.ts src\schemas\*.ts
```

Also check for:
```bash
findstr /S /N "from.*src\/semantic\|from.*src\/exact\|from.*src\/console\|from.*src\/knowledge" src\services\*.ts src\types.ts src\constants.ts
```

**Any match = CRITICAL violation**

**Step 2.2 - Scan for Section→Console Violations:**

No section except console itself should import from console:
```bash
findstr /S /N "from.*\.\.\/console\|from.*\.\.\/sync\|from.*src\/console\|from.*src\/sync" src\tools\*.ts src\services\*.ts
```

**Any match in non-console files = CRITICAL violation**

**Step 2.3 - Document Import Dependencies:**

For each section, list what it actually imports and verify against allowed list.

---

### Phase 3: Cross-Section Compatibility (The Synapses)

**Objective**: Verify each section pair can communicate through defined contracts.

**Step 3.1 - Test Key Communication Pathways:**

| Pathway | How to Verify | Expected |
|---------|---------------|----------|
| console/ → semantic/ | Check if console can import search-tool functions | Should work |
| console/ → exact/ | Check if console can import nexsus-search functions | Should work |
| console/ → common/ | Check if console uses vector-client, odoo-client | Should work |
| console/ → knowledge/ | Check if blendthink uses knowledge adapter | Should work (if exists) |
| exact/ → semantic/ | Check if exact calls semantic for suggestions | Allowed (calls only) |
| exact/ → common/ | Check if exact uses shared types, vector-client | Should work |
| semantic/ → common/ | Check if semantic uses embedding-service, vector-client | Should work |
| ALL → common/ | Verify common types are used consistently | Should work |

**Step 3.2 - Verify Key Exports Exist:**

**Common must export:**
- `vectorClient` or vector client functions
- `embeddingService` or embedding functions
- `odooClient` or Odoo client functions
- Types from `types.ts`

**Semantic must export:**
- `semanticSearch` function or tool handler
- `findSimilar` function or tool handler

**Exact must export:**
- `nexsusSearch` function or tool handler
- `aggregationEngine` functions

**Console must export:**
- CLI command handlers
- BlendthinkEngine (if implemented)

**Step 3.3 - Check for Section Bleed:**

Read `src/tools/nexsus-search.ts` and verify:
- NO similarity scores in output (that's semantic's job)
- NO fuzzy matching logic
- Results are EXACT data only

Read `src/tools/search-tool.ts` and verify:
- Similarity scores ARE included in output
- Results indicate they are semantic/vector matches

---

### Phase 4: Knowledge Freshness (The Memory)

**Objective**: Ensure knowledge section has latest information about recent developments.

**Step 4.1 - Get Recent Changes Per Section:**

```bash
git log --oneline -10 --name-only -- src/exact/
git log --oneline -10 --name-only -- src/semantic/
git log --oneline -10 --name-only -- src/common/
git log --oneline -10 --name-only -- src/console/
git log --oneline -10 --name-only -- src/knowledge/
```

**Step 4.2 - Identify Knowledge-Impacting Changes:**

For each recent commit, determine if knowledge/ needs updating:

| Change Type | Knowledge Update Required? | Priority |
|-------------|---------------------------|----------|
| New MCP tool added | YES - add tool guidelines | HIGH |
| Tool parameters changed | YES - update tool docs | HIGH |
| New blendthink feature | YES - update blending guide | HIGH |
| New CLI command | YES - add to operational manual | HIGH |
| Bug fix (no behavior change) | NO | - |
| Refactoring (no behavior change) | NO | - |
| New type definitions | MAYBE - if user-facing | WARNING |

**Step 4.3 - Check Knowledge Files Freshness:**

Read these knowledge files (if they exist) and compare to current implementation:

```
src/knowledge/static/tool-guidelines/nexsus-search.md
src/knowledge/static/tool-guidelines/semantic-search.md
src/knowledge/static/tool-guidelines/graph-traverse.md
src/knowledge/static/blending/blendthink-guide.md
src/knowledge/static/general/data-verification.md
```

**Step 4.4 - Calculate Staleness:**

For each knowledge file:
1. Get last modified date: `git log -1 --format="%ai" -- [file]`
2. Get last change to related feature: `git log -1 --format="%ai" -- src/[related-section]/`
3. If knowledge file is older AND feature changed = STALE

**Staleness Rules:**
- >30 days stale on changed feature = HIGH
- >30 days stale on unchanged feature = WARNING
- <30 days = OK

---

### Phase 5: Build & Runtime (The Heartbeat)

**Objective**: Verify the system compiles and runs.

**Step 5.1 - TypeScript Build:**

```bash
npm run build
```

**Expected**: Exit code 0, no errors
**CRITICAL if**: Build fails with errors
**WARNING if**: Build succeeds but has warnings

**Step 5.2 - CLI Verification:**

```bash
npm run sync -- status
```

**Expected**: Shows collection counts, no errors
**CRITICAL if**: Command fails to run
**WARNING if**: Shows unhealthy status

**Step 5.3 - Check MCP Tool Registration:**

Read `src/index.ts` and verify all 11 MCP tools are registered:
1. semantic_search
2. find_similar
3. nexsus_search
4. graph_traverse
5. inspect_record
6. inspect_graph_edge
7. pipeline_preview
8. build_odoo_url
9. system_status
10. dlq_status
11. dlq_clear
12. update_model_payload

---

## Diagnostic Report Format

After completing all 5 phases, generate this report:

### Part 1: Dashboard Summary

```
+--------------------------------------------------------+
|  NEXSUS NERVE CHECK                                    |
|  Date: [CURRENT DATE]                                  |
|  Commit: [CURRENT HEAD COMMIT HASH]                    |
+--------------------------------------------------------+
|                                                        |
|  VITAL SIGNS                                           |
|  +-- Structural Integrity     [GREEN/YELLOW/RED]      |
|  +-- Communication Pathways   [GREEN/YELLOW/RED]      |
|  +-- Cross-Section Compat     [GREEN/YELLOW/RED]      |
|  +-- Knowledge Freshness      [GREEN/YELLOW/RED]      |
|  +-- Build & Runtime          [GREEN/YELLOW/RED]      |
|                                                        |
|  DIAGNOSIS SUMMARY                                     |
|  [X] CRITICAL  [X] HIGH  [X] WARNING  [X] INFO        |
|                                                        |
|  OVERALL HEALTH: [HEALTHY / AT RISK / CRITICAL]       |
+--------------------------------------------------------+
```

**Traffic Light Rules:**
- **GREEN**: No CRITICAL or HIGH issues in this phase
- **YELLOW**: HIGH issues present but no CRITICAL
- **RED**: CRITICAL issues found

**Overall Health:**
- **HEALTHY**: No CRITICAL, no HIGH (GREEN/YELLOW only from warnings)
- **AT RISK**: HIGH issues exist but no CRITICAL
- **CRITICAL**: Any CRITICAL issue = system unhealthy

---

### Part 2: Detailed Findings by Phase

For each phase, show:

```
---

## Phase [N]: [Phase Name] - [GREEN/YELLOW/RED]

### CRITICAL Findings (Nerve Damage)

| Location | Issue | Impact | Treatment |
|----------|-------|--------|-----------|
| [file:line] | [what's wrong] | [why it matters] | [how to fix] |

*If no CRITICAL findings: "No nerve damage detected."*

### HIGH Findings (Nerve Strain)

| Location | Issue | Impact | Treatment |
|----------|-------|--------|-----------|
| [file:line] | [what's wrong] | [why it matters] | [how to fix] |

*If no HIGH findings: "No nerve strain detected."*

### WARNING Findings (Inflammation)

- [Warning 1]: [location] - [brief description]
- [Warning 2]: [location] - [brief description]

*If no WARNING findings: "No inflammation detected."*

### INFO (Checkup Notes)

- [Info 1]: [observation]
- [Info 2]: [observation]

*If no INFO findings: "No additional notes."*

---
```

---

### Part 3: Prognosis & Treatment Plan

```
---

## PROGNOSIS

[One paragraph summary of overall nervous system health. Include:
- Number of healthy vs unhealthy pathways
- Most concerning finding
- Overall trajectory (improving/stable/degrading)]

---

## TREATMENT PLAN

### Immediate (Fix Before Next Commit)

These CRITICAL issues must be resolved before any other work:

1. [ ] [CRITICAL fix 1 with specific file and action]
2. [ ] [CRITICAL fix 2 with specific file and action]

*If no CRITICAL issues: "No immediate treatment required."*

### This Week (Fix Before Next Deployment)

These HIGH issues should be resolved soon:

1. [ ] [HIGH priority fix 1]
2. [ ] [HIGH priority fix 2]

*If no HIGH issues: "No urgent treatment required."*

### When Convenient (Technical Debt)

These WARNING/INFO items can be addressed during regular maintenance:

- [ ] [WARNING/INFO item 1]
- [ ] [WARNING/INFO item 2]

---

## FOLLOW-UP

Run `/nerve-check` again after completing Immediate treatments to verify fixes.

Next recommended checkup: [After next significant change / Before deployment / Weekly]

---
```

---

## Pass/Fail Determination

| Condition | Result | Action Required |
|-----------|--------|-----------------|
| ANY CRITICAL findings | **FAIL** | Stop. Fix CRITICAL issues before proceeding. |
| HIGH findings but no CRITICAL | **PASS WITH CONDITIONS** | Safe to continue but fix HIGH issues soon. |
| Only WARNING/INFO | **PASS** | Healthy nervous system. Note items for later. |
| No findings at all | **PERFECT HEALTH** | Excellent! System is in optimal condition. |

---

## Execution Checklist

Before generating the report, verify you have:

- [ ] Phase 1: Checked all 5 directories exist
- [ ] Phase 1: Read all 5 CLAUDE.md files
- [ ] Phase 1: Verified files in manifests exist
- [ ] Phase 2: Scanned for import violations in common/
- [ ] Phase 2: Scanned for console/ import violations
- [ ] Phase 2: Documented import dependencies
- [ ] Phase 3: Verified key exports exist
- [ ] Phase 3: Checked for section bleed
- [ ] Phase 4: Got recent git changes
- [ ] Phase 4: Checked knowledge file freshness
- [ ] Phase 5: Ran npm run build
- [ ] Phase 5: Ran npm run sync -- status
- [ ] Phase 5: Verified MCP tool registration
- [ ] Phase 6: Identified sections with CRITICAL/HIGH violations
- [ ] Phase 6: Generated fix-{section}-architecture.md for each affected section
- [ ] Phase 6: Reported which files were created vs skipped

---

## Quick Reference: Common Treatments

| Issue | Treatment |
|-------|-----------|
| common/ imports from section | Move the imported code to common/ OR refactor to remove dependency |
| Section imports console/ | Invert dependency - console should call section, not vice versa |
| Missing file from manifest | Either create the file OR update manifest to remove reference |
| Stale knowledge doc | Update the doc to reflect current implementation |
| Section bleed (semantic in exact) | Remove similarity scores / fuzzy logic from exact output |
| Build failure | Fix TypeScript errors shown in build output |
| Missing MCP tool registration | Add tool to src/index.ts server.tool() calls |

---

## Phase 6: Auto-Generate Fix Instruction Files

**Objective**: For each section with CRITICAL or HIGH violations, automatically generate a detailed fix instruction markdown file.

**Location**: `docs/plans/fix-{section}-architecture.md`

**When to Generate**:
- **GENERATE** if section has ANY CRITICAL or HIGH findings
- **SKIP** if section has only WARNING/INFO or no findings

### Step 6.1 - Determine Which Files to Create

After completing Phases 1-5, identify sections needing fix files:

| Section | Has CRITICAL/HIGH? | Action |
|---------|-------------------|--------|
| common/ | Check findings | Generate if YES, skip if NO |
| semantic/ | Check findings | Generate if YES, skip if NO |
| exact/ | Check findings | Generate if YES, skip if NO |
| knowledge/ | Check findings | Generate if YES, skip if NO |
| console/ | Check findings | Generate if YES, skip if NO |

### Step 6.2 - Fix File Template

For each section with violations, create `docs/plans/fix-{section}-architecture.md` with this structure:

```markdown
# Fix {Section}/ Architecture Violations

## Problem Summary
[Brief description of what violations were found - 2-3 sentences]
[Count: X CRITICAL, Y HIGH violations]

## Root Cause
[Why this happened - what led to these violations. 2-3 sentences providing context]

---

## Step-by-Step Fix

### Fix 1: [Issue Name]
- **Severity:** CRITICAL/HIGH
- **Current location:** [exact file path with line number if applicable]
- **Problem:** [What is wrong]
- **Move to / Change to:** [new file path or code change]
- **Imports to update:**
  - [file1.ts]
  - [file2.ts]

### Fix 2: [Issue Name]
[Same structure as Fix 1]

---

## Verification

### Section-Specific Check
```bash
# Commands to verify this section is fixed
# Should return EMPTY (no violations)
grep -r "[pattern that should not exist]" src/{section}/
```

### Build Verification
```bash
npm run build
# Must pass without errors
```

### Final System Check
Run `/nerve-check` after all sections are fixed to confirm healthy architecture.

---

## Execution Order
1. [First thing to do]
2. [Second thing to do]
3. [Continue numbering...]

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| [Potential issue] | [How to handle it] |
```

### Step 6.3 - Write the Files

Use the Write tool to create each fix file. Include:

1. **All CRITICAL violations first** - with complete fix instructions
2. **All HIGH violations second** - with complete fix instructions
3. **Specific file paths** - exact locations, not general descriptions
4. **Import updates** - list ALL files that need import path changes
5. **Verification commands** - grep/build commands to confirm fix worked

### Step 6.4 - Report Files Created

After generating files, add to the diagnostic report:

```
---

## FIX INSTRUCTION FILES GENERATED

| Section | File | Violations |
|---------|------|------------|
| common/ | docs/plans/fix-common-architecture.md | X CRITICAL, Y HIGH |
| knowledge/ | docs/plans/fix-knowledge-architecture.md | X CRITICAL, Y HIGH |

**Skipped** (no CRITICAL/HIGH violations):
- semantic/ ✓
- exact/ ✓
- console/ ✓

---
```

---

## Notes

- This command always runs the FULL 6-phase examination (5 diagnostic + 1 fix generation)
- Findings are classified strictly according to the severity tiers
- The Nervous System Doctor persona should be maintained throughout the report
- Treatment suggestions should be specific and actionable
- When in doubt about severity, classify UP (WARNING → HIGH, HIGH → CRITICAL)
- Fix files are ONLY generated for sections with CRITICAL or HIGH violations
- Fix files include step-by-step instructions that can be executed directly
