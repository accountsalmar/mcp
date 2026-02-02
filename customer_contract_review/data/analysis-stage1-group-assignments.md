# Stage 1 Analysis: Optimal Group Assignments

**Date:** 2026-02-02
**Purpose:** Determine optimal section groups that align with typical contract structure
**Status:** Analysis Only - No Code Changes

---

## Design Principles for Group Assignments

1. **Contract Structure Alignment:** Groups should match typical contract document sections
2. **User Workflow:** Users should be able to map contract table of contents to groups
3. **Principle Relationships:** Related principles should be in the same group
4. **Manageable Size:** Each group should have 1-8 principles (not too small, not too large)
5. **Critical Alert Concentration:** Groups with NON-NEGOTIABLE principles should be clearly marked

---

## Typical Contract Structure → Group Mapping

| Contract Section | Typical Pages | Group | Principles |
|-----------------|---------------|-------|------------|
| General Conditions, Interpretation | 1-30 | A | Contract basics |
| Payment Terms, Invoicing | 30-50 | B | Payment, security |
| Liability, Indemnity, Insurance | 50-80 | C + D | Risk allocation |
| Time, Delays, Variations | 80-120 | F | Claims, time relief |
| Completion, Defects, Handover | 120-150 | G | Post-completion |
| Disputes, Termination | 150-170 | E | Exit mechanisms |
| Schedules | 170+ | Various | Depends on content |

---

## Final Group Assignments (RECOMMENDED)

### Group A: General & Administrative Terms
**Contract Location:** Front matter, General Conditions, Notices
**Typical Pages:** 1-30

| ID | Name | Category | Search Terms (from principles.json) |
|----|------|----------|-------------------------------------|
| 3 | Head Contract Provision | NON-NEGOTIABLE | head contract, back-to-back, flow-down |
| 10 | Service for Notices | Negotiable | service of notices, email notice, delivery method |
| 11 | Termination | Negotiable | termination, termination rights, reciprocal |

**Critical Alerts:**
- Head contract flow-down provisions = NON-COMPLIANT

**Principle Count:** 3

---

### Group B: Payment & Security Terms
**Contract Location:** Payment clauses, Security sections, Retention
**Typical Pages:** 30-50

| ID | Name | Category | Search Terms (from principles.json) |
|----|------|----------|-------------------------------------|
| 14 | Payment and Cash Neutrality | NON-NEGOTIABLE | payment terms, 14 days, EOM, pay when paid |
| 15 | Security & Parent Company Guarantees | NON-NEGOTIABLE | bank guarantee, unconditional, PCG, security |
| 16 | Release of Security | NON-NEGOTIABLE | security release, guarantee expiry, retention release |
| 24 | Set Off | NON-NEGOTIABLE | set off, deduction, withhold, offset |

**Critical Alerts:**
- Unconditional bank guarantees = NON-COMPLIANT
- Parent Company Guarantees = NON-COMPLIANT
- Cash retention = NON-COMPLIANT
- Pay when paid = NON-COMPLIANT

**Principle Count:** 4

---

### Group C: Liability & Indemnity Terms
**Contract Location:** Liability clauses, Indemnification, Damages
**Typical Pages:** 50-70

| ID | Name | Category | Search Terms (from principles.json) |
|----|------|----------|-------------------------------------|
| 1 | Limitation of Liability | Negotiable | limitation of liability, liability cap, maximum liability |
| 2 | Consequential Damages | Negotiable | consequential damages, indirect loss, special damages |
| 18 | Indemnities | Negotiable | indemnity, indemnification, hold harmless |
| 19 | Proportionate Liability Act | NON-NEGOTIABLE | proportionate liability, concurrent wrongdoers, apportionment |

**Critical Alerts:**
- Exclusion of Proportionate Liability Act = NON-COMPLIANT
- One-sided indemnities without proportional reduction = HIGH RISK

**Principle Count:** 4

---

### Group D: Insurance Terms
**Contract Location:** Insurance schedules, Policy requirements
**Typical Pages:** 70-90

| ID | Name | Category | Search Terms (from principles.json) |
|----|------|----------|-------------------------------------|
| 25 | Insurances | NON-NEGOTIABLE | insurance, professional indemnity, PI insurance, public liability |

**Critical Alerts:**
- ANY Professional Indemnity Insurance requirement = NON-COMPLIANT (DuraCube has NO PI)
- Public liability over $20M = Review required
- Contract works over $400k = Review required

**Principle Count:** 1

---

### Group E: Disputes & Termination Terms
**Contract Location:** Dispute resolution, Termination for default/convenience
**Typical Pages:** 90-110

| ID | Name | Category | Search Terms (from principles.json) |
|----|------|----------|-------------------------------------|
| 12 | Termination for Convenience | Negotiable | termination for convenience, at-will termination, demobilisation |
| 13 | Dispute Resolution | NON-NEGOTIABLE | dispute resolution, mediation, arbitration, senior negotiation |

**Critical Alerts:**
- No senior executive negotiation step = NON-COMPLIANT
- Incomplete cost recovery on convenience termination = HIGH RISK

**Principle Count:** 2

---

### Group F: Variations, Time & Claims Terms
**Contract Location:** Variations, Extensions of Time, Delays, Claims
**Typical Pages:** 110-140

| ID | Name | Category | Search Terms (from principles.json) |
|----|------|----------|-------------------------------------|
| 4 | Liquidated Damages | Negotiable | liquidated damages, LDs, delay damages, sole remedy |
| 5 | Extension of Time | Negotiable | extension of time, EOT, delay relief, pandemic |
| 6 | Force Majeure | Negotiable | force majeure, act of God, extraordinary events |
| 7 | Variations: Accelerations, Omissions | Negotiable | variations, change orders, scope changes, acceleration |
| 8 | Time Bars/Notification Period | Negotiable | time bar, notification period, 5 business days |
| 9 | Assessment Period | Negotiable | assessment period, 10 business days, deemed approval |

**Critical Alerts:**
- LDs over 10% of contract value = HIGH RISK
- Time bars under 5 business days = NON-COMPLIANT
- No pandemic/supply chain EOT provisions = HIGH RISK

**Principle Count:** 6

---

### Group G: Design, Defects & Completion Terms
**Contract Location:** Practical Completion, DLP, Design, IP, Works Protection
**Typical Pages:** 140-180

| ID | Name | Category | Search Terms (from principles.json) |
|----|------|----------|-------------------------------------|
| 17 | Defects Liability Period | Negotiable | defects liability period, DLP, 52 weeks, 12 months |
| 20 | Risk & Title Transfer | Negotiable | risk transfer, title transfer, passing of risk, PPSA |
| 21 | Unfixed Materials | Negotiable | unfixed materials, materials on site, stored materials |
| 22 | Intellectual Property | Negotiable | intellectual property, IP, background IP, copyright |
| 23 | Urgent Protection | Negotiable | urgent protection, emergency work, mitigation |
| 26 | Protection of Works | Negotiable | protection of works, care of works, post-completion |
| 27 | Time is of the Essence / Escalation | Negotiable | time is of the essence, escalation, fundamental term |
| 28 | Design Liability | NON-NEGOTIABLE | design liability, fit for purpose, shop drawings |

**Critical Alerts:**
- "Fit for purpose" design obligations = NON-COMPLIANT
- DLP over 52 weeks/12 months = HIGH RISK
- Design liability beyond shop drawings = NON-COMPLIANT

**Principle Count:** 8

---

## Verification Summary

### Principle Distribution by Group

| Group | Principle IDs | Count | NON-NEGOTIABLE Count |
|-------|---------------|-------|---------------------|
| A | 3, 10, 11 | 3 | 1 |
| B | 14, 15, 16, 24 | 4 | 4 |
| C | 1, 2, 18, 19 | 4 | 1 |
| D | 25 | 1 | 1 |
| E | 12, 13 | 2 | 1 |
| F | 4, 5, 6, 7, 8, 9 | 6 | 0 |
| G | 17, 20, 21, 22, 23, 26, 27, 28 | 8 | 1 |
| **TOTAL** | | **28** | **9** |

### All 28 Principles Accounted For ✓

Sorted list: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28

### Non-Negotiable Principles (9) ✓

IDs: 3, 13, 14, 15, 16, 19, 24, 25, 28

Distribution:
- Group A: 3
- Group B: 14, 15, 16, 24 (4 principles - highest concentration)
- Group C: 19
- Group D: 25
- Group E: 13
- Group G: 28

### Negotiable Principles (19) ✓

IDs: 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27

---

## Changes from Current section-mapping.json

| Group | Current Principle IDs | New Principle IDs | Change |
|-------|----------------------|-------------------|--------|
| A | 1, 2, 3, 4, 5, 6 | 3, 10, 11 | Major restructure |
| B | 14, 15, 16, 24 | 14, 15, 16, 24 | **NO CHANGE** |
| C | 7, 8, 9, 10, 11 | 1, 2, 18, 19 | Complete replacement |
| D | 25 | 25 | **NO CHANGE** |
| E | 13, 19 | 12, 13 | Swap 19 for 12 |
| F | 17, 18, 20, 21, 22, 23 | 4, 5, 6, 7, 8, 9 | Complete replacement |
| G | 12, 26, 27, 28 | 17, 20, 21, 22, 23, 26, 27, 28 | Major restructure |

---

## Rationale for Key Decisions

### Why move Principle 19 (Proportionate Liability) from Group E to Group C?
- Proportionate Liability is fundamentally about **liability allocation**
- It determines how liability is split between concurrent wrongdoers
- Logically belongs with other liability principles (1, 2, 18)
- Makes Group E focused purely on disputes and exit mechanisms

### Why add Principle 12 (Termination for Convenience) to Group E?
- Termination for convenience is a major exit mechanism
- Related to dispute resolution as an alternative to disputes
- Both deal with "ending the contract" scenarios

### Why is Group F all Negotiable principles?
- Time and claims section typically has the most flexibility
- These are the commercial "give and take" areas
- Users should know upfront that Group F has room for negotiation

### Why is Group B 100% NON-NEGOTIABLE?
- Payment and security are DuraCube's fundamental business protections
- These principles protect cash flow and financial exposure
- Users should know Group B findings require escalation

---

*Analysis Complete - Ready for Stage 2 Implementation*
