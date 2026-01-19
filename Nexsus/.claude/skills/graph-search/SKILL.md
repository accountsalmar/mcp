---
name: graph-search
description: Intelligent search combining semantic similarity with knowledge graph context. Use when finding connected records, understanding relationships, or discovering data paths.
allowed-tools:
  - semantic_search
  - nexsus_search
  - graph_traverse
  - system_status
version: 1.0.0
---

# Graph-Enhanced Search Skill

Use this skill when working with interconnected Odoo data where relationships matter.

## When to Activate

This skill is relevant when the user:
- Asks about "related records" or "connections"
- Wants to "find everything linked to X"
- Needs relationship context for their query
- Asks multi-hop discovery questions
- Wants to find "important" or "central" entities
- Needs to understand data relationships before querying

## Strategy Selection

| Query Pattern | Tool + Parameters |
|--------------|-------------------|
| "Find records related to X" | `semantic_search` + `graph_boost=true` |
| "What's connected to partner Y" | `graph_traverse` with `direction=both` |
| "Total for X and related records" | `nexsus_search` + `show_relationships=true` |
| "Most important partners" | `semantic_search` + `graph_boost=true`, rank by connections |
| "How is A linked to B" | `graph_traverse` from A with `depth=2` |
| "Who references this account" | `graph_traverse` with `direction=incoming` |

## Workflow

### Step 1: Understand Intent
Determine if user is seeking:
- **Discovery**: Finding unknown records (use semantic_search + graph_boost)
- **Precision**: Getting exact data (use nexsus_search + show_relationships)
- **Navigation**: Following relationships (use graph_traverse)

### Step 2: Check Graph Status
Use `system_status` with `section=data` to verify:
- Graph points exist in the unified collection
- The target model has been synced with pipeline_sync

### Step 3: Choose Strategy
Map the query pattern to the appropriate tool and parameters.

### Step 4: Enable Graph Features
Always set graph enhancement parameters:
- For semantic_search: `graph_boost=true` when searching data points
- For nexsus_search: `show_relationships=true` for relationship context
- For graph_traverse: `direction=both` for complete picture

### Step 5: Interpret Connections
Explain what relationships mean in business terms:
- partner_id links show customer/vendor relationships
- move_id links connect journal entries
- account_id links show GL account usage
- Higher edge counts indicate more "important" entities

## Graph Boost Explained

When `graph_boost=true` is enabled on semantic_search:

**What happens:**
1. Normal vector similarity search runs first
2. For each result, connection count is calculated:
   - Outgoing FKs: How many `*_qdrant` fields have values
   - Incoming refs: How many records reference this one (from Knowledge Graph)
3. Boost factor applied: `boosted_score = score * (1 + boost)`
4. Results re-ranked by boosted score

**Boost calculation:**
- Max boost: 20% (0.2 multiplier)
- Based on: log(1 + connections) / log(1 + maxConnections)
- Well-connected records get higher scores

**Best for:**
- Finding "important" or "central" entities
- Prioritizing records with more business activity
- Discovering hub records (like main partners or accounts)

## show_relationships Explained

When `show_relationships=true` is enabled on nexsus_search:

**What happens:**
1. Query executes normally
2. Knowledge Graph is queried for the target model
3. Output includes a "Knowledge Graph Relationships" section showing:
   - Outgoing FK fields with edge counts
   - Incoming references from other models
   - Suggested explorations

**Best for:**
- Understanding model relationships before complex queries
- Planning GROUP BY aggregations
- Discovering related models to include in analysis

## Examples

### Example 1: Find Important Partners
**User:** "Find the most important partners in our system"

**Strategy:** Use semantic_search with graph_boost to prioritize well-connected partners.

```json
{
  "query": "partners customers vendors",
  "point_type": "data",
  "model_filter": "res.partner",
  "graph_boost": true,
  "limit": 20
}
```

**Interpretation:** Partners with more references (from invoices, sales orders, journal entries) will rank higher.

### Example 2: Understand Account Relationships
**User:** "Show me account 319 with its relationships"

**Strategy:** Use nexsus_search with show_relationships to understand context.

```json
{
  "model_name": "account.move.line",
  "filters": [{"field": "account_id_id", "op": "eq", "value": 319}],
  "aggregations": [{"field": "balance", "op": "sum", "alias": "total"}],
  "show_relationships": true
}
```

**Interpretation:** Output will show which models reference account.move.line and suggest grouping options.

### Example 3: Navigate from Partner
**User:** "What's connected to Hansen Yuncken (partner 286798)?"

**Strategy:** Use graph_traverse with direction=both for complete picture.

```json
{
  "model_name": "res.partner",
  "record_id": 286798,
  "direction": "both",
  "depth": 1,
  "incoming_limit": 50
}
```

**Interpretation:** Shows both the records this partner links to (FKs) and all records that reference this partner.

## Tips

1. **Start with graph_boost for discovery** - When unsure which records matter, graph boost helps surface important ones.

2. **Use show_relationships for planning** - Before complex nexsus_search queries, check relationships to understand the data structure.

3. **Check graph status first** - If no graph points exist, suggest running pipeline_sync to populate the Knowledge Graph.

4. **Explain connection meaning** - A partner with 500 incoming references is likely a major customer; explain this context.

5. **Combine tools progressively** - Start with semantic_search for discovery, then graph_traverse for navigation, then nexsus_search for precision.
