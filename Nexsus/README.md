# Nexsus

**Self-Describing Vector Database MCP Server for Odoo ERP**

Nexsus enables Claude to semantically discover field meanings, navigate FK relationships, and query Odoo data through a unified vector collection with an embedded knowledge graph.

## Features

- **Semantic Search**: Natural language queries like "hospital projects in Victoria"
- **Precise Queries**: Filter, aggregate, and retrieve exact data matching Odoo
- **Graph Traversal**: Navigate FK relationships to explore connected records
- **Nexsus Link**: Enrich query results with related record names automatically

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run MCP server
npm start

# Run sync CLI
npm run sync -- <command>
```

## Architecture

Single unified Qdrant collection (`nexsus_unified`) with V2 UUID format:

| Point Type | UUID Prefix | Example |
|------------|-------------|---------|
| Graph | `00000001-*` | `00000001-0312-0078-0031-000000005012` |
| Data | `00000002-*` | `00000002-0078-0000-0000-000000286798` |
| Schema | `00000003-*` | `00000003-0004-0000-0000-000000005012` |

## MCP Tools (11)

| Tool | Purpose |
|------|---------|
| `semantic_search` | Natural language search across schema/data |
| `nexsus_search` | Precise queries with filtering and aggregation |
| `find_similar` | Find similar records within the same model |
| `graph_traverse` | Navigate FK relationships in knowledge graph |
| `inspect_record` | Debug/inspect exact record stored in Qdrant |
| `pipeline_preview` | Preview transformation for a model |
| `system_status` | Unified status (data, pipeline, health, metrics) |
| `dlq_status` | Check Dead Letter Queue status |
| `dlq_clear` | Clear failed records from DLQ |
| `update_model_payload` | Update payload without re-embedding |
| `build_odoo_url` | Generate Odoo web URLs for navigation |

## CLI Commands

```bash
npm run sync -- sync model <model_name>   # Sync with FK cascade
npm run sync -- sync schema               # Sync schema from Excel
npm run sync -- cleanup <model_name>      # Remove deleted records
npm run sync -- validate-fk               # Validate FK integrity
npm run sync -- status                    # Show system status
```

## Configuration Files

| File | Purpose |
|------|---------|
| `nexsus_schema_v2_generated.xlsx` | Schema definitions (V2 format) |
| `feilds_to_add_payload.xlsx` | Field payload configuration |
| `data/pipeline_sync_metadata.json` | Sync state tracking |

## Environment Variables

```bash
# Odoo Connection
ODOO_URL=https://your-odoo.com
ODOO_DB=your_database
ODOO_USERNAME=your_username
ODOO_PASSWORD=your_api_key

# Qdrant Vector Database
QDRANT_HOST=http://localhost:6333
QDRANT_API_KEY=

# Voyage AI Embeddings
VOYAGE_API_KEY=your_api_key
EMBEDDING_MODEL=voyage-3.5-lite
```

## Utility Scripts

| Script | Purpose |
|--------|---------|
| `scripts/add-missing-indexes.ts` | Add Qdrant payload indexes without re-syncing |

Run with: `npx tsx scripts/add-missing-indexes.ts`

## Deployment

Deployed on **Railway** with auto-deploy from main branch.

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and usage documentation.

## License

Private - All rights reserved
