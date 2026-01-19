# Nexsus CLI Guide for Beginners

This document explains how to use the Nexsus CLI (Command Line Interface) for data synchronization operations.

---

## What is a CLI?

A CLI (Command Line Interface) is like a text-based remote control for your application. Instead of clicking buttons, you type commands. Think of it like typing DAX formulas - you write text instructions and the system executes them.

---

## How the Nexsus CLI is Structured

```
src/sync/
├── index.ts              ← Main entry point (like a table of contents)
└── commands/
    ├── sync-model.ts     ← Syncs data from Odoo to vector database
    ├── sync-schema.ts    ← Syncs schema definitions from Excel
    ├── cleanup.ts        ← Removes deleted records
    ├── validate-fk.ts    ← Validates foreign key relationships
    └── status.ts         ← Shows system status
```

---

## How to Run Commands

There are two ways to run the CLI:

```bash
# Using npm script (after building)
npm run sync -- <command>

# Using the binary directly
npx nexsus-sync <command>
```

**Important:** The `--` after `npm run sync` tells npm to pass the remaining arguments to the script. Without it, npm might try to interpret your options itself.

---

## The 5 Available Commands

| Command | What It Does | Example |
|---------|--------------|---------|
| `sync model <name>` | Pulls data from Odoo and stores it in the vector database | `npm run sync -- sync model crm.lead` |
| `sync schema` | Loads field definitions from Excel into the database | `npm run sync -- sync schema` |
| `cleanup <name>` | Removes records that were deleted in Odoo | `npm run sync -- cleanup res.partner` |
| `validate-fk` | Checks that all foreign key links are valid | `npm run sync -- validate-fk` |
| `status` | Shows how many records are stored, system health | `npm run sync -- status` |

---

## Command Options (Parameters)

### sync model `<model_name>`

Syncs a specific Odoo model to the vector database.

| Option | What It Does | Default | Example |
|--------|--------------|---------|---------|
| `--date-from <date>` | Only sync records from this date | None (all dates) | `--date-from 2024-01-01` |
| `--date-to <date>` | Only sync records up to this date | None (all dates) | `--date-to 2024-12-31` |
| `--dry-run` | Preview what would happen (no changes made) | Off | `--dry-run` |
| `--no-cascade` | Don't automatically sync related records | Cascade ON | `--no-cascade` |
| `--skip-existing` | Skip records already in Qdrant | On | `--skip-existing` |
| `--no-skip-existing` | Re-sync all records even if already synced | Off | `--no-skip-existing` |
| `--batch-size <size>` | How many records to process at once | 500 | `--batch-size 1000` |

### sync schema

Syncs schema definitions from Excel to the vector database.

| Option | What It Does | Default | Example |
|--------|--------------|---------|---------|
| `--source <source>` | Where to load schema from (excel or odoo) | excel | `--source excel` |
| `--force` | Delete existing schema and recreate | Off | `--force` |

### cleanup `<model_name>`

Removes records from vector database that were deleted in Odoo.

| Option | What It Does | Default | Example |
|--------|--------------|---------|---------|
| `--dry-run` | Preview what would be deleted | Off | `--dry-run` |

### validate-fk

Validates foreign key integrity across all models.

| Option | What It Does | Default | Example |
|--------|--------------|---------|---------|
| `--model <name>` | Validate only a specific model | All models | `--model crm.lead` |
| `--fix` | Attempt to sync missing FK targets | Off | `--fix` |
| `--limit <count>` | Limit orphan details shown per model | 100 | `--limit 50` |

### status

Shows system status including collection counts and health.

| Option | What It Does | Default | Example |
|--------|--------------|---------|---------|
| `--section <section>` | Which section to show (all, data, pipeline, health) | all | `--section data` |

---

## Common Usage Examples

### 1. Check System Status
```bash
npm run sync -- status
```
Shows: total vectors, records by model, health checks.

### 2. Sync Schema (Do This First!)
```bash
npm run sync -- sync schema
```
Loads field definitions from `feilds_to_add_payload.xlsx` into the vector database.

### 3. Sync CRM Leads
```bash
npm run sync -- sync model crm.lead
```
Syncs all CRM leads and their related records (partners, stages, users, etc.).

### 4. Sync Financial Data for a Specific Year
```bash
npm run sync -- sync model account.move.line --date-from 2024-01-01 --date-to 2024-12-31
```
Syncs only journal entries from 2024.

### 5. Preview Without Making Changes
```bash
npm run sync -- sync model res.partner --dry-run
```
Shows what would be synced without actually doing it.

### 6. Force Re-sync All Records
```bash
npm run sync -- sync model crm.lead --no-skip-existing
```
Re-syncs all records even if they already exist in the database.

### 7. Sync Without Related Records
```bash
npm run sync -- sync model account.move --no-cascade
```
Syncs only the specified model, not related records.

### 8. Clean Up Deleted Records
```bash
npm run sync -- cleanup res.partner --dry-run
```
Preview which partner records would be removed (deleted in Odoo).

### 9. Validate Foreign Keys
```bash
npm run sync -- validate-fk --model crm.lead
```
Check if all FK links for CRM leads are valid.

---

## Why CLI Instead of MCP Tools?

The MCP server tools need to respond quickly (under 10 seconds) because Claude is waiting. But syncing data can take **hours** for large models.

**Example Sync Times:**
- `account.move` with 134,949 records = **2.76 hours**
- `crm.lead` with 5,000 records = **~10 minutes**

The CLI provides:
- Progress bars and colored output
- Can run for hours without timing out
- Real-time feedback on what's happening

---

## Key Libraries Used

| Library | Purpose |
|---------|---------|
| `commander` | Parses command-line arguments (the options above) |
| `ora` | Shows spinning progress indicators |
| `chalk` | Adds colors to terminal output (green = success, red = error) |

---

## Troubleshooting

### "Model not found in schema"
Run `npm run sync -- sync schema` first before syncing any model.

### "Failed to initialize embedding service"
Check that `VOYAGE_API_KEY` is set in your `.env` file.

### "Failed to initialize vector client"
Check that `QDRANT_HOST` and `QDRANT_API_KEY` are set correctly.

### Command runs but nothing happens
Make sure you include `--` after `npm run sync`:
```bash
# Correct
npm run sync -- sync model crm.lead

# Wrong (options won't be passed)
npm run sync sync model crm.lead
```

---

## Quick Reference Card

```bash
# Status
npm run sync -- status

# Schema (run first!)
npm run sync -- sync schema
npm run sync -- sync schema --force

# Sync Models
npm run sync -- sync model <model_name>
npm run sync -- sync model <model_name> --date-from YYYY-MM-DD
npm run sync -- sync model <model_name> --dry-run
npm run sync -- sync model <model_name> --no-cascade

# Cleanup
npm run sync -- cleanup <model_name>
npm run sync -- cleanup <model_name> --dry-run

# Validate
npm run sync -- validate-fk
npm run sync -- validate-fk --model <model_name> --fix
```

---

*Document created: 2024-12-29*
*For: Nexsus Vector Database MCP Server*
