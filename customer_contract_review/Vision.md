# DuraCube Customer Contract Review System - Architecture Framework

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Technology Assessment & Recommendations](#3-technology-assessment--recommendations)
4. [MVP Architecture](#4-mvp-architecture)
5. [Human Involvement Points](#5-human-involvement-points)
6. [Enhancement Roadmap](#6-enhancement-roadmap)
7. [Advanced Features Vision](#7-advanced-features-vision)
8. [Claude Code Capability Mapping](#8-claude-code-capability-mapping)
9. [Architecture Decision Records](#9-architecture-decision-records)
10. [Verification & Testing Strategy](#10-verification--testing-strategy)

---

## 1. Executive Summary

### 1.1 Project Vision

**Business Purpose:** Automate the review of customer contracts against DuraCube's 28 Standard Commercial Principles, producing structured departure schedules that identify non-compliant terms requiring negotiation.

**Analogy:** Think of this system as a "quality control inspector" for contracts. Just as a manufacturing QC inspector checks products against 28 specification standards and produces a defect report, this system checks contracts against 28 commercial principles and produces a departure schedule.

### 1.2 Strategic Value Proposition

| Benefit | Current State | Future State |
|---------|--------------|--------------|
| **Review Time** | 2-4 hours per contract (manual) | 10-15 minutes per contract |
| **Consistency** | Variable (depends on reviewer) | 100% consistent principle application |
| **Coverage** | Risk of missing clauses | All 28 principles checked every time |
| **Learning** | Tribal knowledge | Systematic improvement from feedback |
| **Audit Trail** | Email chains, notes | Structured CSV + version history |

### 1.3 High-Level Technology Approach

```
┌────────────────────────────────────────────────────────────────────────┐
│                     CONTRACT REVIEW SYSTEM                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Contract Upload]  →  [AI Analysis Engine]  →  [Departure Schedule]   │
│       (PDF/Word)         (Claude + Rules)         (CSV/Excel)          │
│                                                                         │
│  Future Enhancements:                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐        │
│  │ Vector DB   │  │ Self-Learning │  │ Legal Database          │        │
│  │ (Nexsus)    │  │ (Feedback)    │  │ (Contract History)      │        │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Current State Analysis

### 2.1 Existing Assets Inventory

| Asset | Description | Readiness |
|-------|-------------|-----------|
| **28 Commercial Principles** | Complete with search terms, red flags, negotiation positions | Production-ready |
| **Current Agent Prompt (v2.1)** | Running on myaidrive.com, produces CSV output | Functional |
| **Improvement Log** | 15+ documented learnings from operational errors | Valuable knowledge |
| **Nexsus Technology** | Vector DB with semantic search, ready for integration | Requires adaptation |

### 2.2 Current Agent Capabilities (v2.1)

**Strengths:**
- 3-step comparison validation protocol (Extract → Compare → Classify)
- Constitutional logic for compliance assessment
- Multi-pass extraction methodology
- CSV output with 7-column structure
- Self-correction from FEEDBACK&UPDATE messages

**Documented Pain Points (from 0_IMPROVEMENT.md):**
1. Page reference format errors (now requires "Page X, Clause Y")
2. Design liability classification errors (scope comparison failures)
3. Security favorability assessment errors (N/A ≠ Non-compliant)
4. DLP vs warranty confusion (separate clause analysis)
5. Insurance favorability logic (absence = favorable)
6. Template vs marked-up analysis (analyze original only)
7. DLP date calculation errors (use calendar dates, not duration fields)

### 2.3 Gap Analysis

| Capability | Current State | Required for MVP | Required for Advanced |
|------------|--------------|-----------------|----------------------|
| Contract upload | Manual paste | PDF/Word upload | Bulk upload |
| Semantic search | None | N/A | Historical clause search |
| Feedback learning | Manual prompt updates | Structured feedback collection | Automatic rule improvement |
| Version control | None | Analysis versioning | Contract version tracking |
| Export formats | CSV only | CSV + Excel | PDF + Word + API |
| Multi-contract comparison | None | N/A | Template comparison |

---

## 3. Technology Assessment & Recommendations

### 3.1 Claude Code Capabilities Mapping

| Claude Code Feature | Application to Contract Review |
|--------------------|-------------------------------|
| **Projects** | Organize codebase into 5 sections (pipeline, semantic, exact, knowledge, console) |
| **Skills** | `/analyze-contract`, `/generate-report`, `/feedback` slash commands |
| **MCP Tools** | 8-12 specialized tools for analysis, extraction, export |
| **Artifacts** | Store analysis results, generate downloadable reports |
| **File Operations** | PDF parsing, Excel generation, cloud storage |

### 3.2 Technology Stack Recommendation

**MVP Stack (CONFIRMED):**

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **AI Engine** | Claude Opus 4.5 | CONFIRMED: Quality is priority, cost not a concern |
| **Document Parsing** | pdf-parse + Tesseract (OCR) | Handle both native and scanned PDFs |
| **Export Generation** | xlsx + docx libraries | Native Excel/Word without external dependencies |
| **Deployment** | Railway Cloud MCP Server | CONFIRMED: Cloud deployment for accessibility |
| **Integration** | Standalone (no ERP) | CONFIRMED: Manual upload/download workflow |
| **Volume Design** | 1-10 contracts/month | CONFIRMED: No batch processing required |

**Enhancement Stack (Phase 2+):**

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Vector Database** | Qdrant (via Nexsus) | Production-proven, semantic + exact search |
| **Embeddings** | Voyage AI (voyage-3.5-lite) | Cost-effective ($0.02/1M tokens) |
| **Cloud Storage** | Cloudflare R2 | Cheap, S3-compatible, signed URLs |
| **MCP Server** | TypeScript + stdio transport | Consistent with Nexsus architecture |

### 3.3 What Claude Code Can Decide Autonomously

- Library/dependency versions
- Code structure within sections
- Error handling patterns
- Internal data structures
- Caching strategies

### 3.4 What Requires Human Approval

- Vector database selection (Qdrant vs alternatives)
- Deployment platform (local vs cloud vs hybrid)
- Data retention policies
- Integration with existing DuraCube systems
- Budget for API calls (embeddings, LLM)

---

## 4. MVP Architecture

### 4.1 MVP Feature Specifications

**Core Workflow:**
```
1. User uploads contract (PDF or Word document)
           ↓
2. System extracts text and normalizes formatting
           ↓
3. AI analyzes against 28 commercial principles
           ↓
4. System generates departure schedule (CSV/Excel)
           ↓
5. User reviews and provides feedback
```

**MVP Scope:**

| Feature | Included | Excluded (Future) |
|---------|----------|-------------------|
| Single contract analysis | Yes | Bulk processing |
| PDF text extraction | Yes | OCR for scanned docs |
| 28-principle analysis | Yes | Custom principle addition |
| CSV export | Yes | Word redline generation |
| Basic feedback collection | Yes | Automatic rule learning |
| Page + clause references | Yes | Clause hyperlinking |

### 4.2 MVP File Structure

```
customer_contract_review/
├── .claude/
│   ├── CLAUDE.md                    # Project instructions
│   └── commands/
│       └── analyze-contract.md      # Main analysis skill
│
├── src/
│   ├── pipeline/                    # Document processing
│   │   ├── pdf-parser.ts           # Extract text from PDF
│   │   └── text-normalizer.ts      # Clean and structure text
│   │
│   ├── analyzer/                    # Core analysis logic
│   │   ├── principle-matcher.ts    # Match clauses to principles
│   │   ├── compliance-checker.ts   # Apply 3-step validation
│   │   └── departure-generator.ts  # Create departure text
│   │
│   ├── knowledge/                   # Static rules
│   │   ├── principles.json         # 28 principles as structured data
│   │   └── search-terms.json       # Keywords per principle
│   │
│   └── export/                      # Output generation
│       ├── csv-exporter.ts         # Generate CSV
│       └── excel-exporter.ts       # Generate Excel
│
├── data/
│   ├── contracts/                   # Input documents
│   ├── exports/                     # Generated reports
│   └── feedback/                    # User corrections
│
└── tests/
    ├── sample-contracts/            # Test contracts
    └── expected-outputs/            # Expected departure schedules
```

### 4.3 MVP Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MVP DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────┐                │
│  │ Contract    │     │ Text         │     │ Structured     │                │
│  │ PDF/Word    │────→│ Extraction   │────→│ Text           │                │
│  │             │     │              │     │                │                │
│  └─────────────┘     └──────────────┘     └───────┬────────┘                │
│                                                    │                         │
│                                                    ↓                         │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    ANALYSIS ENGINE                                │        │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │        │
│  │  │ Pass 1:     │  │ Pass 2:     │  │ Pass 3:     │              │        │
│  │  │ Structure   │→ │ Targeted    │→ │ Validation  │              │        │
│  │  │ Mapping     │  │ Extraction  │  │             │              │        │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │        │
│  │                                                                   │        │
│  │  For each of 28 principles:                                      │        │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │        │
│  │  │ Step 1:     │  │ Step 2:     │  │ Step 3:     │              │        │
│  │  │ Evidence    │→ │ Substantive │→ │ Classification│             │        │
│  │  │ Extraction  │  │ Comparison  │  │ Decision    │              │        │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                    │                         │
│                                                    ↓                         │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────┐                │
│  │ 28 Analysis │     │ Departure    │     │ CSV/Excel      │                │
│  │ Results     │────→│ Generation   │────→│ Export         │                │
│  │             │     │              │     │                │                │
│  └─────────────┘     └──────────────┘     └────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 28 Principles as Structured Data

**Principle Categorization:**

All 28 principles are classified into two categories:

| Section | Category | Count | Meaning |
|---------|----------|-------|---------|
| Section 1 | **Non-Negotiable** | 9 | DuraCube's firm positions - cannot be compromised |
| Section 2 | **Negotiable** | 19 | Flexible terms - can be discussed during negotiation |

**Section 1 - Non-Negotiable (9 principles):**
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

**Section 2 - Negotiable (19 principles):**
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

**JSON Schema (with category field):**

```json
{
  "principles": [
    {
      "id": 1,
      "name": "Limitation of Liability",
      "category": "NEGOTIABLE",
      "standard": "Cap of 100% of the Contract value",
      "risk_level": "HIGH",
      "search_terms": {
        "primary": ["limitation of liability", "liability cap", "maximum liability"],
        "alternative": ["aggregate liability", "total liability", "liability ceiling"],
        "related": ["indemnity cap", "damages limitation", "financial exposure"]
      },
      "red_flags": [
        "Unlimited liability clauses",
        "Caps exceeding 100% of contract value",
        "Carve-outs that effectively negate the cap"
      ],
      "negotiation_positions": {
        "preferred": "100% cap on all liability",
        "fallback": "Higher cap with specific carve-outs for gross negligence only",
        "deal_breaker": "Unlimited liability exposure"
      },
      "compliance_logic": {
        "compliant_if": "Contract liability cap <= 100% of contract value",
        "non_compliant_if": "Contract liability cap > 100% OR unlimited",
        "no_term_risk": "HIGH - creates existential exposure"
      }
    }
  ]
}
```

### 4.5 Output Format Specification

**Two-Section Departure Schedule:**

The CSV/Excel output is organized into two sections based on principle categorization:

**CSV Structure (7 columns, exact format with section headers):**
```
CustomerName_ProjectName_$ContractValue,,,,,,

SECTION 1 - NON-NEGOTIABLE,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
3,Head Contract Provision,[Status],"Page X, Clause Y",[Contract Text],[Departure],
13,Dispute Resolution,[Status],"Page X, Clause Y",[Contract Text],[Departure],
14,Payment and Cash Neutrality,[Status],"Page X, Clause Y",[Contract Text],[Departure],
15,Security & Parent Company Guarantees,[Status],"Page X, Clause Y",[Contract Text],[Departure],
16,Release of Security,[Status],"Page X, Clause Y",[Contract Text],[Departure],
19,Proportionate Liability Act,[Status],"Page X, Clause Y",[Contract Text],[Departure],
24,Set Off,[Status],"Page X, Clause Y",[Contract Text],[Departure],
25,Insurances,[Status],"Page X, Clause Y",[Contract Text],[Departure],
28,Design Liability,[Status],"Page X, Clause Y",[Contract Text],[Departure],

SECTION 2 - NEGOTIABLE,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
1,Limitation of Liability,Non-Compliant,"Page 5, Clause 8.1","Contractor's liability shall be unlimited...","Replace: 'unlimited' with 'limited to 100% of the Contract Value'",
2,Consequential Damages,Compliant,"Page 6, Clause 9.2","Neither party shall be liable for any consequential loss",,
4,Liquidated Damages,[Status],"Page X, Clause Y",[Contract Text],[Departure],
5,Extension of Time,[Status],"Page X, Clause Y",[Contract Text],[Departure],
6,Force Majeure,[Status],"Page X, Clause Y",[Contract Text],[Departure],
7,Variations: Accelerations Omissions,[Status],"Page X, Clause Y",[Contract Text],[Departure],
8,Time Bars/Notification Period,[Status],"Page X, Clause Y",[Contract Text],[Departure],
9,Assessment Period,[Status],"Page X, Clause Y",[Contract Text],[Departure],
10,Service for Notices,[Status],"Page X, Clause Y",[Contract Text],[Departure],
11,Termination,[Status],"Page X, Clause Y",[Contract Text],[Departure],
12,Termination for Convenience,[Status],"Page X, Clause Y",[Contract Text],[Departure],
17,Defects Liability Period,[Status],"Page X, Clause Y",[Contract Text],[Departure],
18,Indemnities,[Status],"Page X, Clause Y",[Contract Text],[Departure],
20,Risk & Title Transfer,[Status],"Page X, Clause Y",[Contract Text],[Departure],
21,Unfixed Materials,[Status],"Page X, Clause Y",[Contract Text],[Departure],
22,Intellectual Property,[Status],"Page X, Clause Y",[Contract Text],[Departure],
23,Urgent Protection,[Status],"Page X, Clause Y",[Contract Text],[Departure],
26,Protection of Works,[Status],"Page X, Clause Y",[Contract Text],[Departure],
27,Time is of the Essence / Escalation,[Status],"Page X, Clause Y",[Contract Text],[Departure],
```

**Ordering Rules:**
- Section 1 principles appear first (ordered by principle number: 3, 13, 14, 15, 16, 19, 24, 25, 28)
- Section 2 principles appear second (ordered by principle number: 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27)
- Each section has a header row ("SECTION 1 - NON-NEGOTIABLE" or "SECTION 2 - NEGOTIABLE")
- Column headers appear after each section header

---

## 5. Human Involvement Points

### 5.1 Upload Workflow Design

**User Actions:**
1. Select contract file (PDF or Word)
2. Enter contract metadata (Customer, Project, Value)
3. Click "Analyze"
4. Wait for analysis (typically 2-5 minutes)
5. Review departure schedule
6. Download CSV/Excel

### 5.2 Review Validation Checkpoints

**Checkpoint 1: Extraction Verification**
- Display extracted contract metadata (parties, dates, value)
- User confirms accuracy before analysis proceeds

**Checkpoint 2: Ambiguity Resolution (Confidence < 70%)**
- Flag ambiguous clauses for human interpretation
- Provide multiple interpretation options

**Checkpoint 3: Final Review Before Export**
- Summary dashboard showing Compliant/Non-Compliant/No Term counts
- Option to override any classification with reason
- Sign-off confirmation

### 5.3 Approval Gates

**MVP Completion Gate:**
- [ ] Legal team validates output quality on 10 test contracts
- [ ] Business approves workflow integration
- [ ] Zero critical errors in departure identification
- [ ] All 28 principles demonstrated working

### 5.4 Escalation Protocols

**Automatic Escalation Triggers:**
1. Professional Indemnity Insurance requirement detected → Flag as NON-COMPLIANT + alert
2. Contract value exceeds $5M → Require senior review
3. More than 15 non-compliant principles → High-risk contract alert
4. Unknown contract type → Request human classification

---

## 6. Enhancement Roadmap

### 6.1 Enhancement Cycle 1: Feedback Learning

**Features:**
- Structured feedback collection (correct/wrong/incomplete)
- Correction tracking with field-level detail
- Pattern detection for repeated errors
- Monthly accuracy reporting

### 6.2 Enhancement Cycle 2: Multi-Format Export

**Features:**
- Excel export with multiple sheets (Summary, Details, Timeline)
- PDF report with executive summary
- Word document with tracked changes (redline)
- API endpoint for system integration

### 6.3 Enhancement Cycle 3: Bulk Processing

**Features:**
- Folder upload for multiple contracts
- Progress tracking dashboard
- Batch export (consolidated report)
- Priority queue management

### 6.4 Enhancement Cycle 4: Historical Comparison

**Features:**
- Compare current contract vs previous versions
- Identify changes between negotiation rounds
- Template deviation analysis
- Trend reporting (common issues by customer/industry)

---

## 7. Advanced Features Vision

### 7.1 Vector Database Integration (Nexsus Technology)

**Use Cases:**
1. **Precedent Search**: "Find all contracts with similar liability clauses"
2. **Template Matching**: "Which standard template is closest to this contract?"
3. **Clause Reuse Analysis**: "Which liability clause wording is used most often?"
4. **Customer History**: "Show all previous contracts with Acme Corp"

### 7.2 Self-Learning System Architecture

**Learning Pipeline:**
```
User Feedback → Feedback Storage → Pattern Detection → Rule Improvement Proposals
                                                              ↓
                                         Human Review & Approval
                                                              ↓
                                         Knowledge Base Update
```

### 7.3 Legal Database Expansion Strategy

**Phase 1:** Internal Repository - Store all analyzed contracts with departure schedules
**Phase 2:** Knowledge Graph - Contract → Clause → Template relationships
**Phase 3:** Regulatory Integration - Jurisdiction-specific rules

---

## 8. Claude Code Capability Mapping

### 8.1 Projects Feature Utilization

**Section Isolation Rules:**
```
When working in analyzer/:
  WRITE: src/analyzer/*, src/common/*
  READ-ONLY: src/pipeline/*, src/export/*, src/knowledge/*
  CALL: Functions from knowledge/ for rule lookup ONLY

When working in common/:
  WRITE: src/common/* ONLY
  NEVER: Import from analyzer/, pipeline/, export/, knowledge/
```

### 8.2 Skills Feature Applications

| Skill | Purpose |
|-------|---------|
| `/analyze-contract` | Full 28-principle analysis workflow |
| `/feedback` | Record corrections on analysis accuracy |
| `/compare-analysis` | Compare two contract analyses side-by-side |

### 8.3 MCP Integration Opportunities

| Tool Name | Purpose | Section |
|-----------|---------|---------|
| `analyze_contract` | Full 28-principle analysis | analyzer |
| `extract_clauses` | Extract clauses by principle | pipeline |
| `check_compliance` | Check single principle compliance | analyzer |
| `generate_departure` | Create departure text | analyzer |
| `export_csv` | Generate CSV output | export |
| `export_excel` | Generate Excel output | export |
| `search_precedents` | Find similar contracts (future) | semantic |
| `collect_feedback` | Store user corrections | knowledge |
| `get_accuracy_metrics` | Retrieve accuracy statistics | knowledge |
| `compare_contracts` | Compare two analyses | analyzer |

---

## 9. Architecture Decision Records

### ADR-001: AI Model Selection
**Status:** APPROVED
**Decision:** Use Claude Opus 4.5 as the primary analysis model
**Rationale:** Quality is priority, cost not a concern. Best-in-class legal reasoning.

### ADR-002: MVP Deployment Architecture
**Status:** APPROVED
**Decision:** Deploy as Cloud MCP Server on Railway
**Rationale:** Cloud accessibility preferred, enables multi-user expansion.

### ADR-003: Vector Database Technology
**Status:** Proposed (Future)
**Decision:** Use Qdrant via Nexsus integration
**Rationale:** Production-proven, supports semantic + exact filtering.

---

## 10. Verification & Testing Strategy

### 10.1 Acceptance Testing Protocol

**Pass Criteria:**
- 95% principle coverage accuracy (27/28 correct per contract)
- 100% critical principle accuracy (Principles 1, 4, 15, 19, 25)
- All page references verifiable in source document
- All departure text actionable (specific amendment language)

### 10.2 Test Contract Set
- 10 sample contracts with known departure counts
- Mix of contract types (supply, construction, service)
- Include edge cases (ambiguous clauses, missing sections)

---

## Appendix: Confirmed Decisions Summary

| Decision | User Choice | Impact |
|----------|-------------|--------|
| **Deployment** | Cloud MCP Server (Railway) | Requires Railway setup, enables multi-user |
| **Volume** | 1-10 contracts/month | No batch processing needed, simple architecture |
| **Integration** | Standalone system | Manual upload/download, no ERP connection |
| **Quality vs Cost** | Quality is priority | Use Claude Opus, ~$0.30-0.50 per contract |

---

## Implementation Sequence (Recommended)

### Stage 1: Foundation (Week 1-2)
1. Set up Railway project with Node.js runtime
2. Create MCP server skeleton with stdio transport
3. Implement PDF text extraction (pdf-parse)
4. Convert 28 principles to JSON structure
5. Test basic text extraction with sample contracts

### Stage 2: Analysis Engine (Week 3-4)
1. Implement 3-pass extraction methodology
2. Build 3-step comparison validation for each principle
3. Create departure text generator
4. Test against 5 sample contracts
5. Calibrate confidence scoring

### Stage 3: Export & Quality (Week 5-6)
1. Implement CSV export with 7-column format
2. Add Excel export with multiple sheets
3. Build validation checkpoints
4. Run full test suite (10 contracts)
5. Collect feedback and iterate

### Stage 4: Deployment (Week 7)
1. Deploy to Railway
2. Configure environment variables
3. Set up monitoring
4. Legal team UAT
5. Production launch

---

*Document Version: 1.0 (FINAL)*
*Last Updated: 2026-01-25*
*Status: Ready for Implementation*
*Decisions Confirmed: Deployment, Volume, Integration, Budget*
