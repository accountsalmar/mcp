# Stage 1 Analysis: Principle Mapping Mismatches

**Date:** 2026-02-02
**Purpose:** Document exact mismatches between section-mapping.json and principles.json
**Status:** Analysis Only - No Code Changes

---

## Executive Summary

The `section-mapping.json` contains a **completely different set of 28 principles** than the canonical `principles.json`. This is not just a numbering issue - the section-mapping invented principles that don't exist in the canonical source.

**Key Finding:**
- 9 principles match (by both ID and name)
- 19 principles are completely different concepts
- 6 principles in section-mapping don't exist at all in the canonical list

---

## Complete Mapping Table

| ID | section-mapping.json (CURRENT) | principles.json (CANONICAL) | Status |
|----|-------------------------------|----------------------------|--------|
| 1 | Legislative Compliance | Limitation of Liability | MISMATCH |
| 2 | Priority of Documents | Consequential Damages | MISMATCH |
| 3 | Head Contract Provision | Head Contract Provision | MATCH |
| 4 | Compliance with Direction | Liquidated Damages | MISMATCH |
| 5 | Access to Site | Extension of Time | MISMATCH |
| 6 | Latent Conditions | Force Majeure | MISMATCH |
| 7 | Care of Works & Reinstatement | Variations: Accelerations, Omissions | MISMATCH |
| 8 | Risk Allocation and Indemnity | Time Bars/Notification Period | MISMATCH |
| 9 | Limitation of Liability | Assessment Period | MISMATCH |
| 10 | Consequential Loss | Service for Notices | MISMATCH |
| 11 | Time Bars | Termination | MISMATCH |
| 12 | Practical Completion | Termination for Convenience | MISMATCH |
| 13 | Dispute Resolution | Dispute Resolution | MATCH |
| 14 | Payment and Cash Neutrality | Payment and Cash Neutrality | MATCH |
| 15 | Security & Parent Company Guarantees | Security & Parent Company Guarantees | MATCH |
| 16 | Release of Security | Release of Security | MATCH |
| 17 | Variations | Defects Liability Period | MISMATCH |
| 18 | Extensions of Time | Indemnities | MISMATCH |
| 19 | Proportionate Liability Act | Proportionate Liability Act | MATCH |
| 20 | Delay Costs | Risk & Title Transfer | MISMATCH |
| 21 | Liquidated Damages | Unfixed Materials | MISMATCH |
| 22 | Suspension | Intellectual Property | MISMATCH |
| 23 | Termination | Urgent Protection | MISMATCH |
| 24 | Set Off | Set Off | MATCH |
| 25 | Insurances | Insurances | MATCH |
| 26 | Defects Liability Period | Protection of Works | MISMATCH |
| 27 | Warranty | Time is of the Essence / Escalation | MISMATCH |
| 28 | Design Liability | Design Liability | MATCH |

---

## Matching Principles (9 total)

These can remain in their current groups:

| ID | Name | Category |
|----|------|----------|
| 3 | Head Contract Provision | NON-NEGOTIABLE |
| 13 | Dispute Resolution | NON-NEGOTIABLE |
| 14 | Payment and Cash Neutrality | NON-NEGOTIABLE |
| 15 | Security & Parent Company Guarantees | NON-NEGOTIABLE |
| 16 | Release of Security | NON-NEGOTIABLE |
| 19 | Proportionate Liability Act | NON-NEGOTIABLE |
| 24 | Set Off | NON-NEGOTIABLE |
| 25 | Insurances | NON-NEGOTIABLE |
| 28 | Design Liability | NON-NEGOTIABLE |

**Note:** All 9 matching principles are NON-NEGOTIABLE. This is good - the critical business rules are preserved.

---

## Mismatched Principles (19 total)

These need complete replacement:

| ID | Current (Wrong) | Should Be (Canonical) | Category |
|----|-----------------|----------------------|----------|
| 1 | Legislative Compliance | Limitation of Liability | Negotiable |
| 2 | Priority of Documents | Consequential Damages | Negotiable |
| 4 | Compliance with Direction | Liquidated Damages | Negotiable |
| 5 | Access to Site | Extension of Time | Negotiable |
| 6 | Latent Conditions | Force Majeure | Negotiable |
| 7 | Care of Works & Reinstatement | Variations: Accelerations, Omissions | Negotiable |
| 8 | Risk Allocation and Indemnity | Time Bars/Notification Period | Negotiable |
| 9 | Limitation of Liability | Assessment Period | Negotiable |
| 10 | Consequential Loss | Service for Notices | Negotiable |
| 11 | Time Bars | Termination | Negotiable |
| 12 | Practical Completion | Termination for Convenience | Negotiable |
| 17 | Variations | Defects Liability Period | Negotiable |
| 18 | Extensions of Time | Indemnities | Negotiable |
| 20 | Delay Costs | Risk & Title Transfer | Negotiable |
| 21 | Liquidated Damages | Unfixed Materials | Negotiable |
| 22 | Suspension | Intellectual Property | Negotiable |
| 23 | Termination | Urgent Protection | Negotiable |
| 26 | Defects Liability Period | Protection of Works | Negotiable |
| 27 | Warranty | Time is of the Essence / Escalation | Negotiable |

---

## Principles in section-mapping.json That Don't Exist in Canonical

These 6 "principles" were invented and have no equivalent:

1. **Legislative Compliance** - Not a DuraCube principle
2. **Priority of Documents** - Not a DuraCube principle
3. **Compliance with Direction** - Not a DuraCube principle
4. **Access to Site** - Not a DuraCube principle
5. **Latent Conditions** - Not a DuraCube principle
6. **Practical Completion** - Not a DuraCube principle (though related to DLP)

---

## Current Group Assignments (INCORRECT)

### Group A - General & Administrative (Currently)
- 1: Legislative Compliance ❌
- 2: Priority of Documents ❌
- 3: Head Contract Provision ✓
- 4: Compliance with Direction ❌
- 5: Access to Site ❌
- 6: Latent Conditions ❌

### Group B - Payment & Security (Currently)
- 14: Payment and Cash Neutrality ✓
- 15: Security & Parent Company Guarantees ✓
- 16: Release of Security ✓
- 24: Set Off ✓

**GROUP B IS CORRECT - No changes needed to principle IDs**

### Group C - Liability & Indemnity (Currently)
- 7: Care of Works & Reinstatement ❌
- 8: Risk Allocation and Indemnity ❌
- 9: Limitation of Liability ❌ (wrong ID - should be 1)
- 10: Consequential Loss ❌ (wrong ID - should be 2)
- 11: Time Bars ❌ (wrong ID - should be 8)

### Group D - Insurance (Currently)
- 25: Insurances ✓

**GROUP D IS CORRECT - No changes needed**

### Group E - Disputes & Legal (Currently)
- 13: Dispute Resolution ✓
- 19: Proportionate Liability Act ✓

**GROUP E IS CORRECT - No changes needed**

### Group F - Variations, Extensions & Claims (Currently)
- 17: Variations ❌ (wrong ID - should be 7)
- 18: Extensions of Time ❌ (wrong ID - should be 5)
- 20: Delay Costs ❌ (not a principle)
- 21: Liquidated Damages ❌ (wrong ID - should be 4)
- 22: Suspension ❌ (not a principle)
- 23: Termination ❌ (wrong ID - should be 11 or 12)

### Group G - Design, Defects & Completion (Currently)
- 12: Practical Completion ❌ (not a principle)
- 26: Defects Liability Period ❌ (wrong ID - should be 17)
- 27: Warranty ❌ (not a standalone principle)
- 28: Design Liability ✓

---

## Proposed Corrected Group Assignments

Based on typical contract structure and logical groupings:

### Group A - General & Administrative
**Principles:** 3, 10, 11

| ID | Name | Category | Rationale |
|----|------|----------|-----------|
| 3 | Head Contract Provision | NON-NEGOTIABLE | Contract relationship |
| 10 | Service for Notices | Negotiable | Administrative process |
| 11 | Termination | Negotiable | Contract ending basics |

### Group B - Payment & Security
**Principles:** 14, 15, 16, 24 (NO CHANGE NEEDED)

| ID | Name | Category | Rationale |
|----|------|----------|-----------|
| 14 | Payment and Cash Neutrality | NON-NEGOTIABLE | Money terms |
| 15 | Security & Parent Company Guarantees | NON-NEGOTIABLE | Financial security |
| 16 | Release of Security | NON-NEGOTIABLE | Security release |
| 24 | Set Off | NON-NEGOTIABLE | Payment deductions |

### Group C - Liability & Indemnity
**Principles:** 1, 2, 18, 19

| ID | Name | Category | Rationale |
|----|------|----------|-----------|
| 1 | Limitation of Liability | Negotiable | Liability caps |
| 2 | Consequential Damages | Negotiable | Damage types |
| 18 | Indemnities | Negotiable | Indemnification |
| 19 | Proportionate Liability Act | NON-NEGOTIABLE | Statutory liability |

### Group D - Insurance
**Principles:** 25 (NO CHANGE NEEDED)

| ID | Name | Category | Rationale |
|----|------|----------|-----------|
| 25 | Insurances | NON-NEGOTIABLE | Insurance requirements |

### Group E - Disputes & Legal
**Principles:** 13 (SIMPLIFIED)

| ID | Name | Category | Rationale |
|----|------|----------|-----------|
| 13 | Dispute Resolution | NON-NEGOTIABLE | Dispute process |

**Note:** Moving 19 (Proportionate Liability) to Group C since it's about liability allocation.

### Group F - Variations, Time & Claims
**Principles:** 4, 5, 6, 7, 8, 9, 12

| ID | Name | Category | Rationale |
|----|------|----------|-----------|
| 4 | Liquidated Damages | Negotiable | Delay damages |
| 5 | Extension of Time | Negotiable | Time relief |
| 6 | Force Majeure | Negotiable | Extraordinary events |
| 7 | Variations: Accelerations, Omissions | Negotiable | Scope changes |
| 8 | Time Bars/Notification Period | Negotiable | Notice requirements |
| 9 | Assessment Period | Negotiable | Claim processing |
| 12 | Termination for Convenience | Negotiable | Voluntary termination |

### Group G - Design, Defects & Completion
**Principles:** 17, 20, 21, 22, 23, 26, 27, 28

| ID | Name | Category | Rationale |
|----|------|----------|-----------|
| 17 | Defects Liability Period | Negotiable | Post-completion |
| 20 | Risk & Title Transfer | Negotiable | Ownership |
| 21 | Unfixed Materials | Negotiable | Materials on site |
| 22 | Intellectual Property | Negotiable | IP rights |
| 23 | Urgent Protection | Negotiable | Emergency works |
| 26 | Protection of Works | Negotiable | Works protection |
| 27 | Time is of the Essence / Escalation | Negotiable | Time obligations |
| 28 | Design Liability | NON-NEGOTIABLE | Design scope |

---

## Verification Checklist

### All 28 Principles Accounted For

| Check | Principle IDs | Count |
|-------|---------------|-------|
| Group A | 3, 10, 11 | 3 |
| Group B | 14, 15, 16, 24 | 4 |
| Group C | 1, 2, 18, 19 | 4 |
| Group D | 25 | 1 |
| Group E | 13 | 1 |
| Group F | 4, 5, 6, 7, 8, 9, 12 | 7 |
| Group G | 17, 20, 21, 22, 23, 26, 27, 28 | 8 |
| **TOTAL** | | **28** ✓ |

### Non-Negotiable Distribution

| Group | Non-Negotiable IDs | Count |
|-------|-------------------|-------|
| A | 3 | 1 |
| B | 14, 15, 16, 24 | 4 |
| C | 19 | 1 |
| D | 25 | 1 |
| E | 13 | 1 |
| F | (none) | 0 |
| G | 28 | 1 |
| **TOTAL** | 3, 13, 14, 15, 16, 19, 24, 25, 28 | **9** ✓ |

---

## Summary of Changes Required for Stage 2

1. **Group A:** Replace 1,2,4,5,6 with 10,11 (keep 3)
2. **Group B:** No changes - already correct
3. **Group C:** Replace 7,8,9,10,11 with 1,2,18,19
4. **Group D:** No changes - already correct
5. **Group E:** Remove 19 (moved to C), keep 13
6. **Group F:** Replace 17,18,20,21,22,23 with 4,5,6,7,8,9,12
7. **Group G:** Replace 12,26,27 with 17,20,21,22,23,26,27 (keep 28)

---

*Analysis Complete - Ready for Stage 2 Implementation*
