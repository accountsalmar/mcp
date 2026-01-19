/**
 * JSON FK Configuration Service
 *
 * Loads and provides access to JSON FK mappings from json_fk_mappings.json.
 * These mappings define how JSON fields with FK keys should be resolved.
 *
 * Example: analytic_distribution: {"5029": 100}
 * - Field "analytic_distribution" on model "account.move.line"
 * - Key "5029" is a record ID of "account.analytic.account"
 * - Value 100 is a percentage
 *
 * Usage:
 *   const mapping = getJsonFkMapping("account.move.line", "analytic_distribution");
 *   if (mapping) {
 *     // Key target model is "account.analytic.account"
 *     // Key "5029" should be resolved to that model's record
 *   }
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { JsonFkConfig, JsonFkMapping } from '../types.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// MODULE STATE
// =============================================================================

let config: JsonFkConfig | null = null;
let configLoadAttempted = false;

// Lookup map: "model:field" -> mapping
const mappingLookup = new Map<string, JsonFkMapping>();

// =============================================================================
// CONFIG LOADING
// =============================================================================

/**
 * Get the path to the JSON FK config file
 * @returns The full path to json_fk_mappings.json
 */
export function getConfigFilePath(): string {
  // Try multiple paths to support different working directories
  const paths = [
    join(process.cwd(), 'data', 'json_fk_mappings.json'),
    join(process.cwd(), '..', 'data', 'json_fk_mappings.json'),
    join(__dirname, '..', '..', 'data', 'json_fk_mappings.json'),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Return default path even if it doesn't exist (for error messaging)
  return paths[0];
}

/**
 * Load the JSON FK configuration from file
 *
 * Lazily loaded on first access. Returns null if file doesn't exist
 * or is invalid (this is not a fatal error - just means no JSON FK
 * resolution will be available).
 */
export function loadJsonFkConfig(): JsonFkConfig | null {
  if (configLoadAttempted) {
    return config;
  }

  configLoadAttempted = true;
  const configPath = getConfigFilePath();

  if (!existsSync(configPath)) {
    console.error(`[JsonFkConfig] Config file not found: ${configPath}`);
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    config = JSON.parse(content) as JsonFkConfig;

    // Build lookup map for fast access
    mappingLookup.clear();
    for (const mapping of config.mappings) {
      const key = `${mapping.source_model}:${mapping.field_name}`;
      mappingLookup.set(key, mapping);
    }

    console.error(`[JsonFkConfig] Loaded ${config.mappings.length} JSON FK mappings`);
    return config;
  } catch (error) {
    console.error(`[JsonFkConfig] Failed to load config: ${error}`);
    return null;
  }
}

/**
 * Force reload the configuration (useful after config changes)
 */
export function reloadJsonFkConfig(): JsonFkConfig | null {
  configLoadAttempted = false;
  config = null;
  mappingLookup.clear();
  return loadJsonFkConfig();
}

// =============================================================================
// CONFIG QUERIES
// =============================================================================

/**
 * Get JSON FK mapping for a specific model and field
 *
 * @param modelName - Source model (e.g., "account.move.line")
 * @param fieldName - JSON field name (e.g., "analytic_distribution")
 * @returns Mapping if found, undefined otherwise
 */
export function getJsonFkMapping(
  modelName: string,
  fieldName: string
): JsonFkMapping | undefined {
  // Ensure config is loaded
  if (!configLoadAttempted) {
    loadJsonFkConfig();
  }

  const key = `${modelName}:${fieldName}`;
  return mappingLookup.get(key);
}

/**
 * Check if a field is a JSON FK field
 *
 * @param modelName - Source model
 * @param fieldName - Field to check
 * @returns True if this is a JSON FK field
 */
export function isJsonFkField(modelName: string, fieldName: string): boolean {
  return getJsonFkMapping(modelName, fieldName) !== undefined;
}

/**
 * Get all JSON FK mappings for a model
 *
 * @param modelName - Source model
 * @returns Array of mappings for this model
 */
export function getJsonFkMappingsForModel(modelName: string): JsonFkMapping[] {
  // Ensure config is loaded
  if (!configLoadAttempted) {
    loadJsonFkConfig();
  }

  if (!config) {
    return [];
  }

  return config.mappings.filter((m) => m.source_model === modelName);
}

/**
 * Get all configured JSON FK field names for a model
 *
 * @param modelName - Source model
 * @returns Array of field names that are JSON FK fields
 */
export function getJsonFkFieldNames(modelName: string): string[] {
  return getJsonFkMappingsForModel(modelName).map((m) => m.field_name);
}

/**
 * Get complete loaded configuration (for debugging/status)
 */
export function getJsonFkConfigStatus(): {
  loaded: boolean;
  mappingCount: number;
  fkCount: number;
  metadataCount: number;
  mappings: JsonFkMapping[];
} {
  // Ensure config is loaded
  if (!configLoadAttempted) {
    loadJsonFkConfig();
  }

  const mappings = config?.mappings ?? [];
  const fkCount = mappings.filter(
    (m) => m.mapping_type === 'fk' || !m.mapping_type
  ).length;
  const metadataCount = mappings.filter(
    (m) => m.mapping_type === 'metadata'
  ).length;

  return {
    loaded: config !== null,
    mappingCount: mappings.length,
    fkCount,
    metadataCount,
    mappings,
  };
}

// =============================================================================
// CONFIG WRITE OPERATIONS
// =============================================================================

/**
 * Check if a JSON FK mapping exists for a specific model and field
 *
 * @param sourceModel - Source model (e.g., "account.move.line")
 * @param fieldName - JSON field name (e.g., "analytic_distribution")
 * @returns True if mapping exists
 */
export function hasJsonFkMapping(sourceModel: string, fieldName: string): boolean {
  return getJsonFkMapping(sourceModel, fieldName) !== undefined;
}

/**
 * Get all JSON FK mappings filtered by mapping_type
 *
 * @param type - Filter by mapping type: 'fk' or 'metadata'
 * @returns Array of mappings matching the type
 */
export function getJsonFkMappingsByType(
  type: 'fk' | 'metadata'
): JsonFkMapping[] {
  // Ensure config is loaded
  if (!configLoadAttempted) {
    loadJsonFkConfig();
  }

  if (!config) {
    return [];
  }

  if (type === 'fk') {
    // Include mappings without mapping_type for backward compatibility
    return config.mappings.filter(
      (m) => m.mapping_type === 'fk' || !m.mapping_type
    );
  }

  return config.mappings.filter((m) => m.mapping_type === type);
}

/**
 * Create a timestamped backup of the config file
 *
 * @returns Path to backup file
 */
function createConfigBackup(): string {
  const configPath = getConfigFilePath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = configPath.replace('.json', `.backup-${timestamp}.json`);

  if (existsSync(configPath)) {
    copyFileSync(configPath, backupPath);
    console.error(`[JsonFkConfig] Created backup: ${backupPath}`);
  }

  return backupPath;
}

/**
 * Add a new JSON FK mapping to the configuration
 *
 * Creates a backup before modifying the config file.
 *
 * @param mapping - The mapping to add
 * @returns Object with success status, message, and backup path
 */
export function addJsonFkMapping(mapping: JsonFkMapping): {
  success: boolean;
  message: string;
  backupPath?: string;
} {
  // Ensure config is loaded
  if (!configLoadAttempted) {
    loadJsonFkConfig();
  }

  // Check if mapping already exists
  if (hasJsonFkMapping(mapping.source_model, mapping.field_name)) {
    return {
      success: false,
      message: `Mapping already exists for ${mapping.source_model}.${mapping.field_name}`,
    };
  }

  // Initialize config if null
  if (!config) {
    config = {
      version: 2,
      description: 'JSON field mappings - FK fields for resolution, metadata for tracking',
      mappings: [],
    };
  }

  try {
    // Create backup before modifying
    const backupPath = createConfigBackup();

    // Add the new mapping
    config.mappings.push(mapping);

    // Update lookup map
    const key = `${mapping.source_model}:${mapping.field_name}`;
    mappingLookup.set(key, mapping);

    // Write updated config to file
    const configPath = getConfigFilePath();
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.error(
      `[JsonFkConfig] Added mapping: ${mapping.source_model}.${mapping.field_name} (${mapping.mapping_type || 'fk'})`
    );

    return {
      success: true,
      message: `Added mapping for ${mapping.source_model}.${mapping.field_name}`,
      backupPath,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to add mapping: ${error}`,
    };
  }
}

/**
 * Add multiple JSON FK mappings at once
 *
 * Creates a single backup before all additions.
 *
 * @param mappings - Array of mappings to add
 * @returns Object with success count, skip count, and details
 */
export function addJsonFkMappings(mappings: JsonFkMapping[]): {
  successCount: number;
  skipCount: number;
  failCount: number;
  details: Array<{ mapping: string; status: 'added' | 'skipped' | 'failed'; message: string }>;
  backupPath?: string;
} {
  // Ensure config is loaded
  if (!configLoadAttempted) {
    loadJsonFkConfig();
  }

  // Initialize config if null
  if (!config) {
    config = {
      version: 2,
      description: 'JSON field mappings - FK fields for resolution, metadata for tracking',
      mappings: [],
    };
  }

  // Create single backup before all modifications
  const backupPath = createConfigBackup();

  const details: Array<{ mapping: string; status: 'added' | 'skipped' | 'failed'; message: string }> = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const mapping of mappings) {
    const mappingName = `${mapping.source_model}.${mapping.field_name}`;

    // Check if mapping already exists
    if (hasJsonFkMapping(mapping.source_model, mapping.field_name)) {
      details.push({ mapping: mappingName, status: 'skipped', message: 'Already exists' });
      skipCount++;
      continue;
    }

    try {
      // Add the new mapping
      config.mappings.push(mapping);

      // Update lookup map
      const key = `${mapping.source_model}:${mapping.field_name}`;
      mappingLookup.set(key, mapping);

      details.push({ mapping: mappingName, status: 'added', message: `Type: ${mapping.mapping_type || 'fk'}` });
      successCount++;
    } catch (error) {
      details.push({ mapping: mappingName, status: 'failed', message: String(error) });
      failCount++;
    }
  }

  // Write updated config to file if any additions were made
  if (successCount > 0) {
    try {
      const configPath = getConfigFilePath();
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.error(`[JsonFkConfig] Added ${successCount} mappings (${skipCount} skipped)`);
    } catch (error) {
      console.error(`[JsonFkConfig] Failed to write config: ${error}`);
    }
  }

  return {
    successCount,
    skipCount,
    failCount,
    details,
    backupPath,
  };
}
