# User Guide: Analyzing Large Contracts in Claude

## For DuraCube Contract Review Team (15 users)
**Version:** 1.2
**Date:** 2026-02-02

---

## When to Use This Guide

Use this guide when:
- Contract is **150+ pages**
- Claude shows **token limit errors**
- Analysis is **incomplete** or Claude stops mid-review
- Contract has **many schedules** or complex structure

---

## RECOMMENDED: Google Drive Method (Best Results)

### Why Use Google Drive Links?

When you share a **Google Drive link** instead of uploading directly, Claude handles large contracts much better:

| Method | Token Usage | Max Contract Size |
|--------|-------------|-------------------|
| Direct Upload | High (entire PDF in context) | ~200 pages |
| **Google Drive Link** | Low (on-demand extraction) | **500+ pages** |

Claude's sandbox can **search and extract specific pages** without loading the entire document.

### Setup (One-Time)

1. Upload your contract PDF to Google Drive
2. Right-click → Share → "Anyone with the link can view"
3. Copy the shareable link

### Google Drive Workflow

**Step 1: Share the Link**
```
Paste your Google Drive link in Claude chat:
https://drive.google.com/file/d/xxxxx/view
```

**Step 2: Quick Scan for Red Flags**
```
Search this contract PDF for these CRITICAL terms and report which pages contain them:

RED FLAGS (likely NON-COMPLIANT if found):
- "unconditional" (near guarantee/security) → Principle 15
- "parent company guarantee" or "PCG" → Principle 15
- "professional indemnity" or "PI insurance" → Principle 25
- "fit for purpose" → Principle 28

Also search for:
- "bank guarantee", "security" → Principle 15
- "insurance schedule" → Principle 25
- "design liability" → Principle 28
- "head contract", "back-to-back" → Principle 3

Format: Term → Pages found → Principle affected
```

**Step 3: Targeted Extraction**

Based on the search results, ask Claude to extract and analyze only the relevant pages:

```
Extract pages [X, Y, Z] from the contract and analyze against principles [N, M].
For each principle provide: Status, Page with Clause number, Departures required.
```

**Step 4: Combine Results**

Use the standard combining prompt (see below) to create the departure schedule.

---

## Alternative: Section-Based Method (Direct Upload)

If you can't use Google Drive, use the section-based approach below.

---

## Quick Start: The 3-Step Process

### Step 1: Map the Contract Structure

**Prompt to use:**
```
List all major sections and schedules in this contract with their page numbers.
Format as:
- Section Name: Pages X-Y
```

**Example output:**
```
- General Conditions: Pages 1-25
- Payment Terms: Pages 26-40
- Security and Guarantees: Pages 41-55
- Insurance: Pages 56-65
- Liability and Indemnity: Pages 66-85
- Dispute Resolution: Pages 86-95
- Variations: Pages 96-115
- Extensions of Time: Pages 116-125
- Defects and Completion: Pages 126-150
- Schedules A-F: Pages 151-200
```

---

### Step 2: Analyze by Section Groups

Use these **7 Section Groups** to analyze systematically:

| Group | Name | Principles | What to Look For |
|-------|------|------------|------------------|
| **A** | General & Admin | 3, 10, 11 | Head contract, notices, termination |
| **B** | Payment & Security | 14, 15, 16, 24 | Bank guarantees, PCGs, set off |
| **C** | Liability & Indemnity | 1, 2, 18, 19 | Liability caps, indemnities |
| **D** | Insurance | 25 | PI Insurance requirements |
| **E** | Disputes & Termination | 12, 13 | Dispute resolution, convenience termination |
| **F** | Variations & Time | 4, 5, 6, 7, 8, 9 | LDs, EOT, variations, time bars |
| **G** | Design & Completion | 17, 20-23, 26-28 | DLP, design liability, IP |

#### CRITICAL ALERTS:

**Group B - Security (ALL NON-NEGOTIABLE):**
- **Unconditional bank guarantees = NON-COMPLIANT** (DuraCube only provides dated guarantees)
- **Parent Company Guarantees = NON-COMPLIANT** (DuraCube never provides these)
- **Cash retention = NON-COMPLIANT**
- No security required = COMPLIANT (favorable)

**Group D - Insurance (NON-NEGOTIABLE):**
- **Any PI Insurance requirement = NON-COMPLIANT** (DuraCube does NOT hold PI insurance)

**Group G - Design (Contains NON-NEGOTIABLE):**
- Design liability beyond fabrication shop drawings = NON-COMPLIANT
- "Fit for purpose" design obligations = NON-COMPLIANT

---

### Analysis Prompts for Each Group

Copy and paste these prompts, replacing `[X-Y]` with actual page numbers:

#### Group A: General & Administrative
```
Analyze pages [X-Y] of this contract against DuraCube principles 3, 10, and 11:

3. Head Contract Provision (NON-NEGOTIABLE) - Look for back-to-back, flow-down provisions
10. Service for Notices - Check if email is included as valid service method
11. Termination - Verify termination rights are reciprocal

For each principle, provide: Status (Compliant/Non-Compliant/No Term), Page reference with clause number, any departures required.
```

#### Group B: Payment & Security (ALL NON-NEGOTIABLE)
```
Analyze pages [X-Y] of this contract against DuraCube principles 14, 15, 16, and 24:

14. Payment and Cash Neutrality - Payment should be 14 days EOM
15. Security & Parent Company Guarantees - Only dated guarantees, NO PCGs
16. Release of Security - 50% at PC, 50% after DLP (52 weeks)
24. Set Off - Requires mutual agreement before any set-off

CRITICAL ALERTS:
- Unconditional bank guarantees = NON-COMPLIANT
- Parent Company Guarantees = NON-COMPLIANT
- Cash retention = NON-COMPLIANT
- Pay when paid = NON-COMPLIANT

For each principle, provide: Status, Page reference with clause number, any departures required.
```

#### Group C: Liability & Indemnity
```
Analyze pages [X-Y] of this contract against DuraCube principles 1, 2, 18, and 19:

1. Limitation of Liability - Cap should be <= 100% of contract value
2. Consequential Damages - Should be mutually excluded
18. Indemnities - Should be reciprocal or proportionally reduced
19. Proportionate Liability Act (NON-NEGOTIABLE) - Must NOT be excluded

CRITICAL: Exclusion of Proportionate Liability Act = NON-COMPLIANT

For each principle, provide: Status (Compliant/Non-Compliant/No Term), Page reference with clause number, any departures required.
```

#### Group D: Insurance (NON-NEGOTIABLE)
```
Analyze pages [X-Y] of this contract against DuraCube principle 25 (Insurances).

DuraCube's insurance limits:
- Public Liability: $20M
- Contract Works: $400k project value
- Professional Indemnity: NOT PROVIDED

CRITICAL: Any requirement for Professional Indemnity (PI) Insurance is NON-COMPLIANT - DuraCube does not hold PI insurance.

Provide: Status, Page reference with clause number, any departures required.
```

#### Group E: Disputes & Termination
```
Analyze pages [X-Y] of this contract against DuraCube principles 12 and 13:

12. Termination for Convenience - Must include full cost recovery (overheads, materials, demob) and security release
13. Dispute Resolution (NON-NEGOTIABLE) - Must require senior executive negotiation before formal proceedings

For each principle, provide: Status (Compliant/Non-Compliant/No Term), Page reference with clause number, any departures required.
```

#### Group F: Variations, Time & Claims (ALL NEGOTIABLE)
```
Analyze pages [X-Y] of this contract against DuraCube principles 4, 5, 6, 7, 8, and 9:

4. Liquidated Damages - Max 10% of contract value, must be sole remedy for delay
5. Extension of Time - Must include time AND cost relief for pandemic, supply chain, etc.
6. Force Majeure - Must include time AND cost relief
7. Variations - Must require written direction with full cost recovery
8. Time Bars/Notification Period - Minimum 5 business days
9. Assessment Period - Maximum 10 business days

ALERTS:
- LDs over 10% = HIGH RISK
- Time bars under 5 days = HIGH RISK
- No pandemic provisions = HIGH RISK

For each principle, provide: Status (Compliant/Non-Compliant/No Term), Page reference with clause number, any departures required.
```

#### Group G: Design, Defects & Completion
```
Analyze pages [X-Y] of this contract against DuraCube principles 17, 20, 21, 22, 23, 26, 27, and 28:

17. Defects Liability Period - Max 52 weeks/12 months, no re-warranty
20. Risk & Title Transfer - Risk on accepted delivery, title on payment
21. Unfixed Materials - Payment for materials when installation impeded
22. Intellectual Property - Background IP retained, project IP on payment
23. Urgent Protection - Case-by-case with cost recovery
26. Protection of Works - No post-completion obligations
27. Time is of the Essence - Should be excluded
28. Design Liability (NON-NEGOTIABLE) - Limited to shop drawings only

CRITICAL ALERTS:
- "Fit for purpose" design obligations = NON-COMPLIANT
- Design liability beyond shop drawings = NON-COMPLIANT
- DLP over 52 weeks = HIGH RISK
- Transfer of background IP = NON-COMPLIANT

For each principle, provide: Status (Compliant/Non-Compliant/No Term), Page reference with clause number, any departures required.
```

---

### Step 3: Combine Results

After analyzing all groups, use this prompt:

```
Combine all the analysis results into a complete departure schedule using this exact format:

CustomerName_ProjectName_$ContractValue,,,,,,

SECTION 1 - NON-NEGOTIABLE,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
[Include principles 3, 13, 14, 15, 16, 19, 24, 25, 28 IN THIS ORDER]

SECTION 2 - NEGOTIABLE,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
[Include principles 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27 IN THIS ORDER]

Rules:
- Page format: "Page X, Clause Y.Z"
- Status: Compliant | Non-Compliant | No Term
- Departures use: Insert: | Replace: | Amend: | Delete:
- Comments column: Leave empty
```

---

## Example: Complete Workflow

### Contract: ABC Construction - New Hospital - $45M (180 pages)

**Step 1: Structure Mapping**
```
User: List all major sections with page numbers

Claude:
- General Conditions: Pages 1-30
- Payment: Pages 31-45
- Security: Pages 46-60
- Insurance: Pages 61-70
- Liability: Pages 71-90
- Disputes: Pages 91-100
- Variations & EOT: Pages 101-130
- Completion & Defects: Pages 131-150
- Schedules: Pages 151-180
```

**Step 2: Group Analyses**
```
User: [Paste Group A prompt with pages 1-30]
Claude: [Returns findings for principles 3, 10, 11]

User: [Paste Group B prompt with pages 31-60]
Claude: [Returns findings for principles 14, 15, 16, 24]
... repeat for each group ...
```

**Step 3: Combine**
```
User: [Paste combine prompt with all findings]
Claude: [Returns complete departure schedule CSV]
```

---

## Search-First Prompts (Google Drive)

### Full Discovery Scan
Copy this prompt to identify ALL relevant pages at once:

```
Search this contract PDF for the following terms and list which pages contain each term.
Do not extract full content yet, just identify page numbers:

**CRITICAL Terms (Non-Negotiable Principles):**
- 'bank guarantee', 'unconditional guarantee', 'security', 'PCG' → Principle 15
- 'parent company guarantee' → Principle 15
- 'professional indemnity', 'PI insurance' → Principle 25
- 'design liability', 'fit for purpose', 'shop drawings' → Principle 28
- 'head contract', 'principal contract', 'back-to-back' → Principle 3
- 'dispute resolution', 'arbitration', 'mediation' → Principle 13
- 'proportionate liability', 'Civil Liability Act' → Principle 19
- 'payment terms', 'progress claim', '14 days' → Principle 14
- 'release of security', 'return of guarantee' → Principle 16
- 'set off', 'withhold', 'deduct' → Principle 24

**Other Important Terms:**
- 'insurance', 'public liability' → Principle 25
- 'indemnity', 'hold harmless' → Principle 18
- 'limitation of liability', 'liability cap' → Principle 1
- 'consequential loss', 'indirect loss' → Principle 2
- 'time bar', 'notification period' → Principle 8
- 'defects liability', 'DLP', '52 weeks' → Principle 17
- 'extension of time', 'EOT' → Principle 5
- 'liquidated damages', 'LDs' → Principle 4
- 'variation', 'change order' → Principle 7
- 'termination' → Principles 11, 12
- 'force majeure' → Principle 6

Format: Term → Pages found → Principle
```

### Targeted Extraction Template
After the discovery scan, use this:

```
Extract and analyze pages [LIST YOUR PAGES] from this contract.
These pages contain terms relevant to principles [LIST PRINCIPLES].

For each principle provide:
- Status: Compliant / Non-Compliant / No Term
- Reference: Page X, Clause Y.Z
- Departure required (if any): Insert: / Replace: / Amend: / Delete:

REMEMBER:
- Unconditional bank guarantees = NON-COMPLIANT
- Parent Company Guarantees = NON-COMPLIANT
- PI Insurance requirements = NON-COMPLIANT
- Fit for purpose design = NON-COMPLIANT
```

---

## Tips for Best Results

### DO:
- **Use Google Drive links** for contracts over 100 pages
- **Search first** before deep analysis
- Start with red flag terms (unconditional, PCG, PI insurance, fit for purpose)
- Use the exact prompts provided
- Analyze one group at a time
- Copy-paste results between steps
- Check critical alerts for each group

### DON'T:
- Try to analyze entire contract in one prompt
- Upload large PDFs directly (use Google Drive instead)
- Skip the search/discovery step
- Mix principles from different groups
- Forget to combine results in correct order

---

## Quick Reference: Principle Order

**Section 1 - Non-Negotiable (9 principles):**
3 → 13 → 14 → 15 → 16 → 19 → 24 → 25 → 28

**Section 2 - Negotiable (19 principles):**
1 → 2 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 17 → 18 → 20 → 21 → 22 → 23 → 26 → 27

---

## Principle Names Quick Reference

| ID | Name | Category |
|----|------|----------|
| 1 | Limitation of Liability | Negotiable |
| 2 | Consequential Damages | Negotiable |
| 3 | Head Contract Provision | NON-NEGOTIABLE |
| 4 | Liquidated Damages | Negotiable |
| 5 | Extension of Time | Negotiable |
| 6 | Force Majeure | Negotiable |
| 7 | Variations | Negotiable |
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
| 27 | Time is of the Essence | Negotiable |
| 28 | Design Liability | NON-NEGOTIABLE |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Still hitting token limits | Split the group into smaller page ranges |
| Missing principles in output | Check you analyzed all 7 groups |
| Wrong principle order | Use the exact order in Quick Reference |
| Inconsistent findings | Re-analyze that section group |

---

## Need Help?

If you're still experiencing issues:
1. Try reducing page range per analysis (e.g., 30 pages max)
2. Ensure you're using Claude in a fresh conversation
3. Contact Kasun (developer) for support

---

*This guide accompanies the `get_section_principle_mapping` MCP tool - Version 1.2.0*
