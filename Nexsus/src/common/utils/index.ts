/**
 * Common Utilities
 *
 * This module exports shared utilities used across the Nexsus codebase.
 */

// UUID utilities
export * from './uuid-v2.js';

// Query logging
export * from './query-logger.js';

// Odoo error parsing
export * from './odoo-error-parser.js';

// FK value extraction (schema-driven, supports 3 formats)
export * from './fk-value-extractor.js';

// Type conversion (schema-driven, for Excel data)
export * from './type-converter.js';
