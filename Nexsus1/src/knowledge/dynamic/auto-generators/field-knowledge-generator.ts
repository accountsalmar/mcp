/**
 * Field Knowledge Auto-Generator - Stage 4
 *
 * Auto-generates Level 4 (Field) knowledge from schema structure.
 * This provides intelligent defaults for field metadata without manual entry.
 *
 * Generated knowledge includes:
 * - Data_Format: Based on field_type (date → "Excel serial date", integer → "Whole number")
 * - Valid_Values: Based on field_type (boolean → "Yes|No")
 * - Field_Knowledge: For FK fields ("Links to {target_model}")
 * - LLM_Usage_Notes: Type-specific handling guidance
 *
 * NOTE: Manual entries in Excel override these auto-generated values.
 *
 * Created as part of Stage 4: Dynamic Schema Architecture
 * See docs/plans/dynamic-schema-architecture.md
 */

import type { NexsusSchemaRow } from '../../../common/types.js';
import type { FieldKnowledgeExtension } from '../schemas/field-knowledge-schema.js';

// =============================================================================
// TYPE-TO-FORMAT MAPPING
// =============================================================================

/**
 * Maps field types to human-readable data format descriptions
 */
const TYPE_FORMAT_MAP: Record<string, string> = {
  // Date/Time types
  date: 'Excel serial date (45292 = Jul 1, 2023; 45658 = Jan 15, 2025). Convert to human-readable date before displaying.',
  datetime: 'ISO 8601 datetime string (e.g., "2025-01-15T14:30:00Z")',

  // Numeric types
  integer: 'Whole number (no decimals)',
  float: 'Decimal number (up to 6 decimal places)',
  monetary: 'Decimal amount with 2 decimal places (e.g., 1234.56)',

  // Text types
  char: 'Text string (single line)',
  text: 'Text string (multi-line, may contain formatting)',
  html: 'HTML-formatted text (contains tags)',

  // Boolean
  boolean: 'Boolean value (true/false)',

  // Selection
  selection: 'Enum value from predefined list',

  // Binary
  binary: 'Base64-encoded binary data',

  // Relational types
  many2one: 'Foreign key reference (single record)',
  many2many: 'Foreign key reference (multiple records)',
  one2many: 'Inverse FK reference (child records)',
};

/**
 * Maps field types to valid values hints
 */
const TYPE_VALID_VALUES_MAP: Record<string, string> = {
  boolean: 'true|false',
};

/**
 * Maps field types to LLM usage notes
 */
const TYPE_LLM_NOTES_MAP: Record<string, string> = {
  date: 'ALWAYS convert to human-readable date before displaying to users. Users expect "January 15, 2025" not "45658".',
  datetime: 'Format as human-readable datetime (e.g., "Jan 15, 2025 2:30 PM")',
  boolean: 'Display as "Yes"/"No" rather than true/false for readability.',
  monetary: 'Format with currency symbol and thousand separators (e.g., "$1,234.56")',
  float: 'Round to appropriate precision based on context (e.g., percentages to 1 decimal)',
  html: 'Strip HTML tags when displaying in plain text context.',
  binary: 'This is binary data - do not display raw content.',
  selection: 'Use the display value, not the technical key.',
};

// =============================================================================
// MAIN GENERATOR FUNCTION
// =============================================================================

/**
 * Auto-generate field knowledge for a schema row
 *
 * Generates intelligent defaults based on:
 * - Field type (date, integer, many2one, etc.)
 * - FK target information (if relational field)
 * - Field name patterns (contains "_id", "_code", etc.)
 *
 * @param schema - The schema row to generate knowledge for
 * @returns Generated field knowledge extension
 */
export function generateFieldKnowledge(schema: NexsusSchemaRow): FieldKnowledgeExtension {
  const result: FieldKnowledgeExtension = {};
  const fieldType = schema.field_type?.toLowerCase() || '';

  // 1. Generate Data_Format from field type
  if (TYPE_FORMAT_MAP[fieldType]) {
    result.Data_Format = TYPE_FORMAT_MAP[fieldType];
  }

  // 2. Generate Valid_Values for known types
  if (TYPE_VALID_VALUES_MAP[fieldType]) {
    result.Valid_Values = TYPE_VALID_VALUES_MAP[fieldType];
  }

  // 3. Generate Field_Knowledge for FK fields
  if (schema.fk_location_model) {
    result.Field_Knowledge = `Links to ${schema.fk_location_model} (FK relationship)`;

    // Update Data_Format for FK fields
    result.Data_Format = `Foreign key to ${schema.fk_location_model}. Value is the record ID in the target model.`;
  }

  // 4. Generate LLM_Usage_Notes based on field type
  if (TYPE_LLM_NOTES_MAP[fieldType]) {
    result.LLM_Usage_Notes = TYPE_LLM_NOTES_MAP[fieldType];
  }

  // 5. Special handling for FK fields
  if (['many2one', 'many2many', 'one2many'].includes(fieldType)) {
    if (schema.fk_location_model) {
      result.LLM_Usage_Notes = `Use ${schema.field_name}_qdrant for graph traversal to ${schema.fk_location_model}. For semantic search, use the display name.`;
    } else {
      result.LLM_Usage_Notes = `Relational field - use graph_traverse to explore connected records.`;
    }
  }

  // 6. Pattern-based knowledge generation
  const fieldNameLower = schema.field_name?.toLowerCase() || '';

  // ID fields
  if (fieldNameLower === 'id' || fieldNameLower.endsWith('_id')) {
    if (!result.Field_Knowledge) {
      result.Field_Knowledge = `Identifier field${fieldNameLower === 'id' ? ' (primary key)' : ''}`;
    }
  }

  // Name/display fields
  if (fieldNameLower === 'name' || fieldNameLower === 'display_name') {
    result.Field_Knowledge = result.Field_Knowledge || 'Primary display name for this record';
    result.LLM_Usage_Notes = result.LLM_Usage_Notes || 'Use this field for semantic search and display purposes.';
  }

  // Code fields (e.g., account_code)
  if (fieldNameLower.includes('_code') || fieldNameLower.endsWith('code')) {
    result.Field_Knowledge = result.Field_Knowledge || 'Technical code identifier';
    result.LLM_Usage_Notes = result.LLM_Usage_Notes || 'This is a structured code - use exact match for filtering.';
  }

  // Status/state fields
  if (fieldNameLower.includes('state') || fieldNameLower.includes('status')) {
    result.Field_Knowledge = result.Field_Knowledge || 'Record status/state indicator';
    result.LLM_Usage_Notes = result.LLM_Usage_Notes || 'Workflow state - check valid values for available states.';
  }

  // Amount/balance fields
  if (fieldNameLower.includes('amount') || fieldNameLower.includes('balance') ||
      fieldNameLower.includes('debit') || fieldNameLower.includes('credit')) {
    result.Field_Knowledge = result.Field_Knowledge || 'Financial amount field';
    result.LLM_Usage_Notes = result.LLM_Usage_Notes || 'Numeric value - be aware of sign conventions (positive vs negative).';
    result.Data_Format = result.Data_Format || 'Decimal with 2 decimal places';
  }

  // Date fields by name pattern
  if (fieldNameLower.includes('date') || fieldNameLower.includes('_at') ||
      fieldNameLower === 'create_date' || fieldNameLower === 'write_date') {
    result.LLM_Usage_Notes = result.LLM_Usage_Notes || 'Convert to human-readable date format before displaying.';
  }

  return result;
}

/**
 * Generate field knowledge for all schema rows
 *
 * @param schemas - Array of schema rows
 * @returns Map of field_id to generated knowledge
 */
export function generateAllFieldKnowledge(
  schemas: NexsusSchemaRow[]
): Map<number, FieldKnowledgeExtension> {
  const result = new Map<number, FieldKnowledgeExtension>();

  for (const schema of schemas) {
    if (schema.field_id) {
      const knowledge = generateFieldKnowledge(schema);

      // Only add if we generated any knowledge
      if (Object.keys(knowledge).length > 0) {
        result.set(schema.field_id, knowledge);
      }
    }
  }

  console.error(`[FieldKnowledgeGenerator] Generated knowledge for ${result.size}/${schemas.length} fields`);

  return result;
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get statistics about auto-generated field knowledge
 *
 * @param schemas - Array of schema rows
 * @returns Statistics about generated knowledge
 */
export function getFieldKnowledgeStats(schemas: NexsusSchemaRow[]): {
  total_fields: number;
  with_data_format: number;
  with_valid_values: number;
  with_field_knowledge: number;
  with_llm_notes: number;
  fk_fields: number;
  date_fields: number;
  numeric_fields: number;
} {
  let withDataFormat = 0;
  let withValidValues = 0;
  let withFieldKnowledge = 0;
  let withLlmNotes = 0;
  let fkFields = 0;
  let dateFields = 0;
  let numericFields = 0;

  for (const schema of schemas) {
    const knowledge = generateFieldKnowledge(schema);
    const fieldType = schema.field_type?.toLowerCase() || '';

    if (knowledge.Data_Format) withDataFormat++;
    if (knowledge.Valid_Values) withValidValues++;
    if (knowledge.Field_Knowledge) withFieldKnowledge++;
    if (knowledge.LLM_Usage_Notes) withLlmNotes++;

    if (schema.fk_location_model) fkFields++;
    if (['date', 'datetime'].includes(fieldType)) dateFields++;
    if (['integer', 'float', 'monetary'].includes(fieldType)) numericFields++;
  }

  return {
    total_fields: schemas.length,
    with_data_format: withDataFormat,
    with_valid_values: withValidValues,
    with_field_knowledge: withFieldKnowledge,
    with_llm_notes: withLlmNotes,
    fk_fields: fkFields,
    date_fields: dateFields,
    numeric_fields: numericFields,
  };
}
