# Pipeline Section

## Purpose
The Pipeline section handles all **data extraction, transformation, and loading (ETL)** operations. This includes syncing data from Odoo to Qdrant, embedding generation, and knowledge graph updates.

## Boundary Rules

### This Section CAN:
- Import from `src/common/` (shared infrastructure)
- Import from `src/knowledge/` (domain rules for validation)
- Make external API calls (Odoo, Voyage AI)
- Write to Qdrant (upsert, delete operations)
- Run long-running batch operations

### This Section CANNOT:
- Be imported by `src/semantic/` (query section)
- Be imported by `src/exact/` (query section)
- Be imported by `src/console/index.ts` (MCP server entry point)

### Other Sections CANNOT:
- Import Pipeline services directly
- Call sync/ETL functions
- Trigger embedding generation

## Key Services

| Service | Purpose |
|---------|---------|
| `embedding-service.ts` | Voyage AI embeddings (voyage-3.5-lite) |
| `odoo-client.ts` | Odoo JSON-RPC API client |
| `pipeline-data-sync.ts` | Main data sync orchestration |
| `cascade-sync.ts` | FK cascade discovery and sync |
| `knowledge-graph-writer.ts` | Graph edge creation/updates |
| `dlq.ts` | Dead Letter Queue for failed records |

## CLI Commands

Located in `src/pipeline/cli/commands/`:

| Command | Description |
|---------|-------------|
| `sync model <name>` | Sync Odoo model with FK cascade |
| `sync schema` | Sync schema from Odoo or Excel |
| `cleanup <name>` | Remove deleted records |
| `validate-fk` | Validate FK integrity |

## File Ownership

```
src/pipeline/
├── services/
│   ├── embedding-service.ts      # Voyage AI integration
│   ├── odoo-client.ts            # Odoo API client
│   ├── odoo-schema-sync.ts       # Direct Odoo→Qdrant schema sync
│   ├── odoo-schema-fetcher.ts    # Fetch schema from ir.model.fields
│   ├── pipeline-data-sync.ts     # Data sync orchestration
│   ├── pipeline-data-transformer.ts # Record transformation
│   ├── cascade-sync.ts           # FK cascade sync
│   ├── fk-dependency-discovery.ts # FK target discovery
│   ├── unified-schema-sync.ts    # Schema to Qdrant
│   ├── data-transformer.ts       # Type conversions
│   ├── dlq.ts                    # Dead Letter Queue
│   ├── sync-metadata.ts          # Sync state persistence
│   └── knowledge-graph-writer.ts # Graph write operations
├── cli/
│   ├── index.ts                  # CLI entry point (Commander.js)
│   └── commands/
│       ├── sync-model.ts
│       ├── sync-schema.ts
│       ├── cleanup.ts
│       ├── validate-fk.ts
│       └── ...
├── index.ts                      # Public exports
└── CLAUDE.md                     # This file
```

## Data Flow

```
Odoo API
    ↓
odoo-client.ts (JSON-RPC)
    ↓
pipeline-data-sync.ts (orchestration)
    ↓
pipeline-data-transformer.ts (field mapping)
    ↓
embedding-service.ts (Voyage AI)
    ↓
vector-client.ts (Qdrant upsert) ← from src/common/
    ↓
knowledge-graph-writer.ts (FK edges)
```

## Important Notes

1. **Long-running operations**: Sync can take hours for large models. Always use CLI with progress bars.

2. **API rate limits**: Odoo and Voyage AI have rate limits. The services handle backoff automatically.

3. **DLQ handling**: Failed records go to Dead Letter Queue. Use `dlq_status` and `dlq_clear` MCP tools to manage.

4. **FK cascade**: When syncing a model, FK targets are discovered and synced automatically (up to 100 per FK field).
