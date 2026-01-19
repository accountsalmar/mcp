# re_sync_1984 - Data Resync Plan

## Goal
Clean resync of accounting data (Q1 2025) with proper FK relationship tracking.

---

## Decisions

| Decision | Choice |
|----------|--------|
| **Approach** | Clean Wipe (delete & resync fresh) |
| **Models** | `account.move.line` (cascade handles the rest) |
| **Date Range** | 2025-01-01 to 2025-03-31 |

---

## Execution Steps

### Step 1: Check Current Status
```
system_status { "section": "all" }
```

### Step 2: Delete Collections
Delete `nexsus_data` and `nexsus_graph` collections.
Keep `nexsus` (schema) intact.

### Step 3: Sync (Single Command)
```json
{
  "command": "pipeline_account.move.line_1984",
  "date_from": "2025-01-01",
  "date_to": "2025-03-31",
  "skip_existing": false,
  "update_graph": true,
  "parallel_targets": 3
}
```

**Cascade auto-syncs ALL FK targets:**
- `move_id` → account.move
- `account_id` → account.account
- `partner_id` → res.partner
- `product_id` → product.product
- `company_id` → res.company
- `currency_id` → res.currency
- `journal_id` → account.journal
- `create_uid/write_uid` → res.users
- And their FK targets recursively...

### Step 4: Verify
```
system_status { "section": "pipeline" }
graph_traverse { "model_name": "account.move.line", "record_id": [any], "depth": 2 }
```

---

## Expected Outcome

| Collection | Content |
|------------|---------|
| `nexsus` | Schema (unchanged) |
| `nexsus_data` | account.move.line + all FK targets |
| `nexsus_graph` | Complete FK relationship map |

---

## Estimated Time: 25-45 min
