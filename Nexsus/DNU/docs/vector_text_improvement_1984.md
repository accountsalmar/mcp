# Vector Text Optimization - Implementation Plan

## User Requirements Summary

| Requirement | Description |
|-------------|-------------|
| **No data dropping** | ALL fields must remain in vector text |
| **No new data** | Only restructure existing fields |
| **Logical arrangement** | Reorder fields to create semantic meaning |
| **Consistent mechanism** | Same approach works for ALL models in pipeline |
| **nexsus_search support** | Text must support precise data queries |
| **Full re-sync** | Re-embed all data after implementation |

---

## Current vs New Format

### BEFORE (Current)
```
In model account.move.line, Account - 11811 Work In Progress - DC, Account Root - 11,
Amount in Currency - 0.05, Balance - 0.05, Analytic Distribution - [object Object],
Company - Duracube, Created on - Jun 7, 2023, Credit - 0, Debit - 0.05, ...
```
**Problems:** Flat structure, no grouping, no semantic hierarchy, fields scattered randomly.

### AFTER (New Format)
```
[RECORD] account.move.line ID 312552: Journal Entry STJ/2022/7165_4081.
[FINANCIAL] Debit 0.05 AUD, Credit 0, Balance 0.05, Amount in Currency 0.05, Subtotal 0, Total 0, Base Amount 0, Discount Balance 0.
[ACCOUNTS] Account 11811 Work In Progress - DC, Account Root 11.
[RELATIONSHIPS] Company Duracube, Partner not set, Product 2CAMCIT34i - Defect 02 - Add shadow-line fillers x4.
[CONTEXT] Journal Inventory trasfer, Status posted, Display Type product.
[STATUS] Reconciled No, Is Downpayment No, Is Landed Costs Line No, No Follow-up No, Invert Tags No.
[TIMELINE] Date Jun 8, 2023, Created Jun 7, 2023 by Kasun Jayasinghe, Updated Jun 7, 2023 by Kasun Jayasinghe.
[DETAILS] Label WH/MO/05103 - 2CAMCIT34i - Defect 02 - Add shadow-line fillers x4, Reference WH/MO/05103, Number STJ/2022/7165_4081, Sequence 10, Quantity 1 Units, Unit Price 0.
```
**Benefits:** Semantic grouping, natural language flow, key identifiers first, ALL data preserved.

---

## Implementation Approach: Type-Based Auto-Detection

Since we have 17,000+ fields across many models, manual categorization isn't practical. Instead:

1. **Primary**: Auto-detect category from `field_type` (consistent for ALL models)
2. **Override**: Optional `Field_Category` column in Excel for custom categorization
3. **Priority**: Optional `Field_Priority` column for ordering within groups

### Category Detection Rules

| Field Type | Auto Category | Logic |
|------------|---------------|-------|
| Field name = `id` | RECORD | Primary identifier |
| Field name = `name`, `display_name` | RECORD | Record name |
| Field name contains `reference`, `number` | RECORD | Identifiers |
| `monetary`, `float` with money-related names | FINANCIAL | Amounts |
| `integer` with count-related names | FINANCIAL | Quantities |
| Field name contains `account` | ACCOUNTS | Chart of accounts |
| `many2one` | RELATIONSHIPS | FK references |
| `many2many`, `one2many` | COLLECTIONS | Record collections |
| `boolean` | STATUS | Yes/No flags |
| `selection` | CONTEXT | Choice fields |
| `date`, `datetime` | TIMELINE | Temporal data |
| `char`, `text`, `html` | DETAILS | Text content |

### Category Order (Fixed)
1. **RECORD** - Identity (name, ID, reference) - always first
2. **FINANCIAL** - Money amounts (debit, credit, balance)
3. **ACCOUNTS** - Account references
4. **RELATIONSHIPS** - FK relations (partner, company, product)
5. **CONTEXT** - Selection fields (journal, status, type)
6. **STATUS** - Boolean flags
7. **TIMELINE** - Dates and timestamps
8. **DETAILS** - Everything else (text, labels, descriptions)

---

## Implementation Steps

### Step 1: Add Types (src/types.ts)

```typescript
// Add after line 926

/** Field categories for semantic grouping in vector text */
export type FieldCategory =
  | 'RECORD'       // Identity: id, name, reference, number
  | 'FINANCIAL'    // Money: debit, credit, balance, amount
  | 'ACCOUNTS'     // Chart of accounts references
  | 'RELATIONSHIPS'// FK relations: partner, company, user
  | 'COLLECTIONS'  // one2many, many2many arrays
  | 'CONTEXT'      // Selection fields: status, type, journal
  | 'STATUS'       // Boolean flags
  | 'TIMELINE'     // Dates and timestamps
  | 'DETAILS';     // Everything else

// Update PipelineField interface - add optional fields:
// field_category?: FieldCategory;  // Optional override from Excel
// field_priority?: number;         // Optional priority (1=highest)
```

### Step 2: Add Category Detection (src/services/pipeline-data-transformer.ts)

```typescript
// New function: detectFieldCategory()
// Uses field_type and field_name patterns to auto-assign category
// Returns FieldCategory

const CATEGORY_ORDER: FieldCategory[] = [
  'RECORD', 'FINANCIAL', 'ACCOUNTS', 'RELATIONSHIPS',
  'CONTEXT', 'STATUS', 'TIMELINE', 'DETAILS'
];
```

### Step 3: Modify buildVectorText() (src/services/pipeline-data-transformer.ts)

**Current (lines 194-225):**
- Loops through fields in order from Excel
- Builds flat "Field - Value" string

**New Logic:**
1. Categorize all fields using `detectFieldCategory()` or Excel override
2. Group fields by category
3. Sort groups by CATEGORY_ORDER
4. Sort fields within groups by priority (if set) then alphabetically
5. Format each group with `[CATEGORY]` prefix and natural language
6. Join all groups with periods/newlines

### Step 4: Update Excel Loader (src/services/excel-pipeline-loader.ts)

**Add support for optional columns:**
- `Field_Category` - Override auto-detection
- `Field_Priority` - Order within category (1=first)

**Fallback:** If columns don't exist, use auto-detection only.

### Step 5: Add Constants (src/constants.ts)

```typescript
// Category detection patterns
export const FIELD_CATEGORY_PATTERNS = {
  RECORD: ['id', 'name', 'display_name', 'reference', 'number', 'code'],
  FINANCIAL: ['amount', 'debit', 'credit', 'balance', 'price', 'total', 'subtotal', 'cost', 'revenue'],
  ACCOUNTS: ['account', 'account_id', 'account_root'],
  TIMELINE: ['date', 'create_date', 'write_date', 'deadline', 'scheduled'],
  // ... etc
};

// Category templates for natural language formatting
export const CATEGORY_TEMPLATES = {
  RECORD: (modelName: string, fields: string) => `[RECORD] ${modelName}: ${fields}.`,
  FINANCIAL: (fields: string) => `[FINANCIAL] ${fields}.`,
  // ... etc
};
```

---

## Files to Modify

| File | Changes | Lines |
|------|---------|-------|
| `src/types.ts` | Add `FieldCategory` type, update `PipelineField` interface | ~926 |
| `src/services/pipeline-data-transformer.ts` | Add `detectFieldCategory()`, rewrite `buildVectorText()` | 194-225 |
| `src/services/excel-pipeline-loader.ts` | Add optional Field_Category, Field_Priority columns | 154-166 |
| `src/constants.ts` | Add CATEGORY_PATTERNS, CATEGORY_ORDER, CATEGORY_TEMPLATES | end |
| `data pileline format.xlsx` | (Optional) Add Field_Category, Field_Priority columns | N/A |

---

## Example Transformation

### Input Record (account.move.line)
```json
{
  "id": 312552,
  "name": "STJ/2022/7165_4081",
  "debit": 0.05,
  "credit": 0,
  "balance": 0.05,
  "partner_id": false,
  "company_id": [1, "Duracube"],
  "account_id": [123, "11811 Work In Progress - DC"],
  "date": "2023-06-08",
  "create_date": "2023-06-07 10:30:00",
  "state": "posted",
  "reconciled": false,
  "product_id": [456, "2CAMCIT34i - Defect 02"],
  "quantity": 1,
  "ref": "WH/MO/05103 - 2CAMCIT34i"
}
```

### Categorization
```
RECORD: id, name
FINANCIAL: debit, credit, balance, quantity
ACCOUNTS: account_id
RELATIONSHIPS: company_id, partner_id, product_id
CONTEXT: state
STATUS: reconciled
TIMELINE: date, create_date
DETAILS: ref
```

### Output Vector Text
```
[RECORD] account.move.line ID 312552: STJ/2022/7165_4081.
[FINANCIAL] Debit 0.05, Credit 0, Balance 0.05, Quantity 1.
[ACCOUNTS] Account 11811 Work In Progress - DC.
[RELATIONSHIPS] Company Duracube, Partner not set, Product 2CAMCIT34i - Defect 02.
[CONTEXT] Status posted.
[STATUS] Reconciled No.
[TIMELINE] Date Jun 8, 2023, Created Jun 7, 2023.
[DETAILS] Reference WH/MO/05103 - 2CAMCIT34i.
```

---

## Post-Implementation: Full Re-Sync

After code changes are complete:

1. **Delete existing data collection:**
   ```
   system_status section=data  // Check current counts
   ```

2. **Re-sync all models with new format:**
   ```
   pipeline_sync command=pipeline_account.move.line_1984
   pipeline_sync command=pipeline_crm.lead_1984
   // ... other models
   ```

3. **Verify with semantic search:**
   Test queries to confirm improved search quality.

---

## Testing Approach

### Before/After Comparison
1. Save sample vector texts from current format
2. Implement changes
3. Generate new vector texts for same records
4. Compare side-by-side

### Search Quality Tests
| Query | Expected Improvement |
|-------|---------------------|
| "debit entries over 1000" | FINANCIAL group makes amounts prominent |
| "invoices for Duracube" | RELATIONSHIPS group links partner context |
| "transactions in June 2023" | TIMELINE group surfaces date fields |

---

## Research Sources

- [Late Chunking Research (Jina AI)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/)
- [Voyage AI Embeddings Docs](https://docs.voyageai.com/docs/embeddings)
- [Pinecone Structured Data Guide](https://www.pinecone.io/learn/structured-data/)
- [Ramp Transaction Embeddings](https://builders.ramp.com/post/transaction-embeddings)
- [Zilliz Vectorizing Structured Data](https://zilliz.com/learn/an-ultimate-guide-to-vectorizing-structured-data)
- [TabRAG: Tabular Document Retrieval](https://arxiv.org/html/2511.06582)
- [Embeddings for Tabular Data Survey](https://arxiv.org/pdf/2302.11777)

---

## Key Research Findings

### Why Text Structure Matters
- **TaBERT research**: "adding column headers and phrasing input as sentences improve results"
- **Pinecone research**: "natural language templates outperform simple concatenation"
- **Ramp (financial transactions)**: "enriched contextual transactions" performed best

### Voyage AI Recommendations
- Use `input_type='document'` for indexed content
- voyage-3.5-lite (1024 dims) is good balance of cost/quality
- Consider voyage-context-3 for contextualized embeddings (14% better retrieval)

### Token Efficiency
- Current text: ~800-1500 tokens per record
- Optimized text: Similar length but better semantic density
- Focus on logical arrangement, not length reduction
