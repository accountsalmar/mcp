# Customer Contract Review System

## Project Overview

This project implements an AI-powered contract review system for DuraCube that analyzes customer contracts against 28 Standard Commercial Principles and produces structured departure schedules.

**Vision Document:** See [Vision.md](./Vision.md) for the complete architecture framework including:
- Executive Summary & Business Value
- Technology Stack Decisions
- MVP Architecture & File Structure
- Enhancement Roadmap
- Advanced Features (Nexsus/Vector DB Integration)
- Architecture Decision Records (ADRs)

---

## Quick Reference

### What This System Does
1. Accepts contract documents (PDF/Word)
2. Extracts and analyzes text against 28 commercial principles
3. Produces a departure schedule identifying non-compliant terms
4. Exports results as CSV/Excel for negotiation use

### Key Decisions (CONFIRMED)
| Decision | Choice |
|----------|--------|
| AI Model | Claude Opus 4.5 (quality priority) |
| Deployment | Railway Cloud MCP Server |
| Volume | 1-10 contracts/month |
| Integration | Standalone (no ERP) |

---

## Project Structure

```
customer_contract_review/
├── Vision.md                        # Architecture framework (READ FIRST)
├── CLAUDE.md                        # This file - project instructions
├── .claude/
│   └── commands/                    # Skill definitions
│       └── analyze-contract.md
├── src/
│   ├── pipeline/                    # Document processing
│   ├── analyzer/                    # Core analysis logic
│   ├── knowledge/                   # 28 principles + rules
│   └── export/                      # CSV/Excel generation
├── data/
│   ├── contracts/                   # Input documents
│   ├── exports/                     # Generated reports
│   └── feedback/                    # User corrections
└── tests/
    └── sample-contracts/            # Test contracts
```

---

## Working in This Project

### Section Boundaries

When working on this project, respect these section boundaries:

**src/pipeline/** - Document Processing
- PDF text extraction
- Text normalization
- CAN IMPORT FROM: src/common/
- CANNOT IMPORT FROM: src/analyzer/, src/export/, src/knowledge/

**src/analyzer/** - Core Analysis
- Principle matching
- Compliance checking
- Departure generation
- CAN IMPORT FROM: src/common/, src/knowledge/
- CANNOT IMPORT FROM: src/pipeline/, src/export/

**src/knowledge/** - Domain Rules
- 28 principles as JSON
- Search terms and keywords
- Compliance logic rules
- CAN IMPORT FROM: src/common/
- CANNOT IMPORT FROM: src/pipeline/, src/analyzer/, src/export/

**src/export/** - Output Generation
- CSV exporter
- Excel exporter
- CAN IMPORT FROM: src/common/
- CANNOT IMPORT FROM: src/pipeline/, src/analyzer/, src/knowledge/

---

## The 28 Commercial Principles

The system analyzes contracts against these principles, organized into two categories:

### Section 1 - Non-Negotiable (9 principles)
These terms represent DuraCube's firm commercial positions that **cannot be compromised**:

| # | Principle | Risk Level |
|---|-----------|------------|
| 3 | Head Contract Provision | MEDIUM-HIGH |
| 13 | Dispute Resolution | LOW-MEDIUM |
| 14 | Payment and Cash Neutrality | MEDIUM |
| 15 | Security & Parent Company Guarantees | HIGH |
| 16 | Release of Security | MEDIUM |
| 19 | Proportionate Liability Act | HIGH |
| 24 | Set Off | HIGH |
| 25 | Insurances | HIGH |
| 28 | Design Liability | HIGH |

### Section 2 - Negotiable (19 principles)
These terms have flexibility and **can be discussed** during contract negotiation:

| # | Principle | Risk Level |
|---|-----------|------------|
| 1 | Limitation of Liability | HIGH |
| 2 | Consequential Damages | HIGH |
| 4 | Liquidated Damages | HIGH |
| 5 | Extension of Time | HIGH |
| 6 | Force Majeure | MEDIUM-HIGH |
| 7 | Variations: Accelerations, Omissions | HIGH |
| 8 | Time Bars/Notification Period | HIGH |
| 9 | Assessment Period | MEDIUM |
| 10 | Service for Notices | LOW-MEDIUM |
| 11 | Termination | MEDIUM |
| 12 | Termination for Convenience | HIGH |
| 17 | Defects Liability Period | MEDIUM |
| 18 | Indemnities | MEDIUM-HIGH |
| 20 | Risk & Title Transfer | MEDIUM |
| 21 | Unfixed Materials | MEDIUM |
| 22 | Intellectual Property | HIGH |
| 23 | Urgent Protection | MEDIUM |
| 26 | Protection of Works | MEDIUM |
| 27 | Time is of the Essence / Escalation | MEDIUM |

### Critical Non-Negotiables
- **Professional Indemnity Insurance**: DuraCube does NOT provide PI insurance. Any requirement = NON-COMPLIANT
- **Unconditional Bank Guarantees**: Only dated guarantees accepted
- **Parent Company Guarantees**: Not provided under any circumstances

---

## Analysis Methodology

### 3-Pass Extraction
1. **Pass 1: Structure Mapping** - Map all sections, headings, page numbers
2. **Pass 2: Targeted Extraction** - Search using principle keywords
3. **Pass 3: Validation** - Verify no clauses missed, check conflicts

### 3-Step Comparison Validation (Per Principle)
1. **Step 1: Evidence Extraction** - Extract exact contract language + DuraCube standard
2. **Step 2: Substantive Comparison** - Compare meaning, assess implications
3. **Step 3: Classification Decision** - Assign: Compliant | Non-Compliant | No Term

### Constitutional Logic
```
Contract terms = DuraCube standard → COMPLIANT
Contract terms > DuraCube standard (more favorable) → COMPLIANT
Contract terms < DuraCube standard (less favorable) → NON-COMPLIANT
No contract terms → NO TERM (assess risk)
```

---

## Output Format

**Two-Section Departure Schedule:**

The output is organized into two sections based on principle categorization:

```
CustomerName_ProjectName_$ContractValue,,,,,,

SECTION 1 - NON-NEGOTIABLE,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
3,Head Contract Provision,...
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
... (remaining negotiable principles in number order)
```

**Ordering Rules:**
- Section 1: Principles 3, 13, 14, 15, 16, 19, 24, 25, 28 (in number order)
- Section 2: Principles 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27 (in number order)

**Page Reference Format (MANDATORY):**
- Always include both page AND clause: "Page 5, Clause 8.1"
- Never use page numbers alone

---

## Implementation Status

### Current Phase: Planning Complete

**Next Steps (choose what to implement):**

| Option | Description | Complexity |
|--------|-------------|------------|
| **A** | Convert 28 principles to JSON | Low |
| **B** | Build PDF text extraction | Low |
| **C** | Implement CSV exporter | Low |
| **D** | Build analysis engine (3-step validation) | Medium |
| **E** | Create MCP server skeleton | Medium |
| **F** | Full MVP implementation | High |

Tell me which component(s) you'd like to start with!

---

## Reference Documents

External assets (not in this repo):
- `0_Duracube_Standard_Commercial_FINAL.md` - Full 28 principles with all details
- `0_IMPROVEMENT.md` - Accumulated learnings from operational errors
- `Main Agent Prompt.txt` - Current v2.1 agent prompt (myaidrive.com)

---

*Last Updated: 2026-01-25*
