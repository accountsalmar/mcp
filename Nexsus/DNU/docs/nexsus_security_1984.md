# Knowledge Graph Security Architecture: Deep Research & Evaluation

> **Document ID:** nexsus_security_1984
> **Created:** 2025-12-27
> **Purpose:** Future reference for KG-based security implementation in Nexsus

## Executive Summary

This document presents a deep research analysis of using the **existing Knowledge Graph (KG)** as the security layer for Nexsus, rather than building a separate security system. Two approaches are critically evaluated with implementation details.

---

## Research Findings Summary

### Current State Analysis

| Component | Current Implementation | Security Gap |
|-----------|----------------------|--------------|
| **Graph Points** | 24 points with relationship metadata | No `allowed_groups`, `allowed_companies` fields |
| **Data Points** | 617K+ with FK references | No security filtering on queries |
| **Search Flow** | Central routing via `searchByPointType()` | No user context injection |
| **Odoo Security** | ir.model.access, ir.rule, res.groups | NOT synced to Nexsus |
| **Cache** | LRU cache with query key | Cache key doesn't include user |

### Key Integration Points Identified

| File | Line | Function | Security Injection Point |
|------|------|----------|--------------------------|
| `filter-builder.ts` | 163 | `buildQdrantFilter()` | ALL exact queries |
| `vector-client.ts` | 868 | `searchByPointType()` | ALL semantic searches |
| `vector-client.ts` | 1155 | `retrievePointById()` | Single record access |
| `vector-client.ts` | 1209 | `batchRetrievePoints()` | FK traversal |
| `cache-service.ts` | 48 | `generateCacheKey()` | Must include user |

### Qdrant Filter Capabilities Confirmed

- Can filter on array fields (`allowed_groups: [7, 8]`)
- `match.any` supports OR logic across array elements
- Keyword indexes support fast filtering
- Current UNIFIED_INDEXES can be extended

---

## APPROACH A: Graph-Point Security (Relationship-Level)

### Concept

Add security metadata **only to graph points**. Use graph traversal to determine accessible models, then filter data queries.

```
FLOW: User Query -> KG Security Check -> Model Whitelist -> Data Search

Step 1: Query all graph points where user's groups intersect allowed_groups
Step 2: Extract unique (source_model, target_model) pairs = accessible models
Step 3: Add model filter to semantic/exact search
Step 4: Return only data from accessible models
```

### Schema Changes

**Graph Point Payload Extension (3 new fields):**
```typescript
// unified-graph-sync.ts - buildUnifiedGraphPayload()
{
  // Existing fields (unchanged)
  point_type: 'graph',
  source_model: string,
  target_model: string,
  field_name: string,
  field_type: string,
  edge_count: number,

  // NEW: Security fields
  allowed_groups: number[],      // Odoo group IDs [7, 8, 12]
  allowed_companies: number[],   // Company IDs [1, 2]
  access_level: 'full' | 'read_only' | 'aggregate_only'
}
```

**New Indexes Required:**
```typescript
// constants.ts - UNIFIED_INDEXES
{ field: 'allowed_groups', type: 'integer' },
{ field: 'allowed_companies', type: 'integer' },
{ field: 'access_level', type: 'keyword' },
```

### Critical Evaluation

| Criteria | Rating | Analysis |
|----------|--------|----------|
| **Simplicity** | 4/5 | Only 3 new fields on graph points |
| **Performance** | 3/5 | Extra KG query per search (can cache) |
| **Granularity** | 2/5 | Model-level only, no row-level security |
| **Odoo Compatibility** | 3/5 | Maps to ir.model.access (model ACL) |
| **Maintenance** | 4/5 | Security defined with relationships |
| **Audit Trail** | 2/5 | Can log KG queries, not data access |

### Pros
1. Minimal schema changes (3 fields on ~50 graph points)
2. Leverages existing KG infrastructure
3. Security visible in graph structure
4. Fast to implement
5. Natural fit - "who can traverse this relationship?"

### Cons
1. **No row-level security** - can't restrict "only your leads"
2. **No field-level security** - can't hide salary fields
3. Extra latency: 1 KG query + 1 data query per search
4. Coarse-grained: all-or-nothing model access
5. Doesn't replicate Odoo's ir.rule (record rules)

---

## APPROACH B: Data-Point Security (Record-Level)

### Concept

Add security metadata **to every data point**. Filter at query time based on user's groups/company matching record's allowed access.

```
FLOW: User Query -> Direct Data Query with Security Filter

Every data point has: allowed_groups, allowed_companies, owner_id
Query filter includes: user's groups/company must match record's allowed list
```

### Schema Changes

**Data Point Payload Extension (4 new fields):**
```typescript
// unified-data-sync.ts - buildUnifiedDataPayload()
{
  // Existing fields (unchanged)
  point_type: 'data',
  record_id: number,
  model_name: string,
  model_id: number,

  // NEW: Security fields on EVERY record
  allowed_groups: number[],      // Groups that can see this record
  allowed_companies: number[],   // Companies that can see this record
  owner_id: number,              // User who owns this record
  security_domain: string        // Serialized ir.rule domain (optional)
}
```

### Critical Evaluation

| Criteria | Rating | Analysis |
|----------|--------|----------|
| **Simplicity** | 2/5 | 4 fields on 617K+ data points |
| **Performance** | 4/5 | Single query with filter (no extra KG query) |
| **Granularity** | 4/5 | Row-level + ownership + company |
| **Odoo Compatibility** | 4/5 | Maps to ir.model.access + ir.rule |
| **Maintenance** | 2/5 | Security on every record, re-sync needed for changes |
| **Audit Trail** | 4/5 | Every query has security filter logged |

### Pros
1. **Row-level security** - "only your leads" supported
2. **Ownership filtering** - user_id = current_user
3. **Company isolation** - multi-company support
4. Single query (no KG pre-query)
5. Security travels with data (export-safe)

### Cons
1. **Storage overhead** - 4 extra fields x 617K records
2. **Sync complexity** - must compute security for every record
3. **Re-sync required** - if ACLs change, must re-sync data
4. Schema changes to data points (more disruptive)
5. Slower sync (must fetch ACL + compute per record)

---

## APPROACH C: Hybrid (Recommended for Full Implementation)

### Concept

**Combine both approaches** for layered security:
1. **KG (Model-Level)**: Coarse filter - which models can user access?
2. **Data (Row-Level)**: Fine filter - which records within those models?

```
FLOW: Query -> KG Model Check -> Data Query with Row Filter

Layer 1: KG determines accessible MODELS (fast, cached)
Layer 2: Data filter determines accessible RECORDS (per-query)
```

### Why Hybrid?

| Security Need | KG Handles | Data Handles |
|---------------|------------|--------------|
| "Can user see CRM leads?" | Model ACL | - |
| "Can user see GL entries?" | Model ACL | - |
| "Only user's own leads" | - | owner_id filter |
| "Only user's company data" | - | company filter |
| "Salespeople can't see HR" | Model ACL | - |
| "Finance sees all invoices" | Model ACL | No owner filter |

---

## Critical Comparison Matrix

| Criteria | Approach A (KG Only) | Approach B (Data Only) | Approach C (Hybrid) |
|----------|---------------------|------------------------|---------------------|
| **Schema Changes** | 3 fields on ~50 graph points | 4 fields on 617K+ data points | 3 fields graph + 2 fields data |
| **Query Latency** | +1 KG query (~50ms) | Same as today | +1 cached KG query (~5ms) |
| **Security Granularity** | Model-level only | Row + Owner + Company | Model + Row + Owner + Company |
| **Sync Impact** | Minimal | Major (re-sync all data) | Moderate |
| **Storage Overhead** | ~500 bytes | ~2.5MB (4 fields x 617K) | ~1.3MB |
| **Odoo ir.rule Support** | No | Partial | Yes (via owner filter) |
| **Cache Effectiveness** | High (model list stable) | N/A | High |
| **Implementation Effort** | 2-3 days | 5-7 days | 4-5 days |

---

## Risk Analysis

### Approach A Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users need row-level security later | High | High | Plan for Hybrid from start |
| KG query adds latency | Medium | Low | Cache accessible models (5 min TTL) |
| Graph points not synced properly | Low | Medium | Validate during sync |

### Approach B Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Full re-sync needed for ACL changes | High | High | Background re-sync job |
| Sync performance degradation | Medium | Medium | Batch ACL lookups, cache |
| Storage growth | Low | Low | Qdrant handles well |

### Approach C Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Complexity of two layers | Medium | Medium | Clear separation of concerns |
| Cache invalidation issues | Low | Medium | TTL-based cache with manual clear |
| Inconsistent security state | Low | High | Transaction-like sync |

---

## Selected Approach: Graph-Only POC (Approach A)

**Decision:** Start with Approach A as a Proof of Concept
**Purpose:** Validate KG-based security concept before full implementation

### POC Scope (Minimal Viable Security)

| Component | POC Scope | Full Implementation |
|-----------|-----------|---------------------|
| **Models** | crm.lead, res.partner only | All synced models |
| **Security Source** | Hardcoded groups | Odoo ir.model.access |
| **User Context** | Mock user object | MCP authentication |
| **Caching** | None | 5-minute TTL cache |
| **Testing** | Manual script | Automated test suite |

### POC Files to Create/Modify

| File | Action | POC Changes |
|------|--------|-------------|
| `src/types.ts` | MODIFY | Add `SecurityContext`, `SecureGraphPayload` interfaces |
| `src/services/unified-graph-sync.ts` | MODIFY | Add `allowed_groups` field to graph payload |
| `src/services/security-context.ts` | **CREATE** | Simple `getAccessibleModels()` function |
| `src/tools/search-tool.ts` | MODIFY | Pass mock security context |
| `src/services/vector-client.ts` | MODIFY | Add model filter based on security |
| `scripts/test-kg-security-poc.ts` | **CREATE** | POC validation script |

### POC Implementation Code

#### Step 1: Security Context Types (src/types.ts)
```typescript
export interface SecurityContext {
  userId: number;
  userGroups: number[];
  companyId: number;
  accessibleModels?: string[];
}

export interface SecureGraphPayload extends UnifiedGraphPayload {
  allowed_groups: number[];
}
```

#### Step 2: Security Context Service (src/services/security-context.ts)
```typescript
import { qdrantClient } from './vector-client';
import { SecurityContext } from '../types';
import { UNIFIED_CONFIG } from '../constants';

export async function getAccessibleModels(userGroups: number[]): Promise<string[]> {
  const collectionName = UNIFIED_CONFIG.COLLECTION_NAME;

  const result = await qdrantClient.scroll(collectionName, {
    filter: {
      must: [
        { key: 'point_type', match: { value: 'graph' } },
        { key: 'allowed_groups', match: { any: userGroups } }
      ]
    },
    limit: 1000,
    with_payload: true
  });

  const models = new Set<string>();
  for (const point of result.points) {
    const payload = point.payload as Record<string, unknown>;
    if (payload.source_model) models.add(payload.source_model as string);
    if (payload.target_model) models.add(payload.target_model as string);
  }

  return Array.from(models);
}

export function buildMockSecurityContext(): SecurityContext {
  return {
    userId: 42,
    userGroups: [7, 8],  // Sales User, Sales Manager
    companyId: 1
  };
}

export async function canAccessModel(modelName: string, userGroups: number[]): Promise<boolean> {
  const accessibleModels = await getAccessibleModels(userGroups);
  return accessibleModels.includes(modelName);
}
```

#### Step 3: POC Test Script (scripts/test-kg-security-poc.ts)
```typescript
import { getAccessibleModels, canAccessModel } from '../src/services/security-context';

async function testKGSecurityPOC() {
  console.log('=== KG Security POC Test ===\n');

  // Test 1: Sales user (groups [7, 8])
  console.log('Test 1: Sales User (groups [7, 8])');
  const salesModels = await getAccessibleModels([7, 8]);
  console.log('  Accessible models:', salesModels);
  console.log('  Can access crm.lead:', await canAccessModel('crm.lead', [7, 8]));
  console.log('  Can access account.move.line:', await canAccessModel('account.move.line', [7, 8]));

  // Test 2: Finance user (groups [15, 16])
  console.log('\nTest 2: Finance User (groups [15, 16])');
  const financeModels = await getAccessibleModels([15, 16]);
  console.log('  Accessible models:', financeModels);

  console.log('\n=== POC Test Complete ===');
}

testKGSecurityPOC().catch(console.error);
```

### POC Success Criteria

| Test | Expected Result | Validates |
|------|-----------------|-----------|
| Sales user queries KG | Returns crm.lead, res.partner relationships | KG filter works |
| Sales user searches "invoices" | Returns 0 results (no access to account.move) | Model-level security |
| Finance user searches "invoices" | Returns invoice data | Correct access |
| Admin user queries KG | Returns all relationships | Superuser access |
| Graph point has allowed_groups | Field visible in payload | Schema change works |

### POC Timeline

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Steps 1-2: Types + Security Context | `security-context.ts` working |
| 2 | Steps 3-4: Search integration + Test | POC test passing |
| 3 | Step 5: Graph point updates | Security data in KG |

---

## After POC: Next Steps

If POC validates the concept:

1. **Phase 2: Odoo Integration** - Fetch real ir.model.access instead of hardcoded
2. **Phase 3: User Authentication** - Replace mock user with MCP auth
3. **Phase 4: Caching** - Add 5-minute TTL cache for accessible models
4. **Phase 5: Row-Level** - Optionally add Hybrid approach for ownership

---

## Appendix: Odoo Security Tables Reference

### ir.model.access (Model ACL)
```sql
id | name | model_id | group_id | perm_read | perm_write | perm_create | perm_unlink
```

### ir.rule (Record Rules / RLS)
```sql
id | name | model_id | domain_force | groups | perm_read | perm_write | global
```

### res.groups (Security Groups)
```sql
id | name | category_id | implied_ids | users
```

Query to get model ACLs:
```python
env['ir.model.access'].search_read(
    [('model_id.model', '=', 'crm.lead'), ('perm_read', '=', True)],
    ['name', 'group_id']
)
```

---

## Related Documents

- [nexsus_v1_1984.md](./nexsus_v1_1984.md) - Unified collection implementation plan
- [VISION.md](./VISION.md) - Strategic vision
- [VISION_NEXUS_DATABASE.md](./VISION_NEXUS_DATABASE.md) - Database roadmap
