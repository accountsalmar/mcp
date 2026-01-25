# DuraCube Contract Review MCP Server

An MCP (Model Context Protocol) server that provides DuraCube's 28 commercial principles as knowledge tools for AI-powered contract review.

## Overview

This server delivers domain knowledge that Claude lacks - enabling accurate contract analysis against DuraCube's commercial standards. Claude handles PDF reading and reasoning; this MCP provides the business rules.

**User Flow:**
```
User uploads contract to claude.ai → Claude reads PDF → Claude calls MCP for principles/learnings → Claude applies knowledge → Returns departure schedule
```

## Available Tools

### 1. `get_duracube_principles`

Returns all 28 DuraCube commercial principles with:
- Standards and risk levels
- Search terms to find contract clauses
- Red flags indicating non-compliance
- Compliance logic for classification
- Negotiation positions

**Input:**
```json
{
  "include_examples": true  // Optional: include departure templates
}
```

### 2. `get_learned_corrections`

Returns documented learnings from past review errors:
- Critical edge cases
- Decision trees for complex assessments
- Category-specific rules

**Input:**
```json
{
  "category": "security"  // Options: all, security, insurance, dlp, design, methodology
}
```

### 3. `get_output_format`

Returns the exact CSV format specification:
- Column specifications
- Example rows
- Quality checklist

**Input:** None required

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Running the Server

### Local (stdio mode - for Claude Code)
```bash
npm run start:stdio
```

### HTTP mode (for Railway/cloud deployment)
```bash
npm start
# or
npm run start:http
```

## Configuration

### Claude Code (Local - stdio mode)

Add to your Claude Code MCP settings (`~/.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "duracube-contract": {
      "command": "node",
      "args": ["C:/Users/KasunJ/MCP/duracube-contract-mcp/build/index.js", "stdio"]
    }
  }
}
```

### Claude.ai (Cloud - HTTP mode via Railway)

1. Deploy to Railway (see Deployment section)
2. Configure in Claude.ai MCP settings with Railway URL

## HTTP Endpoints

When running in HTTP mode:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check for Railway |
| `/tools` | GET | List available tools |
| `/mcp` | POST | MCP JSON-RPC endpoint |
| `/tools/get_duracube_principles` | POST | Direct tool call |
| `/tools/get_learned_corrections` | POST | Direct tool call |
| `/tools/get_output_format` | GET | Direct tool call |

## Railway Deployment

1. Create a Railway project
2. Connect your GitHub repository
3. Set environment variable: `PORT` (Railway sets this automatically)
4. Deploy - the health endpoint at `/health` will be used for health checks

## Critical Non-Negotiables

The system enforces these absolute rules:

1. **Professional Indemnity Insurance**: DuraCube does NOT provide PI insurance. Any requirement = NON-COMPLIANT
2. **Unconditional Bank Guarantees**: Only dated guarantees accepted
3. **Parent Company Guarantees**: Not provided under any circumstances

## The 28 Commercial Principles

| # | Principle | Risk Level |
|---|-----------|------------|
| 1 | Limitation of Liability | HIGH |
| 2 | Consequential Damages | HIGH |
| 3 | Head Contract Provision | MEDIUM-HIGH |
| 4 | Liquidated Damages | HIGH |
| 5 | Extension of Time | HIGH |
| 6 | Force Majeure | MEDIUM-HIGH |
| 7 | Variations: Accelerations, Omissions | HIGH |
| 8 | Time Bars/Notification Period | HIGH |
| 9 | Assessment Period | MEDIUM |
| 10 | Service for Notices | LOW-MEDIUM |
| 11 | Termination | MEDIUM |
| 12 | Termination for Convenience | HIGH |
| 13 | Dispute Resolution | LOW-MEDIUM |
| 14 | Payment and Cash Neutrality | MEDIUM |
| 15 | Security & Parent Company Guarantees | HIGH |
| 16 | Release of Security | MEDIUM |
| 17 | Defects Liability Period | MEDIUM |
| 18 | Indemnities | MEDIUM-HIGH |
| 19 | Proportionate Liability Act | HIGH |
| 20 | Risk & Title Transfer | MEDIUM |
| 21 | Unfixed Materials | MEDIUM |
| 22 | Intellectual Property | HIGH |
| 23 | Urgent Protection | MEDIUM |
| 24 | Set Off | HIGH |
| 25 | Insurances | HIGH |
| 26 | Protection of Works | MEDIUM |
| 27 | Time is of the Essence / Escalation | MEDIUM |
| 28 | Design Liability | HIGH |

## Output Format

The departure schedule is a 7-column CSV:

```
CustomerName_ProjectName_$ContractValue,,,,,,
No,Term,Status,Page,Clause,Departure,Comments
1,Limitation of Liability,Non-Compliant,"Page 5, Clause 8.1","Unlimited liability","Replace: 'unlimited' with '100% of Contract Value'",
```

**Page Reference Rule:** ALWAYS include clause number - "Page 5, Clause 8.1", never just "Page 5"

## Development

```bash
# Build and run
npm run dev

# Build only
npm run build

# Run tests
npm test
```

## License

MIT
