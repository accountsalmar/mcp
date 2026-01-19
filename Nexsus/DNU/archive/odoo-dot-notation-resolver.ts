/**
 * ARCHIVED: Odoo API Dot Notation Resolver
 *
 * This file contains Odoo-based dot notation resolution code.
 * Kept for future reference if direct Odoo API queries are needed.
 *
 * NOT connected to MCP server - standalone utility for future use.
 *
 * To use in future:
 * 1. Import getOdooClient from '../services/odoo-client.js'
 * 2. Call resolveViaOdoo(targetModel, targetField, operator, value)
 *
 * @example
 * // Resolve partner_id.name contains "Hansen"
 * const ids = await resolveViaOdoo('res.partner', 'name', 'contains', 'Hansen');
 * // Returns: [282161, 286798, ...]
 */

// =============================================================================
// OPERATOR MAPPING
// =============================================================================

/**
 * Operator mapping from exact_query to Odoo domain
 */
export const ODOO_OPERATOR_MAP: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'in',
  contains: 'ilike'
};

// =============================================================================
// ODOO RESOLUTION FUNCTION
// =============================================================================

/**
 * Resolve FK filter via Odoo API
 *
 * Queries Odoo directly to find matching record IDs.
 * Slower due to network latency (~200-500ms).
 *
 * @param targetModel - The Odoo model to search (e.g., 'res.partner')
 * @param targetField - The field to filter on (e.g., 'name')
 * @param operator - The filter operator (e.g., 'contains', 'eq')
 * @param value - The value to match
 * @param getOdooClient - Function to get Odoo client instance
 * @returns Array of matching record IDs
 *
 * @example
 * const client = getOdooClient();
 * const ids = await resolveViaOdoo('res.partner', 'name', 'contains', 'Hansen', () => client);
 */
export async function resolveViaOdoo(
  targetModel: string,
  targetField: string,
  operator: string,
  value: unknown,
  getOdooClient: () => { searchRead: <T>(model: string, domain: unknown[], fields: string[], options?: { limit?: number }) => Promise<T[]> }
): Promise<number[]> {
  const odooDomain = buildOdooDomain(targetField, operator, value);

  console.error(`[DotNotation:Odoo] Querying ${targetModel} with domain: ${JSON.stringify(odooDomain)}`);

  const client = getOdooClient();
  const results = await client.searchRead<{ id: number }>(
    targetModel,
    odooDomain,
    ['id'],
    { limit: 10000 } // Safety limit
  );

  return results.map(r => r.id);
}

// =============================================================================
// DOMAIN BUILDER
// =============================================================================

/**
 * Build Odoo domain from filter parameters
 *
 * Converts exact_query operators to Odoo domain format.
 *
 * @param field - Field name to filter
 * @param op - Operator (eq, neq, contains, etc.)
 * @param value - Filter value
 * @returns Odoo domain array
 *
 * @example
 * buildOdooDomain('name', 'contains', 'Hansen')
 * // Returns: [['name', 'ilike', 'Hansen']]
 */
export function buildOdooDomain(
  field: string,
  op: string,
  value: unknown
): unknown[] {
  const odooOp = ODOO_OPERATOR_MAP[op];
  if (!odooOp) {
    throw new Error(`Unsupported operator for Odoo: ${op}`);
  }

  // Handle special case for 'contains' -> 'ilike'
  if (op === 'contains') {
    return [[field, 'ilike', value]];
  }

  // Handle 'in' operator
  if (op === 'in') {
    if (!Array.isArray(value)) {
      throw new Error(`'in' operator requires array value`);
    }
    return [[field, 'in', value]];
  }

  // Standard comparison operators
  return [[field, odooOp, value]];
}
