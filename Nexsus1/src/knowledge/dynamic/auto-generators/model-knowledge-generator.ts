/**
 * Model Knowledge Auto-Generator - Stage 5
 *
 * Auto-generates Level 3 (Model) knowledge from schema structure.
 * This provides intelligent defaults for model metadata without manual entry.
 *
 * Generated knowledge includes:
 * - Business_Name: Derived from model_name (snake_case to Title Case)
 * - Business_Purpose: Based on model patterns and field analysis
 * - Data_Grain: Based on identified key fields
 * - Key_Relationships: From FK fields in schema
 * - Is_Payload_Enabled: From payload configuration
 * - Primary_Use_Cases: Based on model patterns
 * - LLM_Query_Guidance: Based on available fields and FK relationships
 *
 * NOTE: Manual entries in Excel override these auto-generated values.
 *
 * Created as part of Stage 5: Dynamic Schema Architecture
 * See docs/plans/dynamic-schema-architecture.md
 */

import type { NexsusSchemaRow } from '../../../common/types.js';
import type { ModelMetadataRow } from '../schemas/model-metadata-schema.js';

// =============================================================================
// MODEL PURPOSE PATTERNS
// =============================================================================

/**
 * Maps common model name patterns to business purposes
 */
const MODEL_PURPOSE_PATTERNS: Array<{
  pattern: RegExp;
  purpose: string;
  use_cases: string;
}> = [
  // Financial models
  {
    pattern: /^(account\.move|journal|invoice)/i,
    purpose: 'Financial transactions and journal entries',
    use_cases: 'Financial reporting, ledger queries, transaction lookup',
  },
  {
    pattern: /^account\./i,
    purpose: 'Accounting and financial data',
    use_cases: 'Chart of accounts, financial statements, GL queries',
  },
  {
    pattern: /^(actual|actuals|gl_actual)/i,
    purpose: 'Actual financial figures by period',
    use_cases: 'Period reporting, variance analysis, trend analysis',
  },
  {
    pattern: /^(budget|forecast)/i,
    purpose: 'Budget and forecast figures by period',
    use_cases: 'Budget vs actual, planning, forecasting',
  },
  {
    pattern: /^master$/i,
    purpose: 'Master data reference table',
    use_cases: 'Lookup, classification, reference data queries',
  },

  // CRM models
  {
    pattern: /^crm\.lead/i,
    purpose: 'Sales leads and opportunities',
    use_cases: 'Pipeline analysis, lead tracking, conversion metrics',
  },
  {
    pattern: /^crm\./i,
    purpose: 'Customer relationship management data',
    use_cases: 'Sales tracking, customer analysis, pipeline management',
  },

  // Partner/Contact models
  {
    pattern: /^res\.partner/i,
    purpose: 'Contacts and business partners',
    use_cases: 'Customer lookup, vendor management, contact search',
  },
  {
    pattern: /^res\.users/i,
    purpose: 'System users and their settings',
    use_cases: 'User lookup, access control, audit trails',
  },
  {
    pattern: /^res\.company/i,
    purpose: 'Company entities in multi-company setup',
    use_cases: 'Company filtering, inter-company transactions',
  },
  {
    pattern: /^res\./i,
    purpose: 'System resource and configuration data',
    use_cases: 'Configuration lookup, system metadata',
  },

  // Product models
  {
    pattern: /^product\./i,
    purpose: 'Products and product information',
    use_cases: 'Product catalog, inventory queries, pricing',
  },

  // Stock/Inventory models
  {
    pattern: /^stock\./i,
    purpose: 'Inventory and warehouse data',
    use_cases: 'Stock levels, warehouse operations, inventory tracking',
  },

  // Purchase models
  {
    pattern: /^purchase\./i,
    purpose: 'Purchase orders and procurement',
    use_cases: 'PO tracking, vendor analysis, procurement reporting',
  },

  // Sale models
  {
    pattern: /^sale\./i,
    purpose: 'Sales orders and transactions',
    use_cases: 'Sales analysis, order tracking, revenue reporting',
  },

  // Project models
  {
    pattern: /^project\./i,
    purpose: 'Project management data',
    use_cases: 'Project tracking, task management, resource allocation',
  },

  // HR models
  {
    pattern: /^hr\./i,
    purpose: 'Human resources and employee data',
    use_cases: 'Employee lookup, HR reporting, leave management',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert model name to human-readable business name
 *
 * Examples:
 * - "crm.lead" → "CRM Lead"
 * - "res.partner" → "Partner"
 * - "account.move.line" → "Account Move Line"
 * - "master" → "Master"
 * - "actual" → "Actual"
 *
 * @param modelName - Technical model name
 * @returns Human-readable business name
 */
export function modelNameToBusinessName(modelName: string): string {
  // Handle special cases
  const specialNames: Record<string, string> = {
    'res.partner': 'Partner',
    'res.users': 'User',
    'res.company': 'Company',
    'crm.lead': 'CRM Lead / Opportunity',
    'account.move': 'Journal Entry',
    'account.move.line': 'Journal Item',
    'product.product': 'Product',
    'product.template': 'Product Template',
    'master': 'Chart of Accounts (Master)',
    'actual': 'Monthly Actuals',
    'budget': 'Budget',
  };

  if (specialNames[modelName]) {
    return specialNames[modelName];
  }

  // Generic conversion: remove common prefixes and convert to title case
  let name = modelName;

  // Remove common prefixes
  const prefixes = ['res.', 'ir.', 'base.'];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      name = name.substring(prefix.length);
      break;
    }
  }

  // Convert dots and underscores to spaces, then title case
  return name
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Find matching purpose pattern for a model name
 *
 * @param modelName - Technical model name
 * @returns Matching pattern or undefined
 */
function findModelPurposePattern(modelName: string): {
  purpose: string;
  use_cases: string;
} | undefined {
  for (const pattern of MODEL_PURPOSE_PATTERNS) {
    if (pattern.pattern.test(modelName)) {
      return {
        purpose: pattern.purpose,
        use_cases: pattern.use_cases,
      };
    }
  }
  return undefined;
}

/**
 * Analyze schema fields to determine data grain
 *
 * @param fields - Array of schema rows for the model
 * @returns Inferred data grain description
 */
function inferDataGrain(fields: NexsusSchemaRow[]): string {
  const fieldNames = new Set(fields.map(f => f.field_name.toLowerCase()));

  // Look for date/period fields that indicate granularity
  if (fieldNames.has('month') || fieldNames.has('period')) {
    return 'One row per entity per month/period';
  }
  if (fieldNames.has('date') || fieldNames.has('transaction_date')) {
    return 'One row per transaction/event';
  }
  if (fieldNames.has('year')) {
    return 'One row per entity per year';
  }

  // Look for FK patterns
  const fkFields = fields.filter(f => f.fk_location_model);
  if (fkFields.length >= 2) {
    const fkModels = fkFields.map(f => f.fk_location_model).join(', ');
    return `One row per combination of ${fkModels}`;
  }

  // Default based on model type
  if (fieldNames.has('id')) {
    return 'One row per record (unique by ID)';
  }

  return 'One row per record';
}

/**
 * Generate key relationships string from FK fields
 *
 * @param modelName - The model name
 * @param fields - Array of schema rows for the model
 * @returns Key relationships description
 */
function generateKeyRelationships(modelName: string, fields: NexsusSchemaRow[]): string | undefined {
  const fkFields = fields.filter(f => f.fk_location_model);

  if (fkFields.length === 0) {
    return undefined;
  }

  const relationships = fkFields.map(f =>
    `${modelName}.${f.field_name} → ${f.fk_location_model}`
  );

  return relationships.join('; ');
}

/**
 * Generate LLM query guidance based on available fields
 *
 * @param modelName - The model name
 * @param fields - Array of schema rows for the model
 * @param isPayloadEnabled - Whether payload filtering is available
 * @returns Query guidance string
 */
function generateQueryGuidance(
  modelName: string,
  fields: NexsusSchemaRow[],
  isPayloadEnabled: boolean
): string {
  const parts: string[] = [];

  // Primary search strategy
  if (isPayloadEnabled) {
    parts.push('Supports nexsus_search with payload filtering.');
  } else {
    parts.push('SEMANTIC SEARCH ONLY - no payload filtering available.');
  }

  // Identify key fields for filtering
  const fieldNames = new Set(fields.map(f => f.field_name.toLowerCase()));

  // ID field
  if (fieldNames.has('id')) {
    parts.push('Use record ID for exact lookup.');
  }

  // Name field
  if (fieldNames.has('name') || fieldNames.has('display_name')) {
    parts.push('Use name/display_name for semantic search.');
  }

  // Date fields
  if (fieldNames.has('date') || fieldNames.has('month') || fieldNames.has('period')) {
    parts.push('Filter by date/period for time-based queries.');
  }

  // FK relationships
  const fkFields = fields.filter(f => f.fk_location_model);
  if (fkFields.length > 0) {
    const fkList = fkFields.slice(0, 3).map(f => f.field_name).join(', ');
    parts.push(`Use graph_traverse to explore FK relationships (${fkList}).`);
  }

  return parts.join(' ');
}

// =============================================================================
// MAIN GENERATOR FUNCTION
// =============================================================================

/**
 * Auto-generate model metadata for a model
 *
 * @param modelName - The model name
 * @param modelId - The model ID
 * @param fields - Array of schema rows for this model
 * @param isPayloadEnabled - Whether payload is configured for this model
 * @param recordCount - Optional record count (from data collection)
 * @returns Generated model metadata row
 */
export function generateModelMetadata(
  modelName: string,
  modelId: number,
  fields: NexsusSchemaRow[],
  isPayloadEnabled: boolean,
  recordCount?: number
): ModelMetadataRow {
  // Find matching purpose pattern
  const pattern = findModelPurposePattern(modelName);

  // Generate metadata
  const metadata: ModelMetadataRow = {
    Model_ID: modelId,
    Model_Name: modelName,
    Business_Name: modelNameToBusinessName(modelName),
    Business_Purpose: pattern?.purpose || `Contains ${modelName} records`,
    Data_Grain: inferDataGrain(fields),
    Record_Count: recordCount,
    Is_Payload_Enabled: isPayloadEnabled,
    Primary_Use_Cases: pattern?.use_cases || 'Data lookup and analysis',
    Key_Relationships: generateKeyRelationships(modelName, fields),
    LLM_Query_Guidance: generateQueryGuidance(modelName, fields, isPayloadEnabled),
    Last_Updated: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  };

  return metadata;
}

/**
 * Generate model metadata for all models in schema
 *
 * @param schemas - Array of all schema rows
 * @param payloadEnabledModels - Set of model names with payload configured
 * @param recordCounts - Optional map of model_name to record count
 * @returns Array of generated model metadata rows
 */
export function generateAllModelMetadata(
  schemas: NexsusSchemaRow[],
  payloadEnabledModels: Set<string>,
  recordCounts?: Map<string, number>
): ModelMetadataRow[] {
  // Group schemas by model
  const modelFields = new Map<string, { modelId: number; fields: NexsusSchemaRow[] }>();

  for (const schema of schemas) {
    const existing = modelFields.get(schema.model_name);
    if (existing) {
      existing.fields.push(schema);
    } else {
      modelFields.set(schema.model_name, {
        modelId: schema.model_id,
        fields: [schema],
      });
    }
  }

  // Generate metadata for each model
  const result: ModelMetadataRow[] = [];

  for (const [modelName, data] of modelFields.entries()) {
    const isPayloadEnabled = payloadEnabledModels.has(modelName);
    const recordCount = recordCounts?.get(modelName);

    const metadata = generateModelMetadata(
      modelName,
      data.modelId,
      data.fields,
      isPayloadEnabled,
      recordCount
    );

    result.push(metadata);
  }

  console.error(`[ModelKnowledgeGenerator] Generated metadata for ${result.length} models`);

  return result;
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get statistics about auto-generated model knowledge
 *
 * @param schemas - Array of schema rows
 * @param payloadEnabledModels - Set of model names with payload configured
 * @returns Statistics about generated knowledge
 */
export function getModelKnowledgeStats(
  schemas: NexsusSchemaRow[],
  payloadEnabledModels: Set<string>
): {
  total_models: number;
  with_purpose_pattern: number;
  with_fk_relationships: number;
  payload_enabled: number;
  avg_fields_per_model: number;
} {
  // Group by model
  const modelFields = new Map<string, NexsusSchemaRow[]>();
  for (const schema of schemas) {
    const existing = modelFields.get(schema.model_name);
    if (existing) {
      existing.push(schema);
    } else {
      modelFields.set(schema.model_name, [schema]);
    }
  }

  let withPurposePattern = 0;
  let withFkRelationships = 0;
  let payloadEnabled = 0;
  let totalFields = 0;

  for (const [modelName, fields] of modelFields.entries()) {
    totalFields += fields.length;

    if (findModelPurposePattern(modelName)) {
      withPurposePattern++;
    }

    if (fields.some(f => f.fk_location_model)) {
      withFkRelationships++;
    }

    if (payloadEnabledModels.has(modelName)) {
      payloadEnabled++;
    }
  }

  return {
    total_models: modelFields.size,
    with_purpose_pattern: withPurposePattern,
    with_fk_relationships: withFkRelationships,
    payload_enabled: payloadEnabled,
    avg_fields_per_model: modelFields.size > 0
      ? Math.round(totalFields / modelFields.size)
      : 0,
  };
}
