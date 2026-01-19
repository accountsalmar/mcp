/**
 * Schema Cache Manager
 *
 * Central coordination service for all schema-related caches.
 * Provides single-function cache clearing and status reporting.
 *
 * Created as part of Stage 2: Dynamic Schema Architecture
 * Adapted from Nexsus1 with auto-knowledge removed (deferred to Stage 10-12)
 * See docs/plans/core-pipeline-separation.md
 */

// Cache clear functions from all services
import { clearNexsusSchemaCache, getNexsusSchemaStats, loadNexsusSchema } from './excel-schema-loader.js';
import { clearSchemaLookup, initializeSchemaLookup, getAllModelNames as getLookupModels } from './schema-lookup.js';
import { clearPipelineCache, getPipelineStats } from './excel-pipeline-loader.js';
import { clearSchemaCache, getSchemaCacheStats } from './schema-query-service.js';
import { clearGraphCache, getGraphCacheStats } from './knowledge-graph.js';
import { clearCache, getCacheStats } from './cache-service.js';
import { clearCoordinateLookup } from './data-transformer.js';
import { clearSyncMetadata } from './sync-metadata.js';

/**
 * Result of refreshing all caches
 */
export interface RefreshResult {
  /** Time taken in milliseconds */
  duration_ms: number;

  /** Number of models before refresh */
  models_before: number;

  /** Number of models after refresh */
  models_after: number;

  /** Models added during refresh */
  models_added: string[];

  /** Models removed during refresh */
  models_removed: string[];

  /** Total fields loaded */
  fields_loaded: number;

  /** FK fields loaded */
  fk_fields_loaded: number;

  /** List of caches that were cleared */
  caches_cleared: string[];

  /** Auto-generated knowledge stats (Stage 10-12 - not yet implemented) */
  auto_knowledge?: {
    field_knowledge: {
      total_fields: number;
      with_data_format: number;
      with_field_knowledge: number;
      with_llm_notes: number;
    };
    model_knowledge: {
      total_models: number;
      with_purpose_pattern: number;
      with_fk_relationships: number;
      payload_enabled: number;
    };
  };
}

/**
 * Status of all caches
 */
export interface CacheStatus {
  /** Stats from each cache service */
  services: {
    name: string;
    stats: Record<string, unknown>;
  }[];

  /** Total entries across all caches */
  total_entries: number;

  /** Timestamp of status check */
  timestamp: string;
}

/**
 * List of all cache names for tracking
 */
const CACHE_NAMES = [
  'nexsus-schema-cache',      // excel-schema-loader.ts
  'schema-lookup',            // schema-lookup.ts
  'pipeline-cache',           // excel-pipeline-loader.ts
  'schema-query-cache',       // schema-query-service.ts
  'graph-cache',              // knowledge-graph.ts
  'search-cache',             // cache-service.ts
  'coordinate-lookup-cache',  // data-transformer.ts
  'sync-metadata',            // sync-metadata.ts
] as const;

/**
 * Get models currently loaded in schema lookup (for change detection)
 */
function getLoadedModels(): Set<string> {
  try {
    // Use nexus schema stats which returns modelNames
    const nexsusStats = getNexsusSchemaStats();
    if (nexsusStats && nexsusStats.modelNames && nexsusStats.modelNames.length > 0) {
      return new Set(nexsusStats.modelNames);
    }
    // Fallback to schema-query-service if nexus stats not available
    const stats = getSchemaCacheStats();
    if (stats && stats.modelNames && stats.modelNames.length > 0) {
      return new Set(stats.modelNames);
    }
  } catch {
    // Ignore errors - cache may not be initialized
  }
  return new Set();
}

/**
 * Count FK fields from loaded schema
 */
function countFkFields(): number {
  try {
    const schemas = loadNexsusSchema();
    return schemas.filter(s => s.field_type === 'many2one').length;
  } catch {
    return 0;
  }
}

/**
 * Refresh ALL schema-related caches
 *
 * This is the primary function for ensuring all caches are synchronized.
 * Call this after:
 * - Syncing schema from Excel
 * - Adding new models/fields
 * - When queries return stale results
 *
 * @returns RefreshResult with timing, changes, and stats
 */
export function refreshAllCaches(): RefreshResult {
  const startTime = Date.now();
  console.error('[CacheManager] Starting full cache refresh...');

  // Capture models before refresh for change detection
  const modelsBefore = getLoadedModels();
  const modelsBeforeCount = modelsBefore.size;

  // Clear all caches in dependency order
  // (clear dependent caches first, then base caches)
  const clearedCaches: string[] = [];

  try {
    // 1. Clear search/query caches (depend on schema)
    clearCache();
    clearedCaches.push('search-cache');

    // 2. Clear graph cache (depends on schema)
    clearGraphCache();
    clearedCaches.push('graph-cache');

    // 3. Clear coordinate lookup (depends on schema)
    clearCoordinateLookup();
    clearedCaches.push('coordinate-lookup-cache');

    // 4. Clear schema query cache
    clearSchemaCache();
    clearedCaches.push('schema-query-cache');

    // 5. Clear pipeline cache
    clearPipelineCache();
    clearedCaches.push('pipeline-cache');

    // 6. Clear sync metadata
    clearSyncMetadata();
    clearedCaches.push('sync-metadata');

    // 7. Clear and reload schema caches
    clearNexsusSchemaCache();
    clearedCaches.push('nexsus-schema-cache');

    // 8. Refresh schema lookup (clear + reinitialize)
    clearSchemaLookup();
    initializeSchemaLookup();
    clearedCaches.push('schema-lookup');

    // Count loaded fields/FKs after refresh
    const fieldsLoaded = loadNexsusSchema().length;
    const fkFieldsLoaded = countFkFields();

    // Capture models after refresh
    const modelsAfter = getLoadedModels();

    // Calculate changes
    const modelsAdded: string[] = [];
    const modelsRemoved: string[] = [];

    for (const model of modelsAfter) {
      if (!modelsBefore.has(model)) {
        modelsAdded.push(model);
      }
    }

    for (const model of modelsBefore) {
      if (!modelsAfter.has(model)) {
        modelsRemoved.push(model);
      }
    }

    const duration = Date.now() - startTime;

    console.error(`[CacheManager] Refresh complete in ${duration}ms`);
    console.error(`[CacheManager] Cleared ${clearedCaches.length} caches`);
    console.error(`[CacheManager] Models: ${modelsBeforeCount} → ${modelsAfter.size}`);
    console.error(`[CacheManager] Fields loaded: ${fieldsLoaded}, FK fields: ${fkFieldsLoaded}`);

    if (modelsAdded.length > 0) {
      console.error(`[CacheManager] Models added: ${modelsAdded.join(', ')}`);
    }
    if (modelsRemoved.length > 0) {
      console.error(`[CacheManager] Models removed: ${modelsRemoved.join(', ')}`);
    }

    return {
      duration_ms: duration,
      models_before: modelsBeforeCount,
      models_after: modelsAfter.size,
      models_added: modelsAdded,
      models_removed: modelsRemoved,
      fields_loaded: fieldsLoaded,
      fk_fields_loaded: fkFieldsLoaded,
      caches_cleared: clearedCaches,
      // auto_knowledge: undefined - will be added in Stage 10-12
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CacheManager] Refresh failed after ${duration}ms:`, error);

    // Return partial result on error
    return {
      duration_ms: duration,
      models_before: modelsBeforeCount,
      models_after: 0,
      models_added: [],
      models_removed: [],
      fields_loaded: 0,
      fk_fields_loaded: 0,
      caches_cleared: clearedCaches,
    };
  }
}

/**
 * Get status of all caches
 *
 * @returns CacheStatus with stats from each service
 */
export function getCacheStatus(): CacheStatus {
  const services: CacheStatus['services'] = [];
  let totalEntries = 0;

  // Collect stats from each service that has a stats function
  try {
    const nexsusStats = getNexsusSchemaStats();
    services.push({ name: 'nexsus-schema', stats: nexsusStats });
    totalEntries += nexsusStats.totalFields || 0;
  } catch {
    services.push({ name: 'nexsus-schema', stats: { error: 'not initialized' } });
  }

  try {
    const pipelineStats = getPipelineStats();
    services.push({ name: 'pipeline', stats: pipelineStats });
    totalEntries += pipelineStats.totalModels || 0;
  } catch {
    services.push({ name: 'pipeline', stats: { error: 'not initialized' } });
  }

  try {
    const schemaQueryStats = getSchemaCacheStats();
    services.push({ name: 'schema-query', stats: schemaQueryStats });
    totalEntries += schemaQueryStats.cachedModels || 0;
  } catch {
    services.push({ name: 'schema-query', stats: { error: 'not initialized' } });
  }

  try {
    const graphStats = getGraphCacheStats();
    services.push({ name: 'knowledge-graph', stats: graphStats });
    totalEntries += graphStats.size || 0;
  } catch {
    services.push({ name: 'knowledge-graph', stats: { error: 'not initialized' } });
  }

  try {
    const cacheStats = getCacheStats();
    services.push({ name: 'search-cache', stats: cacheStats });
    totalEntries += cacheStats.size || 0;
  } catch {
    services.push({ name: 'search-cache', stats: { error: 'not initialized' } });
  }

  return {
    services,
    total_entries: totalEntries,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clear all caches without reloading
 *
 * Use this when you just want to clear caches but will reload later.
 * For most use cases, prefer refreshAllCaches() which also reloads.
 */
export function clearAllCaches(): string[] {
  const clearedCaches: string[] = [];

  clearCache();
  clearedCaches.push('search-cache');

  clearGraphCache();
  clearedCaches.push('graph-cache');

  clearCoordinateLookup();
  clearedCaches.push('coordinate-lookup-cache');

  clearSchemaCache();
  clearedCaches.push('schema-query-cache');

  clearPipelineCache();
  clearedCaches.push('pipeline-cache');

  clearSyncMetadata();
  clearedCaches.push('sync-metadata');

  clearNexsusSchemaCache();
  clearedCaches.push('nexsus-schema-cache');

  clearSchemaLookup();
  clearedCaches.push('schema-lookup');

  console.error(`[CacheManager] Cleared ${clearedCaches.length} caches (no reload)`);

  return clearedCaches;
}
