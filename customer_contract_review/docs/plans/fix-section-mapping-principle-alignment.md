# Fix Section-Mapping Principle Alignment

## Overview

The `section-mapping.json` file in `duracube-contract-mcp` has incorrect principle numbering that doesn't align with the canonical `principles.json`. This causes the large contract analysis tool to reference wrong principle names/IDs, which would result in incorrect departure schedules.

**Root Cause:** Manual creation error - the section-mapping was built with a different numbering scheme than the canonical source.

**Impact:** 19 of 28 principles have mismatched IDs. Only 9 match correctly (3, 13, 14, 15, 16, 19, 24, 25, 28).

---

## Stages

### Stage 1: Analyze Current Mappings ✅ COMPLETE
**Goal:** Document the exact mismatches and plan correct group assignments
**Estimated effort:** Simple
**Completed:** 2026-02-02

**Tasks:**
- [x] Create a mapping table showing: Current ID → Current Name → Correct Name
- [x] Determine optimal section groups based on contract structure AND correct principle IDs
- [x] Document which principles go in each group (A-G) using canonical numbering

**Analysis Files Created:**
- `data/analysis-stage1-principle-mapping.md` - Complete mismatch table
- `data/analysis-stage1-group-assignments.md` - Final group assignments

**Key Findings:**
- 9 principles match (all NON-NEGOTIABLE: 3, 13, 14, 15, 16, 19, 24, 25, 28)
- 19 principles have wrong IDs
- 6 "principles" in section-mapping don't exist in canonical source
- Groups B and D require NO changes
- Groups A, C, E, F, G require restructuring

**Tests (Claude Code - stdio):**
- [x] Read both JSON files and compare programmatically
- [x] Generate diff report showing all mismatches

**Tests (claude.ai - HTTP):**
- [x] N/A - analysis stage

**Success Criteria:**
- [x] Complete mapping table documented
- [x] Group assignments finalized with correct principle IDs
- [x] All 28 principles accounted for

---

### Stage 2: Regenerate section-mapping.json ✅ COMPLETE
**Goal:** Create corrected section-mapping.json with proper principle alignment
**Estimated effort:** Complex
**Completed:** 2026-02-02

**Tasks:**
- [x] Rebuild `metadata` section with version bump (1.1.0 → 1.2.0)
- [x] Rebuild `principle_search_terms` using search terms FROM `principles.json`
- [x] Rebuild all 7 `section_groups` with correct principle IDs:
  - Group A: General & Admin (3, 10, 11)
  - Group B: Payment & Security (14, 15, 16, 24)
  - Group C: Liability & Indemnity (1, 2, 18, 19)
  - Group D: Insurance (25)
  - Group E: Disputes & Termination (12, 13)
  - Group F: Variations, Time & Claims (4, 5, 6, 7, 8, 9)
  - Group G: Design, Defects & Completion (17, 20, 21, 22, 23, 26, 27, 28)
- [x] Update `analysis_prompt` and `sandbox_search_prompt` for each group
- [x] Preserve Google Drive workflow and smart extraction sections
- [x] Update `quick_reference` with correct mappings
- [x] Update `package.json` version to 1.2.0

**Tests (Claude Code - stdio):**
- [x] `npm run build` succeeds in duracube-contract-mcp
- [x] JSON validates: `node -e "require('./build/knowledge/section-mapping.json')"`
- [x] Spot-check: Principle 1 = "Limitation of Liability" ✓
- [x] Spot-check: Principle 9 = "Assessment Period" ✓
- [x] Spot-check: Principle 17 = "Defects Liability Period" ✓
- [x] All 28 principles accounted for in groups ✓
- [x] Existing knowledge files still valid ✓

**Tests (claude.ai - HTTP):**
- [ ] Call `get_section_principle_mapping` with `group_id: "all"` - verify principle names
- [ ] Call `get_section_principle_mapping` with `group_id: "B"` - verify returns 14, 15, 16, 24
- [ ] Call `get_section_principle_mapping` with `group_id: "C"` - verify returns 1, 2, 18, 19

**Success Criteria:**
- [x] All 28 principle IDs match `principles.json`
- [x] All principle names match exactly
- [x] Non-negotiable list correct: 3, 13, 14, 15, 16, 19, 24, 25, 28
- [x] Negotiable list correct: 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27

---

### Stage 3: Update User Guide ✅ COMPLETE
**Goal:** Correct all principle references in the user guide
**Estimated effort:** Medium
**Completed:** 2026-02-02

**Tasks:**
- [x] Update `large-contract-user-guide.md` version to 1.2
- [x] Fix Group A principle list and prompts (now 3, 10, 11)
- [x] Fix Group C principle list and prompts (now 1, 2, 18, 19)
- [x] Fix Group E principle list and prompts (now 12, 13)
- [x] Fix Group F principle list and prompts (now 4, 5, 6, 7, 8, 9)
- [x] Fix Group G principle list and prompts (now 17, 20-23, 26-28)
- [x] Update Quick Reference section with correct principle order
- [x] Update Discovery Scan prompt with correct principle mappings
- [x] Add complete Principle Names Quick Reference table (all 28)

**Tests (Claude Code - stdio):**
- [x] Grep for "Legislative Compliance" - returns 0 matches ✓
- [x] Grep for "Limitation of Liability" - appears in Group C section ✓

**Tests (claude.ai - HTTP):**
- [ ] Read user guide and verify Group B section shows principles 14, 15, 16, 24
- [ ] Verify prompts reference correct principle names

**Success Criteria:**
- [x] No references to incorrect principle names
- [x] All prompts use canonical principle names
- [x] Group assignments match section-mapping.json

---

### Stage 4: Update Changes Document & Deploy ✅ COMPLETE
**Goal:** Document the correction and deploy safely
**Estimated effort:** Simple
**Completed:** 2026-02-02

**Tasks:**
- [x] Add correction note to `CHANGES-2026-02-01.md`
- [x] Update version to 1.2.0 in `package.json`
- [x] Run full build verification
- [x] Verify all 5 knowledge files load correctly
- [x] Prepare commit summary

**Tests (Claude Code - stdio):**
- [x] `npm run build` - no errors ✓
- [x] All 5 knowledge files load successfully ✓
- [x] Principle alignment spot-checks pass ✓
- [x] All 28 principles in groups ✓

**Tests (claude.ai - HTTP):**
- [ ] After Railway deploy: GET `/health` shows version 1.2.0
- [ ] Call `get_duracube_principles` - verify returns correct principles
- [ ] Call `get_section_principle_mapping` - verify alignment
- [ ] Call `get_output_format` - verify still works

**Success Criteria:**
- [x] Build succeeds
- [x] All existing tools still work
- [x] New tool returns correct data
- [x] Changes documented

---

## Dependencies

- Access to `duracube-contract-mcp` repository
- Access to `customer_contract_review` repository
- Canonical `principles.json` as source of truth
- Railway deployment access (for final verification)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing tools | Only modify section-mapping.json, don't touch other knowledge files |
| Missing principles in groups | Use checklist to verify all 28 accounted for |
| Inconsistent search terms | Copy search terms directly from principles.json |
| Railway deploy fails | Keep local backup, test build before push |
| Users have cached old guide | Bump version number clearly (1.2), notify team |

## Notes

### Canonical Principle List (from principles.json)

| ID | Name | Category |
|----|------|----------|
| 1 | Limitation of Liability | Negotiable |
| 2 | Consequential Damages | Negotiable |
| 3 | Head Contract Provision | NON-NEGOTIABLE |
| 4 | Liquidated Damages | Negotiable |
| 5 | Extension of Time | Negotiable |
| 6 | Force Majeure | Negotiable |
| 7 | Variations: Accelerations, Omissions | Negotiable |
| 8 | Time Bars/Notification Period | Negotiable |
| 9 | Assessment Period | Negotiable |
| 10 | Service for Notices | Negotiable |
| 11 | Termination | Negotiable |
| 12 | Termination for Convenience | Negotiable |
| 13 | Dispute Resolution | NON-NEGOTIABLE |
| 14 | Payment and Cash Neutrality | NON-NEGOTIABLE |
| 15 | Security & Parent Company Guarantees | NON-NEGOTIABLE |
| 16 | Release of Security | NON-NEGOTIABLE |
| 17 | Defects Liability Period | Negotiable |
| 18 | Indemnities | Negotiable |
| 19 | Proportionate Liability Act | NON-NEGOTIABLE |
| 20 | Risk & Title Transfer | Negotiable |
| 21 | Unfixed Materials | Negotiable |
| 22 | Intellectual Property | Negotiable |
| 23 | Urgent Protection | Negotiable |
| 24 | Set Off | NON-NEGOTIABLE |
| 25 | Insurances | NON-NEGOTIABLE |
| 26 | Protection of Works | Negotiable |
| 27 | Time is of the Essence / Escalation | Negotiable |
| 28 | Design Liability | NON-NEGOTIABLE |

### Finalized Group Assignments (from Stage 1 Analysis)

| Group | Name | Principle IDs | Count | NON-NEG |
|-------|------|---------------|-------|---------|
| A | General & Administrative | 3, 10, 11 | 3 | 1 |
| B | Payment & Security | 14, 15, 16, 24 | 4 | 4 |
| C | Liability & Indemnity | 1, 2, 18, 19 | 4 | 1 |
| D | Insurance | 25 | 1 | 1 |
| E | Disputes & Termination | 12, 13 | 2 | 1 |
| F | Variations, Time & Claims | 4, 5, 6, 7, 8, 9 | 6 | 0 |
| G | Design, Defects & Completion | 17, 20, 21, 22, 23, 26, 27, 28 | 8 | 1 |

**Changes from current section-mapping.json:**
- Group A: Replace 1,2,4,5,6 with 10,11 (keep 3)
- Group B: **NO CHANGE** ✓
- Group C: Replace 7,8,9,10,11 with 1,2,18,19
- Group D: **NO CHANGE** ✓
- Group E: Replace 19 with 12 (keep 13)
- Group F: Replace 17,18,20,21,22,23 with 4,5,6,7,8,9
- Group G: Replace 12,26,27 with 17,20,21,22,23,26,27 (keep 28)

---

*Created: 2026-02-02*
*Status: Ready for Implementation*
