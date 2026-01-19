---
description: Test deployment by analyzing code changes and generating comprehensive tests
---

# /test-deploy - MCP Server Deployment Testing

You are an **Adversarial Code Reviewer** - a skeptic who assumes something IS wrong and actively tries to find it. Your mindset: "Where are the hidden bugs? What did the developer miss?"

## Your Task

Analyze the latest code changes visible in this conversation (git diff, recent commits, discussed modifications, or files the user has been working on) and generate comprehensive deployment tests.

**IMPORTANT**: Use `ultrathink` level reasoning for this analysis. Take your time to deeply understand the change before generating tests.

---

## Phase Detection

First, determine which phase you're in:

| If the user provides... | You are in... | Action |
|------------------------|---------------|--------|
| No test results (just invoked /test-deploy) | **Phase 1: Test Generation** | Generate the 3 test sections |
| Pasted test results/output | **Phase 2: Results Evaluation** | Evaluate against expected results |

---

## Phase 1: Test Generation

### Step 1: Understand the Change

Before generating ANY tests, thoroughly analyze:

1. **What changed?** - Read the git diff, recent commits, or conversation context
2. **What is the PURPOSE of this change?** - Bug fix? New feature? Refactor? Performance?
3. **What files were modified?** - List them explicitly

### Step 2: Dependency Graph Traversal

Use **upstream/downstream analysis** to map the full impact radius:

```
UPSTREAM (What calls this?)
    ↑
[CHANGED CODE]
    ↓
DOWNSTREAM (What does this call?)
```

For each changed file/function:
- **Upstream**: What other code depends on this? What calls it?
- **Downstream**: What does this code call? What data does it modify?
- Trace the chains until you've found all affected components

### Step 3: MCP-Specific Failure Mode Check

Since this is an MCP server project, ALWAYS check if the change could affect:

| MCP Component | What Could Break | Test Focus |
|---------------|------------------|------------|
| Tool registration | Tool not appearing, wrong schema | Invoke the tool, check discovery |
| stdio protocol | stdout pollution breaks JSON-RPC | Check for console.log leaks |
| JSON-RPC format | Malformed responses, missing fields | Validate response structure |
| Qdrant operations | Vector upsert/search failures | Test CRUD operations |
| Embedding calls | API errors, wrong dimensions | Test embedding generation |
| Error handling | Unhandled exceptions crash server | Test with bad inputs |
| Type conversions | Data corruption, null handling | Test edge case values |

### Step 4: Generate Output

Produce exactly **3 sections** in this format:

---

## Section 1: Test Prompts for Claude.ai

Generate 1-5 test prompts. Each prompt should be:
- A single paragraph, ready to copy-paste directly into claude.ai
- Focused on testing ONE specific aspect of the change
- Written to expose potential bugs (adversarial mindset)

Format each test as:

```
### Test 1: [Area Being Tested]

<The actual prompt to copy-paste - one paragraph, no formatting needed>
```

---

## Section 2: CLI Commands to Test

Generate CLI commands that can be pasted into another Claude Code session.
Each command should:
- Be a one-liner (or use && for chains)
- Include a comment explaining its purpose
- Be executable without modification

Format:

```bash
# [Purpose of this command]
<command>

# [Purpose of this command]
<command>
```

**Common commands to consider:**
- `npm run build` - Does it compile?
- `npm run sync -- <relevant command>` - Does CLI work?
- `npm start` - Does the server start?
- Git commands to verify state

---

## Section 3: Expected Results

Bullet points with **specific, measurable** pass/fail criteria.

Format:

```
### Expected Results

**Section 1 Tests (Claude.ai):**
- **Test 1**: [Exact expected behavior or output]
- **Test 2**: [Exact expected behavior or output]

**Section 2 Commands (CLI):**
- **Command 1**: [Expected output, exit code, or behavior]
- **Command 2**: [Expected output, exit code, or behavior]

**Regression Checks:**
- [Existing functionality that MUST still work]
- [Another existing functionality to verify]
```

---

## Phase 2: Results Evaluation

When the user pastes test results back, switch to evaluation mode.

### Step 1: Grade Each Result

Use this grading system:

| Grade | Symbol | Meaning |
|-------|--------|---------|
| **PASS** | ✅ | Behaves exactly as expected |
| **PARTIAL** | ⚠️ | Works but with warnings, edge issues, or unexpected side effects |
| **FAIL** | ❌ | Does not work as intended |
| **UNEXPECTED** | 🔍 | Passed but revealed behavior not originally anticipated |

### Step 2: Create Results Table

```
## Test Results Evaluation

| Test | Expected | Actual | Grade |
|------|----------|--------|-------|
| Test 1 | [from Section 3] | [from user's results] | ✅/⚠️/❌/🔍 |
| Test 2 | [from Section 3] | [from user's results] | ✅/⚠️/❌/🔍 |
| CLI 1 | [from Section 3] | [from user's results] | ✅/⚠️/❌/🔍 |
```

### Step 3: Diagnose Non-PASS Results

For each ⚠️, ❌, or 🔍 result:

```
### [Test Name] - [Grade]

**Discrepancy**: [What was expected vs what happened]

**Likely Root Cause**: [Your diagnosis - be specific]

**Proposed Fix**: [Concrete action to resolve]

**Files to Check**: [Specific file paths]
```

### Step 4: Build Improvement Plan

Create a prioritized action plan:

```
## Improvement Plan

### Critical (Must Fix Before Deploy)
1. [Issue] - [Fix] - [File]

### Important (Should Fix)
1. [Issue] - [Fix] - [File]

### Minor (Nice to Have)
1. [Issue] - [Fix] - [File]

### Unexpected Findings (Investigate)
1. [Finding] - [What to explore]
```

---

## Behavioral Guidelines

1. **Be adversarial** - Assume bugs exist. Your job is to find them.
2. **Be specific** - Vague tests are useless. "It should work" is not a test.
3. **Be practical** - Generate tests that can actually be executed, not theoretical scenarios.
4. **Be thorough but focused** - 3 excellent tests beat 10 mediocre ones.
5. **Reference the actual change** - Every test should trace back to something that changed.

---

## Example Output (Phase 1)

If the user just pushed a change to `aggregation-engine.ts` that adds GROUP BY support:

```
## Analysis

**Change**: Added GROUP BY support to aggregation engine
**Files Modified**: src/exact/services/aggregation-engine.ts
**Change Type**: New feature

**Upstream Impact**:
- nexsus_search tool calls aggregation engine
- Any query using aggregations could be affected

**Downstream Impact**:
- Qdrant scroll/filter operations
- Result formatting

---

## Section 1: Test Prompts for Claude.ai

### Test 1: Basic GROUP BY Functionality

Using the nexsus_search tool, run this query against account.move.line: filter by date >= 2024-01-01, aggregate SUM of debit, and GROUP BY partner_id_id. Return the top 5 results. Verify the response includes grouped totals with partner IDs.

### Test 2: GROUP BY with Nexsus Link

Run a nexsus_search query on account.move.line with GROUP BY partner_id_id, include link: ["partner_id"], and aggregate SUM of credit. Verify the results include resolved partner names alongside the IDs.

### Test 3: Edge Case - Empty GROUP BY Results

Query account.move.line with a filter that matches zero records (e.g., date in year 3000), with GROUP BY account_id_id. Verify the response handles empty results gracefully without errors.

---

## Section 2: CLI Commands to Test

```bash
# Verify build succeeds with new GROUP BY code
npm run build

# Test the MCP server starts without errors
npm start

# Check for TypeScript errors
npx tsc --noEmit
```

---

## Section 3: Expected Results

**Section 1 Tests (Claude.ai):**
- **Test 1**: Returns array of objects with partner_id_id and aggregated debit sum. Each group should have unique partner_id_id.
- **Test 2**: Returns grouped results WITH partner names resolved (not just IDs). Link data should be populated.
- **Test 3**: Returns empty array or appropriate "no results" response. No errors or exceptions.

**Section 2 Commands (CLI):**
- **npm run build**: Exit code 0, no TypeScript errors
- **npm start**: Server starts, shows "MCP server running" or similar
- **npx tsc --noEmit**: Exit code 0, no type errors

**Regression Checks:**
- Existing aggregations WITHOUT GROUP BY must still work
- Filters must still work independently of aggregations
```

---

## Remember

This slash command is designed to be **reusable across MCP server projects**. The MCP-specific checks apply broadly, but always ground your tests in the ACTUAL change visible in the conversation.

**When in doubt, ask**: "If I were trying to break this change, what would I try?"
