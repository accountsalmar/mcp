# Quick Win MCP Server - Contract Review Knowledge Provider

## Overview

Build a lightweight MCP server that provides DuraCube's 28 commercial principles as knowledge tools for Claude.ai. Instead of processing contracts server-side, we leverage Claude's existing PDF reading and reasoning capabilities - the MCP only delivers the domain knowledge Claude lacks.

**Key Paradigm:** MCP provides KNOWLEDGE, Claude provides ANALYSIS.

**User Flow:**
```
User uploads contract to claude.ai → Claude reads PDF → Claude calls MCP for principles/learnings → Claude applies knowledge → Returns departure schedule
```

**Estimated Total Build Time:** 1-2 days

---

## Stages

### Stage 1: Project Setup & JSON Knowledge Base
**Goal:** Create project structure and convert source documents to structured JSON
**Estimated effort:** Medium (2-3 hours)

**Tasks:**
- [ ] Create `duracube-contract-mcp/` project folder
- [ ] Initialize npm project with TypeScript
- [ ] Install dependencies: `@modelcontextprotocol/sdk`, `zod`, `express` (for HTTP)
- [ ] Create folder structure: `src/`, `src/tools/`, `src/knowledge/`
- [ ] Convert `0_Duracube_Standard_Commercial_FINAL.md` → `principles.json`
- [ ] Convert `0_IMPROVEMENT.md` → `learnings.json`
- [ ] Create `format.json` with CSV specification

**Tests (Claude Code - stdio):**
- [ ] `npm install` completes without errors
- [ ] `npx tsc --noEmit` passes (TypeScript compiles)
- [ ] JSON files are valid: `node -e "require('./src/knowledge/principles.json')"`
- [ ] Principles JSON has exactly 28 entries
- [ ] Learnings JSON has all documented corrections

**Tests (claude.ai - HTTP):**
- [ ] N/A for this stage (no server yet)

**Success Criteria:**
- Project structure matches planned layout
- All 28 principles converted with: id, name, standard, risk_level, search_terms, red_flags, compliance_logic, negotiation_positions
- All learnings converted with: id, category, principle_id, issue, correction, rule
- Format spec includes: row structure, column specs, example rows, quality checklist

**Source Files:**
- `C:\Users\KasunJ\OneDrive - duracube.com.au\Desktop\0_Duracube_Standard_Commercial_FINAL.md`
- `C:\Users\KasunJ\OneDrive - duracube.com.au\Desktop\0_IMPROVEMENT.md`

---

### Stage 2: MCP Server Core & Tool Registration
**Goal:** Build MCP server with 3 knowledge tools
**Estimated effort:** Medium (2-3 hours)

**Tasks:**
- [ ] Create `src/index.ts` - MCP server with stdio transport (for local testing)
- [ ] Create `src/tools/knowledge-tools.ts` - Tool definitions
- [ ] Implement `get_duracube_principles` tool
- [ ] Implement `get_learned_corrections` tool (with category filter)
- [ ] Implement `get_output_format` tool
- [ ] Add tool input validation with Zod schemas
- [ ] Test tool responses return valid JSON

**Tool Specifications:**

```typescript
// Tool 1: get_duracube_principles
{
  name: "get_duracube_principles",
  description: "Get all 28 DuraCube commercial principles with standards, search terms, red flags, and compliance logic for contract review",
  inputSchema: {
    type: "object",
    properties: {
      include_examples: { type: "boolean", default: false }
    }
  }
}

// Tool 2: get_learned_corrections
{
  name: "get_learned_corrections",
  description: "Get documented learnings from past contract review errors - critical edge cases for accurate analysis",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["all", "security", "insurance", "dlp", "design", "methodology"],
        default: "all"
      }
    }
  }
}

// Tool 3: get_output_format
{
  name: "get_output_format",
  description: "Get exact CSV format specification for departure schedules",
  inputSchema: { type: "object", properties: {} }
}
```

**Tests (Claude Code - stdio):**
- [ ] `npm run build` succeeds
- [ ] `npm start` launches MCP server without errors
- [ ] In Claude Code, add server to config and call `get_duracube_principles` - returns 28 principles
- [ ] Call `get_learned_corrections` with category="security" - returns only security learnings
- [ ] Call `get_output_format` - returns CSV specification with examples
- [ ] All tool responses are valid JSON under 100KB

**Tests (claude.ai - HTTP):**
- [ ] N/A for this stage (stdio only)

**Success Criteria:**
- All 3 tools registered and callable via Claude Code
- `get_duracube_principles` returns ~8,000 tokens of structured data
- `get_learned_corrections` filters correctly by category
- `get_output_format` includes example rows that match exact specification

---

### Stage 3: HTTP Transport for Railway Deployment
**Goal:** Add HTTP transport layer for cloud deployment
**Estimated effort:** Simple (1-2 hours)

**Tasks:**
- [ ] Add Express server for HTTP transport
- [ ] Create `/mcp` POST endpoint for tool calls
- [ ] Add `/health` GET endpoint for Railway health checks
- [ ] Add CORS headers for claude.ai access
- [ ] Create `railway.json` configuration
- [ ] Add environment variable support (PORT)
- [ ] Update `package.json` with start script for production

**Tests (Claude Code - stdio):**
- [ ] Stdio transport still works after changes
- [ ] `npm run dev` starts local HTTP server on port 3000
- [ ] `curl http://localhost:3000/health` returns 200 OK

**Tests (claude.ai - HTTP):**
- [ ] Local HTTP server responds to MCP protocol requests
- [ ] Can call tools via HTTP using test client

**Success Criteria:**
- Server runs in both stdio (local) and HTTP (cloud) modes
- Health endpoint returns status
- CORS configured for claude.ai domains

---

### Stage 4: Railway Deployment
**Goal:** Deploy to Railway and connect from claude.ai
**Estimated effort:** Simple (1 hour)

**Tasks:**
- [ ] Create Railway project
- [ ] Connect GitHub repository (or deploy via CLI)
- [ ] Configure environment variables (PORT)
- [ ] Deploy and verify health endpoint
- [ ] Get public URL from Railway
- [ ] Document connection instructions for claude.ai

**Tests (Claude Code - stdio):**
- [ ] N/A (testing cloud deployment)

**Tests (claude.ai - HTTP):**
- [ ] Railway health endpoint accessible: `https://[your-app].railway.app/health`
- [ ] Configure MCP in claude.ai settings with Railway URL
- [ ] In claude.ai, type "Call get_duracube_principles" - tool executes
- [ ] In claude.ai, type "Call get_output_format" - returns CSV spec

**Success Criteria:**
- MCP server running on Railway
- All 3 tools callable from claude.ai
- Response times under 2 seconds

---

### Stage 5: End-to-End Contract Review Test
**Goal:** Validate full workflow with a real contract
**Estimated effort:** Simple (1 hour)

**Tasks:**
- [ ] Prepare test contract PDF (anonymized if needed)
- [ ] Document the expected analysis results for comparison
- [ ] Test full workflow in claude.ai
- [ ] Verify CSV output format is correct
- [ ] Verify critical non-negotiables are flagged correctly
- [ ] Test follow-up questions work

**Tests (Claude Code - stdio):**
- [ ] N/A (testing in claude.ai)

**Tests (claude.ai - HTTP):**
- [ ] Upload test contract PDF to claude.ai
- [ ] Prompt: "Review this contract against DuraCube's 28 commercial principles"
- [ ] Claude calls `get_duracube_principles` automatically
- [ ] Claude calls `get_learned_corrections` during analysis
- [ ] Claude calls `get_output_format` before generating CSV
- [ ] Output is valid 7-column CSV with correct row 1 format
- [ ] All 28 principles appear in output (1-28 in order)
- [ ] PI Insurance requirement (if present) marked NON-COMPLIANT
- [ ] Ask follow-up: "Explain the liability clause issue" - gets detailed response

**Success Criteria:**
- Full contract analysis completes in <5 minutes
- CSV output is correctly formatted (copy-paste into Excel works)
- Critical edge cases (from learnings) handled correctly
- User can have natural conversation about the analysis

---

## File Structure

```
duracube-contract-mcp/
├── package.json
├── tsconfig.json
├── railway.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts                    # Main entry - stdio + HTTP
│   ├── server.ts                   # Express HTTP server
│   ├── tools/
│   │   └── knowledge-tools.ts      # 3 tool registrations
│   ├── knowledge/
│   │   ├── principles.json         # 28 principles
│   │   ├── learnings.json          # Error corrections
│   │   └── format.json             # CSV specification
│   └── schemas/
│       └── tool-schemas.ts         # Zod validation schemas
└── tests/
    └── tools.test.ts               # Basic tool tests
```

---

## Dependencies

**Before Starting:**
- [ ] Node.js 18+ installed
- [ ] Railway account created (free tier OK for testing)
- [ ] Claude.ai Pro subscription (required for MCP)
- [ ] Source files available:
  - `0_Duracube_Standard_Commercial_FINAL.md`
  - `0_IMPROVEMENT.md`
  - Test contract PDF

**NPM Packages:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Principles JSON too large (>100KB) | Split into categories, lazy-load on demand |
| Claude doesn't call tools automatically | Add explicit prompt: "Use the DuraCube contract review tools" |
| Railway deployment issues | Test locally first with HTTP transport |
| Token limits hit with large contracts | Principles (~8K) + learnings (~2.5K) + format (~1K) = ~11.5K, well under limit |
| CSV format inconsistencies | Include 5+ example rows in format.json for Claude to match exactly |
| Edge cases missed | learnings.json captures all known edge cases; iterate after testing |

---

## JSON Structure Examples

### principles.json (excerpt)

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
      "compliance_logic": {
        "compliant_if": "Contract liability cap <= 100% of contract value",
        "non_compliant_if": "Contract liability cap > 100% OR unlimited",
        "no_term_risk": "HIGH - creates existential exposure"
      },
      "negotiation_positions": {
        "preferred": "100% cap on all liability",
        "fallback": "Higher cap with specific carve-outs for gross negligence only",
        "deal_breaker": "Unlimited liability exposure"
      },
      "departure_template": "Replace: '[current term]' with 'Liability limited to 100% of Contract Value'"
    }
  ],
  "categorization": {
    "non_negotiable": {
      "description": "DuraCube's firm positions - cannot be compromised",
      "principle_ids": [3, 13, 14, 15, 16, 19, 24, 25, 28],
      "principles": [
        "Head Contract Provision",
        "Dispute Resolution",
        "Payment and Cash Neutrality",
        "Security & Parent Company Guarantees",
        "Release of Security",
        "Proportionate Liability Act",
        "Set Off",
        "Insurances",
        "Design Liability"
      ]
    },
    "negotiable": {
      "description": "Flexible terms - can be discussed during negotiation",
      "principle_ids": [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27],
      "principles": [
        "Limitation of Liability",
        "Consequential Damages",
        "Liquidated Damages",
        "Extension of Time",
        "Force Majeure",
        "Variations: Accelerations, Omissions",
        "Time Bars/Notification Period",
        "Assessment Period",
        "Service for Notices",
        "Termination",
        "Termination for Convenience",
        "Defects Liability Period",
        "Indemnities",
        "Risk & Title Transfer",
        "Unfixed Materials",
        "Intellectual Property",
        "Urgent Protection",
        "Protection of Works",
        "Time is of the Essence / Escalation"
      ]
    }
  },
  "critical_non_negotiables": {
    "professional_indemnity": "DuraCube does NOT provide PI insurance. Any requirement = NON-COMPLIANT",
    "unconditional_guarantees": "Only dated guarantees accepted",
    "parent_company_guarantees": "Not provided under any circumstances"
  },
  "methodology": {
    "three_step_validation": [
      "Step 1: Extract exact contract language",
      "Step 2: Compare against DuraCube standard",
      "Step 3: Classify: Compliant | Non-Compliant | No Term"
    ],
    "constitutional_logic": {
      "equal": "Contract terms = DuraCube standard -> COMPLIANT",
      "more_favorable": "Contract terms > DuraCube standard -> COMPLIANT",
      "less_favorable": "Contract terms < DuraCube standard -> NON-COMPLIANT",
      "absent": "No contract terms -> NO TERM (assess risk)"
    }
  }
}
```

### learnings.json (excerpt)

```json
{
  "learnings": [
    {
      "id": "SEC-001",
      "category": "security",
      "principle_id": 15,
      "issue": "Marked N/A security as Non-Compliant",
      "correction": "N/A or 0% security = COMPLIANT and FAVORABLE (better than DuraCube standard)",
      "rule": "No security required < DuraCube standard (5%) = COMPLIANT"
    },
    {
      "id": "INS-002",
      "category": "insurance",
      "principle_id": 25,
      "issue": "Marked absence of insurance requirements as 'No Term'",
      "correction": "No insurance requirements = COMPLIANT (favorable - no burden on DuraCube)",
      "rule": "Absence of burden terms = FAVORABLE, not 'No Term'"
    }
  ],
  "decision_tree": {
    "no_term_assessment": [
      "Term would PROTECT DuraCube (liability cap, EOT)? -> NO TERM, departure needed",
      "Term would BURDEN DuraCube (insurance, guarantees)? -> COMPLIANT (favorable), no departure"
    ]
  }
}
```

### format.json (excerpt)

```json
{
  "csv_structure": {
    "row_1": "[CustomerName]_[ProjectName]_$[ContractValue],,,,,,",
    "section_1_header": "SECTION 1 - NON-NEGOTIABLE,,,,,,",
    "section_2_header": "SECTION 2 - NEGOTIABLE,,,,,,",
    "column_headers": "No,Term,Status,Page,Clause,Departure,Comments",
    "total_columns": 7,
    "row_1_note": "Metadata header with 6 trailing commas for alignment",
    "two_section_format": true
  },
  "section_ordering": {
    "section_1_non_negotiable": [3, 13, 14, 15, 16, 19, 24, 25, 28],
    "section_2_negotiable": [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27]
  },
  "column_specifications": {
    "No": "Integer - principle number (not sequential, follows section order)",
    "Term": "Exact principle name from standards",
    "Status": "Only: 'Compliant', 'Non-Compliant', 'No Term'",
    "Page": "Format: 'Page X, Clause Y.Z' - NEVER page number alone",
    "Clause": "Exact contract text in quotes",
    "Departure": "Action verb + specific language, or blank if compliant",
    "Comments": "Always blank (for user input)"
  },
  "departure_action_verbs": ["Insert:", "Replace:", "Amend:", "Delete:"],
  "example_output": [
    "CustomerName_ProjectName_$500000,,,,,,",
    "",
    "SECTION 1 - NON-NEGOTIABLE,,,,,,",
    "No,Term,Status,Page,Clause,Departure,Comments",
    "3,Head Contract Provision,Non-Compliant,\"Page 2, Clause 3.1\",\"Back-to-back terms apply\",\"Delete: Entire back-to-back clause\",",
    "13,Dispute Resolution,Compliant,\"Page 8, Clause 12.1\",\"Senior representatives to negotiate\",,",
    "...",
    "",
    "SECTION 2 - NEGOTIABLE,,,,,,",
    "No,Term,Status,Page,Clause,Departure,Comments",
    "1,Limitation of Liability,Non-Compliant,\"Page 5, Clause 8.1\",\"Contractor's liability shall be unlimited\",\"Replace: 'unlimited' with 'limited to 100% of the Contract Value'\",",
    "2,Consequential Damages,Compliant,\"Page 6, Clause 9.2\",\"Neither party shall be liable for any consequential loss\",,",
    "..."
  ],
  "quality_checklist": [
    "Output has TWO SECTIONS with proper headers",
    "Section 1 contains exactly 9 Non-Negotiable principles (3, 13, 14, 15, 16, 19, 24, 25, 28)",
    "Section 2 contains exactly 19 Negotiable principles (1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 20, 21, 22, 23, 26, 27)",
    "Principles within each section are ordered by principle number",
    "Row 1 has metadata with 6 trailing commas",
    "Every row has exactly 7 columns",
    "All page references include clause numbers",
    "Actual contract text in Clause column (not summaries)",
    "Departures use specific action verbs",
    "Comments column always empty"
  ]
}
```

---

## Notes

### Design Decisions

1. **3 Tools vs 1 Giant Tool**: Splitting into 3 tools allows Claude to fetch only what it needs, reducing token overhead for follow-up questions.

2. **stdio + HTTP**: Support both transports. stdio for local Claude Code testing, HTTP for Railway/claude.ai deployment.

3. **Static JSON vs Database**: For Quick Win, static JSON files are sufficient. Database can be added in Stage 2 for feedback collection.

4. **No PDF Processing in MCP**: Claude.ai already reads PDFs. MCP only provides knowledge.

### Future Enhancements (Post Quick Win)

1. **Stage 2**: Add `record_feedback` tool to capture corrections
2. **Stage 3**: Add Nexsus integration for precedent search
3. **Stage 4**: Add server-side Excel generation

### Reference Documents

- Vision Document: `C:\Users\KasunJ\MCP\customer_contract_review\Vision.md`
- CLAUDE.md: `C:\Users\KasunJ\MCP\customer_contract_review\CLAUDE.md`
- Plan File: `C:\Users\KasunJ\.claude\plans\purring-foraging-swan.md`

---

*Plan Version: 1.0*
*Created: 2026-01-25*
*Status: Ready for Implementation*
