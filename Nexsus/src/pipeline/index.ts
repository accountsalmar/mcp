/**
 * Pipeline Section - Public Exports
 *
 * This section handles all data extraction, transformation, and loading (ETL).
 * It is isolated from the query sections (semantic, exact) to maintain clean architecture.
 *
 * IMPORTANT: Do not import this module from src/semantic/, src/exact/, or src/console/index.ts
 */

// =============================================================================
// EMBEDDING SERVICE
// =============================================================================
export {
  initializeEmbeddingService,
  isEmbeddingServiceAvailable,
  embed,
  embedBatch,
} from './services/embedding-service.js';

// =============================================================================
// ODOO CLIENT
// =============================================================================
export {
  getOdooClient,
  fetchAllLeads,
  fetchLeadById,
  LEAD_FIELDS,
} from './services/odoo-client.js';

// =============================================================================
// DATA SYNC
// =============================================================================
export {
  syncPipelineData,
  previewPipelineTransform,
  getPipelineSyncStatus,
  clearPipelineSyncMetadata,
} from './services/pipeline-data-sync.js';

export {
  transformPipelineRecords,
  transformPipelineRecord,
  validateModelForPipeline,
  getTransformStats,
  isEmptyValue,
  extractDisplayValue,
  extractFkId,
  buildVectorText,
  buildPayload,
} from './services/pipeline-data-transformer.js';

// =============================================================================
// CASCADE SYNC
// =============================================================================
export {
  syncWithCascade,
  formatCascadeResult,
  type CascadeSyncResult,
} from './services/cascade-sync.js';

// =============================================================================
// SCHEMA SYNC
// =============================================================================
export {
  syncSchemaFromOdoo,
  type OdooSchemaSyncResult,
} from './services/odoo-schema-sync.js';

export {
  syncSchemaToUnified,
  getUnifiedSchemaSyncStatus,
  isUnifiedSchemaSyncRunning,
  clearUnifiedSchemaPoints,
  type SyncSchemaToUnifiedOptions,
} from './services/unified-schema-sync.js';

// =============================================================================
// SYNC METADATA
// =============================================================================
export {
  loadSyncMetadata,
  saveSyncMetadata,
  clearSyncMetadata,
  getLastDataSyncTimestamp,
  saveDataSyncMetadata,
  clearDataSyncMetadata,
  getDataSyncMetadata,
  getAllDataSyncMetadata,
  findMaxWriteDate,
  generateChecksum,
  type SyncMetadata,
  type ChangeSet,
} from './services/sync-metadata.js';

// =============================================================================
// DEAD LETTER QUEUE
// =============================================================================
export {
  addToDLQ,
  getDLQStats,
  clearDLQ,
  getDLQRecords,
} from './services/dlq.js';

// =============================================================================
// FK DEPENDENCY DISCOVERY
// =============================================================================
export {
  getFkFieldsForModel,
  getFkFieldNames,
  extractFkDependencies,
  checkSyncedFkTargets,
  checkAllSyncedTargets,
  summarizeDependencies,
  filterMissingDependencies,
  type FkFieldInfo,
  type FkDependency,
  type SyncedTargetsResult,
} from './services/fk-dependency-discovery.js';

// =============================================================================
// INDEX SERVICE
// =============================================================================
export {
  ensureModelIndexes,
  ensureBaseIndexes,
} from './services/index-service.js';
