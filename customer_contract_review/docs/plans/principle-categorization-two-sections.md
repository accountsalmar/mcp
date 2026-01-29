# Commercial Principles Categorization & Two-Section Departure Schedule

## Overview
Classify all 28 commercial principles into two categories (Non-Negotiable and Negotiable) and restructure the departure schedule output to display these as two distinct sections. This helps users quickly identify which departures require escalation versus which terms have negotiation flexibility.

## Principle Categorization

### Section 1 - Non-Negotiable (9 principles)
These terms represent DuraCube's firm commercial positions that cannot be compromised:

| # | Principle |
|---|-----------|
| 3 | Head Contract Provision |
| 13 | Dispute Resolution |
| 14 | Payment and Cash Neutrality |
| 15 | Security & Parent Company Guarantees |
| 16 | Release of Security |
| 19 | Proportionate Liability Act |
| 24 | Set Off |
| 25 | Insurances |
| 28 | Design Liability |

### Section 2 - Negotiable (19 principles)
These terms have flexibility and can be discussed during contract negotiation:

| # | Principle |
|---|-----------|
| 1 | Limitation of Liability |
| 2 | Consequential Damages |
| 4 | Liquidated Damages |
| 5 | Extension of Time |
| 6 | Force Majeure |
| 7 | Variations: Accelerations, Omissions |
| 8 | Time Bars/Notification Period |
| 9 | Assessment Period |
| 10 | Service for Notices |
| 11 | Termination |
| 12 | Termination for Convenience |
| 17 | Defects Liability Period |
| 18 | Indemnities |
| 20 | Risk & Title Transfer |
| 21 | Unfixed Materials |
| 22 | Intellectual Property |
| 23 | Urgent Protection |
| 26 | Protection of Works |
| 27 | Time is of the Essence / Escalation |

## Output Format Specification

**Structure:** Single worksheet with section headers

```
CustomerName_ProjectName_$ContractValue,,,,,,

SECTION 1 - NON-NEGOTIABLE,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
3,Head Contract Provision,[Status],"Page X, Clause Y",[Contract Language],[Recommended Amendment],[Notes]
13,Dispute Resolution,...
14,Payment and Cash Neutrality,...
15,Security & Parent Company Guarantees,...
16,Release of Security,...
19,Proportionate Liability Act,...
24,Set Off,...
25,Insurances,...
28,Design Liability,...

SECTION 2 - NEGOTIABLE,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
1,Limitation of Liability,...
2,Consequential Damages,...
4,Liquidated Damages,...
5,Extension of Time,...
6,Force Majeure,...
7,Variations: Accelerations, Omissions,...
8,Time Bars/Notification Period,...
9,Assessment Period,...
10,Service for Notices,...
11,Termination,...
12,Termination for Convenience,...
17,Defects Liability Period,...
18,Indemnities,...
20,Risk & Title Transfer,...
21,Unfixed Materials,...
22,Intellectual Property,...
23,Urgent Protection,...
26,Protection of Works,...
27,Time is of the Essence / Escalation,...
```

**Ordering:** Within each section, principles appear in numerical order (by principle number).

---

## Stages

### Stage 1: Update Reference Documentation
**Goal:** Add categorization to the source-of-truth document
**Estimated effort:** Simple

**Tasks:**
- [ ] Open `0_Duracube_Standard_Commercial_FINAL.md`
- [ ] Add "Category" field to each principle (Non-Negotiable or Negotiable)
- [ ] Add a summary table at the top showing the categorization
- [ ] Verify all 28 principles have a category assigned

**Tests (Claude Code - stdio):**
- [ ] Search for "Non-Negotiable" - should find 9 occurrences
- [ ] Search for "Negotiable" (excluding "Non-") - should find 19 occurrences
- [ ] Verify no principle is missing a category

**Tests (claude.ai - HTTP):**
- [ ] Read the file and verify the categorization table is present
- [ ] Ask "List all Non-Negotiable principles" - should return exactly 9

**Success Criteria:**
- All 28 principles have Category field
- Summary table shows 9 Non-Negotiable + 19 Negotiable
- No duplicate or missing categorizations

---

### Stage 2: Update Vision.md
**Goal:** Update the architecture documentation with categorization
**Estimated effort:** Simple

**Tasks:**
- [ ] Open `Vision.md`
- [ ] Update the 28 Principles table to include "Category" column
- [ ] Update output format specification to show two-section structure
- [ ] Add section explaining the categorization purpose

**Tests (Claude Code - stdio):**
- [ ] Verify Vision.md contains "SECTION 1 - NON-NEGOTIABLE"
- [ ] Verify Vision.md contains "SECTION 2 - NEGOTIABLE"
- [ ] Verify the principle table has Category column

**Tests (claude.ai - HTTP):**
- [ ] Read Vision.md and confirm categorization is documented
- [ ] Verify output format section shows two-section example

**Success Criteria:**
- Vision.md reflects the two-section architecture
- Output format specification updated
- Categorization rationale documented

---

### Stage 3: Update CLAUDE.md
**Goal:** Update project instructions with categorization quick reference
**Estimated effort:** Simple

**Tasks:**
- [ ] Open `CLAUDE.md`
- [ ] Update "The 28 Commercial Principles" table to show categories
- [ ] Update "Output Format" section with two-section structure
- [ ] Add note about ordering (by principle number within sections)

**Tests (Claude Code - stdio):**
- [ ] Grep for "Non-Negotiable" in CLAUDE.md
- [ ] Verify output format example shows section headers

**Tests (claude.ai - HTTP):**
- [ ] Read CLAUDE.md and verify quick reference table includes categories
- [ ] Confirm output format section is updated

**Success Criteria:**
- CLAUDE.md quick reference shows categorization
- Output format updated to two-section structure
- Ordering rule documented

---

### Stage 4: Update Main Agent Prompt
**Goal:** Modify the working v2.1 agent to produce two-section output
**Estimated effort:** Medium

**Tasks:**
- [ ] Open `Main Agent Prompt.txt`
- [ ] Add the categorization list (9 Non-Negotiable, 19 Negotiable)
- [ ] Modify the output generation instructions to:
  - Output Section 1 header before Non-Negotiable principles
  - Output Section 2 header before Negotiable principles
  - Order principles by number within each section
- [ ] Add instruction to show category significance to users
- [ ] Update any example outputs to reflect new format

**Tests (Claude Code - stdio):**
- [ ] Verify prompt contains both section header instructions
- [ ] Verify all 28 principles are listed with categories
- [ ] Check example output shows two-section format

**Tests (claude.ai - HTTP):**
- [ ] Upload a test contract to myaidrive.com with updated prompt
- [ ] Verify output has "SECTION 1 - NON-NEGOTIABLE" header
- [ ] Verify output has "SECTION 2 - NEGOTIABLE" header
- [ ] Verify principles are ordered by number within sections
- [ ] Verify all 28 principles appear in correct sections

**Success Criteria:**
- Agent produces two-section departure schedule
- Section 1 contains exactly 9 Non-Negotiable principles (in order: 3, 13, 14, 15, 16, 19, 24, 25, 28)
- Section 2 contains exactly 19 Negotiable principles (in number order)
- Format matches specification

---

### Stage 5: Create Future Code Specification
**Goal:** Document requirement for MCP server implementation
**Estimated effort:** Simple

**Tasks:**
- [ ] Update `docs/plans/quick-win-mcp-implementation.md` with categorization requirement
- [ ] Add JSON schema showing category field for principles
- [ ] Document the two-section CSV/Excel generation logic
- [ ] Add test cases for the export functionality

**Tests (Claude Code - stdio):**
- [ ] Verify quick-win plan includes categorization
- [ ] Verify JSON schema example has category field

**Tests (claude.ai - HTTP):**
- [ ] Read the plan and confirm implementation guidance is clear
- [ ] Verify test cases cover two-section output

**Success Criteria:**
- Future implementation plan includes categorization
- JSON schema documented with category field
- Export logic specification complete

---

## Dependencies
- Access to all target files in `customer_contract_review/` directory
- Current working agent prompt (Main Agent Prompt.txt)
- Understanding of existing 28 principles structure

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Agent prompt too long after changes | Keep additions concise; use tables not prose |
| Inconsistent categorization across docs | Update source-of-truth (Stage 1) first, reference it in other stages |
| Breaking existing agent functionality | Test with sample contract after Stage 4 changes |
| Missing principles in output | Explicit checklist of all 28 in each section |

## Notes
- The categorization was defined by the user based on DuraCube's commercial strategy
- "Non-Negotiable" means DuraCube will not compromise on these terms
- "Negotiable" means there is flexibility to discuss during contract negotiation
- Ordering within sections is by principle number (not by risk level or alphabetical)
- The example Excel file `Departure schedule with sections.xlsx` was referenced but could not be read directly

---

*Created: 2026-01-30*
*Prompt Evaluation Score: 27/30*
