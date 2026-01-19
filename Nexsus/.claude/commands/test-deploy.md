# /test-deploy - MCP Deployment Testing Command

Generate test prompts for claude.ai to validate MCP changes before/after deployment.

## Phase Detection

Determine which phase to execute:

| If user provides... | Execute... |
|---------------------|------------|
| Just `/test-deploy` | **Phase 1:** Auto-detect Claude commit at HEAD |
| `/test-deploy [commit-hash]` | **Phase 1:** Test specific commit |
| `/test-deploy evaluate` + claude.ai output | **Phase 2: Evaluate Results** |
| Arguments like `--model=crm.lead` | **Phase 1 with options** |

**Key Change:** By default, only tests commits authored by Claude (detected via `Co-Authored-By: Claude` signature).

---

## PHASE 1: Generate Test Prompts

### Step 0: Detect Claude-Authored Commit (REQUIRED FIRST)

**Before analyzing any code, you MUST verify you're testing a Claude-authored commit.**

Run this command to check if HEAD was authored by Claude:

```bash
git log -1 --format="%H %s" | head -1 && git log -1 --format="%b" | grep -i "Co-Authored-By: Claude"
```

**Decision Tree:**

| Result | Action |
|--------|--------|
| HEAD has `Co-Authored-By: Claude` | ✅ **Proceed to Step 1** - Test this commit |
| HEAD does NOT have Claude signature | ⚠️ **Search last 5 commits** (see below) |

**If HEAD is not Claude-authored, search recent history:**

```bash
git log -5 --format="%H|%s" --grep="Co-Authored-By: Claude"
```

| Search Result | Action |
|---------------|--------|
| Found Claude commit in last 5 | Show: `"HEAD is not Claude-authored. Found Claude commit [HASH] ([N] commits back): [MESSAGE]. Use /test-deploy [HASH] to test it."` Then **STOP**. |
| No Claude commits found | Show: `"❌ No Claude-authored commits found in recent history. Make a commit with Claude first, then run /test-deploy."` Then **STOP**. |

**Signature Pattern to Match:**
```
Co-Authored-By: Claude
```

⚠️ **DO NOT proceed to Step 1 unless a Claude-authored commit is confirmed.**

---

### Step 1: Analyze the Claude Commit

Once a Claude-authored commit is confirmed, analyze what changed:

```bash
# Get the commit details
git show --stat HEAD

# Get detailed file changes
git show --name-status HEAD

# Get the actual diff
git diff HEAD~1..HEAD -- src/
```

### Step 2: Semantic Code Analysis

For each changed file, READ the actual code to understand:

1. **New/Modified Functions**: What functions were added or changed?
2. **New Parameters**: Any new input parameters or options?
3. **Changed Behaviors**: How does the output differ from before?
4. **MCP Tools Affected**: Which of the 11 MCP tools are impacted?

**MCP Tools Reference:**
| Tool | Location | Purpose |
|------|----------|---------|
| `semantic_search` | semantic/ | Natural language search |
| `find_similar` | semantic/ | Find similar records |
| `nexsus_search` | exact/ | Precise queries with filters |
| `graph_traverse` | common/ | FK relationship navigation |
| `inspect_record` | common/ | Debug record inspection |
| `inspect_graph_edge` | common/ | Debug graph edges |
| `build_odoo_url` | common/ | Generate Odoo URLs |
| `system_status` | exact/ | System health/metrics |
| `dlq_status` | exact/ | Dead Letter Queue status |
| `dlq_clear` | exact/ | Clear DLQ |
| `update_model_payload` | exact/ | Update payload without re-embed |
| `pipeline_preview` | common/ | Preview sync transformation |

### Step 3: Identify Dependencies

Check if changes affect shared code:

| If this changed... | Also test these tools... |
|--------------------|--------------------------|
| `src/common/` | ALL tools using shared types/clients |
| `src/common/services/vector-client.ts` | semantic_search, nexsus_search, find_similar |
| `src/common/types.ts` | ALL tools |
| `src/exact/` | nexsus_search, system_status, dlq_* |
| `src/semantic/` | semantic_search, find_similar |
| `src/console/blendthink/` | Any blendthink-related tools |
| `src/knowledge/` | Knowledge adapters (if exposed) |

### Step 4: Generate Output

Produce this structured output:

---

## Test Deployment Report

### Changes Detected

**Commits Analyzed:** [N commits from DATE to DATE]

| Commit | Type | Scope | Description |
|--------|------|-------|-------------|
| abc123 | feat | blendthink | Add Phase 3 conversation memory |
| def456 | fix | exact | Remove artificial data limits |

**Files Changed:** [N files, +X/-Y lines]

**MCP Tools Affected:**
- Direct: [tools with code changes]
- Dependent: [tools sharing code with changed files]

---

### Section 1: Test Prompts for claude.ai

Generate 1-5 test prompts. For each prompt:

```
### Test [N]: [Feature Being Tested]

**What it tests:** [Brief description of the feature/change]
**MCP Tool:** [tool name]
**Why it matters:** [What breaks if this fails]

**Prompt to copy:**
---
[The actual prompt to paste into claude.ai]
---
```

### Section 2: Expected Results

For each test prompt, provide:

```
### Expected Result for Test [N]

**Tool should return:**
- [Key element 1 that MUST be present]
- [Key element 2 that MUST be present]
- [Specific value or format expected]

**Success criteria:**
- [ ] [Checkable criterion 1]
- [ ] [Checkable criterion 2]
- [ ] [Checkable criterion 3]

**Red flags (indicates failure):**
- [Error message or behavior that means failure]
- [Missing element that indicates regression]
```

### Section 3: Regression Checks (if applicable)

If shared code changed, include quick smoke tests for dependent tools:

```
### Regression Test [N]: [Tool Name]

**Prompt:** [Simple prompt to verify tool still works]
**Expected:** [Basic expected output]
```

---

## PHASE 2: Evaluate Results

When user provides claude.ai output, perform this evaluation:

### Step 1: Parse User Input

The user will paste output from claude.ai. Parse it to identify which test each result corresponds to.

### Step 2: Compare Against Expected Results

For each test:

1. **Check required elements**: Are all MUST-have elements present?
2. **Check format**: Does output match expected structure?
3. **Check values**: Do specific values match expectations?
4. **Check for red flags**: Any failure indicators present?

### Step 3: Generate Evaluation Report

---

## Deployment Test Results

### Dashboard Summary

```
+--------------------------------------------------+
|  TEST RESULTS: [X/Y] Passed  ([Z]% Success Rate) |
+--------------------------------------------------+
|                                                  |
|  Test 1: [Name]              [PASS/FAIL icon]    |
|  Test 2: [Name]              [PASS/FAIL icon]    |
|  Test 3: [Name]              [PASS/FAIL icon]    |
|  ...                                             |
|                                                  |
|  Regressions: [N detected / None]                |
+--------------------------------------------------+
```

Use these icons:
- Pass: `[PASS]`
- Fail: `[FAIL]`
- Partial: `[WARN]`

### Detailed Breakdown

For each test:

```
---
### Test [N]: [Name] - [PASS/FAIL]

**Expected:**
[What we expected to see]

**Actual:**
[What claude.ai returned]

**Comparison:**
| Criterion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| [Check 1] | [value]  | [value]| [icon] |
| [Check 2] | [value]  | [value]| [icon] |

**Verdict:** [PASS/FAIL/PARTIAL]
**Issue:** [If failed, what went wrong]
**Fix suggestion:** [If applicable, how to fix]
---
```

### Final Assessment

```
## Deployment Recommendation

**Overall Score:** [X/Y] tests passed ([Z]%)

**Verdict:** [READY TO DEPLOY / NEEDS FIXES / CRITICAL FAILURES]

**Summary:**
- [Key success 1]
- [Key success 2]
- [Issue requiring attention, if any]

**Next Steps:**
1. [Action item 1]
2. [Action item 2]
```

---

## Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `[commit-hash]` | Test a specific commit (overrides auto-detection) | `/test-deploy abc1234` |
| `--model=name` | Focus on specific model | `/test-deploy --model=crm.lead` |
| `--tool=name` | Focus on specific MCP tool | `/test-deploy --tool=semantic_search` |
| `--full` | Full regression test of all 11 tools | `/test-deploy --full` |
| `evaluate` | Switch to Phase 2 evaluation mode | `/test-deploy evaluate` |

**Default Behavior:** Tests the most recent Claude-authored commit (detected via `Co-Authored-By: Claude` signature).

---

## Example Usage

### Phase 1 Example (Auto-detect Claude commit):
```
User: /test-deploy

Claude: [Checks HEAD for Claude signature]
        [If found: Analyzes commit, generates test prompts]
        [If not found: Shows hint about nearby Claude commits or error]
```

### Phase 1 Example (Specific commit):
```
User: /test-deploy abc1234

Claude: [Tests the specified commit abc1234]
```

### Phase 1 Example (No Claude commits found):
```
User: /test-deploy

Claude: "❌ No Claude-authored commits found in recent history.
        Make a commit with Claude first, then run /test-deploy."
```

### Phase 1 Example (Claude commit not at HEAD):
```
User: /test-deploy

Claude: "HEAD is not Claude-authored. Found Claude commit 9fb0196
        (2 commits back): feat(semantic): Improve search defaults.
        Use `/test-deploy 9fb0196` to test it."
```

### Phase 2 Example:
```
User: /test-deploy evaluate

Here's the output from claude.ai:
[pastes output]

Claude: [Compares against expected, generates evaluation report]
```
