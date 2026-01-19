/**
 * Refresh Schema MCP Tool
 *
 * Allows on-demand schema cache refresh via Claude without server restart.
 * Essential for Railway users who can't run CLI commands.
 *
 * Two modes:
 * 1. Cache refresh (default): Reloads schema from Excel files into memory caches
 * 2. Direct Odoo sync: Fetches schema directly from Odoo API and syncs to Qdrant
 *
 * Created as part of Stage 2: Core/Pipeline Separation
 * Updated for Direct Odoo-to-Vector Schema Refresh
 * See docs/plans/core-pipeline-separation.md
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { refreshAllCaches, getCacheStatus, type RefreshResult } from '../services/schema-cache-manager.js';
import { syncSchemaFromOdoo, type OdooSchemaSyncResult } from '../services/odoo-schema-sync.js';
import { refreshSchemaFromQdrant, getSchemaSource } from '../services/schema-lookup.js';

/**
 * Schema for refresh_schema tool input
 */
export const RefreshSchemaSchema = z.object({
  /**
   * Whether to include detailed cache status in the response
   */
  include_status: z
    .boolean()
    .default(false)
    .describe('Include detailed cache status from all services'),

  /**
   * Sync schema directly from Odoo API to Qdrant (bypasses Excel file)
   */
  sync_from_odoo: z
    .boolean()
    .default(false)
    .describe('Sync schema directly from Odoo API to Qdrant instead of refreshing Excel caches'),

  /**
   * Force recreate schema points (only used with sync_from_odoo)
   */
  force_recreate: z
    .boolean()
    .default(false)
    .describe('Clear existing schema points before syncing (only with sync_from_odoo)'),
});

/**
 * Register the refresh_schema tool
 *
 * @param server - MCP server instance to register the tool on
 */
export function registerRefreshSchemaTool(server: McpServer): void {
  console.error('[RefreshSchema] Registered tool: refresh_schema');
  server.tool(
    'refresh_schema',
    `Refresh schema caches or sync directly from Odoo.

**Two Modes:**

**1. Cache Refresh (default):**
- Clears in-memory caches and reloads from Excel files
- Fast (~100ms), no Qdrant writes
- Use when Excel file was updated locally

**2. Direct Odoo Sync (sync_from_odoo=true):**
- Fetches schema directly from Odoo API (ir.model, ir.model.fields)
- Embeds and uploads to Qdrant (~5-10 min for 17k+ fields)
- Use on Railway or when Odoo schema changed

**When to use:**
- Cache refresh: After modifying schema Excel files
- Odoo sync: When Odoo schema changed (new models/fields)

**Examples:**
\`{ }\` - Refresh caches from Excel
\`{ "sync_from_odoo": true }\` - Sync from Odoo API
\`{ "sync_from_odoo": true, "force_recreate": true }\` - Full resync from Odoo`,
    RefreshSchemaSchema.shape,
    async ({ include_status, sync_from_odoo, force_recreate }) => {
      const startTime = Date.now();

      try {
        // ========================================
        // MODE 1: DIRECT ODOO SYNC
        // ========================================
        if (sync_from_odoo) {
          console.error('[RefreshSchema] Mode: Direct Odoo Sync');

          const syncResult: OdooSchemaSyncResult = await syncSchemaFromOdoo({
            forceRecreate: force_recreate,
          });

          // After successful sync, refresh the in-memory schema lookup from Qdrant
          let schemaLookupRefreshed = false;
          if (syncResult.success) {
            console.error('[RefreshSchema] Refreshing schema lookup cache from Qdrant...');
            schemaLookupRefreshed = await refreshSchemaFromQdrant();
          }

          const lines: string[] = [];

          // Header
          if (syncResult.success) {
            lines.push('# Schema Sync from Odoo Complete');
          } else {
            lines.push('# Schema Sync from Odoo Failed');
          }
          lines.push('');
          lines.push(`**Source:** Odoo API (ir.model, ir.model.fields)`);
          lines.push(`**Duration:** ${(syncResult.durationMs / 1000).toFixed(1)}s`);
          lines.push(`**Force Recreate:** ${force_recreate ? 'Yes' : 'No'}`);
          lines.push('');

          // Statistics
          lines.push('## Sync Statistics');
          lines.push(`- **Models Found:** ${syncResult.models_found}`);
          lines.push(`- **FK Fields Found:** ${syncResult.fk_fields_found}`);
          lines.push(`- **Fields Uploaded:** ${syncResult.uploaded}`);
          lines.push(`- **Failed:** ${syncResult.failed}`);
          lines.push('');

          // Errors if any
          if (syncResult.errors && syncResult.errors.length > 0) {
            lines.push('## Errors');
            for (const error of syncResult.errors.slice(0, 10)) {
              lines.push(`- ${error}`);
            }
            if (syncResult.errors.length > 10) {
              lines.push(`- ... and ${syncResult.errors.length - 10} more`);
            }
            lines.push('');
          }

          // Schema lookup status
          if (schemaLookupRefreshed) {
            lines.push('## Schema Lookup Cache');
            lines.push(`- **Source:** Qdrant (${getSchemaSource()})`);
            lines.push('- **Status:** Refreshed successfully');
            lines.push('- **Model filter:** Now works with fresh Odoo schema');
            lines.push('');
          }

          // Usage hint
          lines.push('---');
          if (syncResult.success) {
            lines.push('*Schema synced directly from Odoo. model_filter validation now uses Qdrant data.*');
          } else {
            lines.push('*Sync failed. Check Odoo connection and credentials.*');
          }

          return {
            content: [{
              type: 'text' as const,
              text: lines.join('\n')
            }]
          };
        }

        // ========================================
        // MODE 2: CACHE REFRESH (DEFAULT)
        // ========================================
        console.error('[RefreshSchema] Mode: Cache Refresh from Excel');
        const result: RefreshResult = refreshAllCaches();

        const lines: string[] = [];

        // Header with timing
        lines.push('# Schema Cache Refresh Complete');
        lines.push('');
        lines.push(`**Source:** Excel file (nexsus_schema_v2_generated.xlsx)`);
        lines.push(`**Duration:** ${result.duration_ms}ms`);
        lines.push(`**Caches Cleared:** ${result.caches_cleared.length}`);
        lines.push('');

        // Model changes
        lines.push('## Models');
        lines.push(`- **Before:** ${result.models_before}`);
        lines.push(`- **After:** ${result.models_after}`);

        if (result.models_added.length > 0) {
          lines.push(`- **Added:** ${result.models_added.join(', ')}`);
        }
        if (result.models_removed.length > 0) {
          lines.push(`- **Removed:** ${result.models_removed.join(', ')}`);
        }
        lines.push('');

        // Field stats
        lines.push('## Fields Loaded');
        lines.push(`- **Total Fields:** ${result.fields_loaded}`);
        lines.push(`- **FK Fields:** ${result.fk_fields_loaded}`);
        lines.push('');

        // Caches cleared
        lines.push('## Caches Cleared');
        for (const cache of result.caches_cleared) {
          lines.push(`- ${cache}`);
        }
        lines.push('');

        // Auto-generated knowledge (Stage 10-12 - placeholder for future)
        if (result.auto_knowledge) {
          lines.push('## Auto-Generated Knowledge');
          lines.push('');
          lines.push('### Field Knowledge (Level 4)');
          lines.push(`- **Total Fields:** ${result.auto_knowledge.field_knowledge.total_fields}`);
          lines.push(`- **With Data Format:** ${result.auto_knowledge.field_knowledge.with_data_format}`);
          lines.push(`- **With Field Knowledge:** ${result.auto_knowledge.field_knowledge.with_field_knowledge}`);
          lines.push(`- **With LLM Notes:** ${result.auto_knowledge.field_knowledge.with_llm_notes}`);
          lines.push('');
          lines.push('### Model Knowledge (Level 3)');
          lines.push(`- **Total Models:** ${result.auto_knowledge.model_knowledge.total_models}`);
          lines.push(`- **With Purpose Pattern:** ${result.auto_knowledge.model_knowledge.with_purpose_pattern}`);
          lines.push(`- **With FK Relationships:** ${result.auto_knowledge.model_knowledge.with_fk_relationships}`);
          lines.push(`- **Payload Enabled:** ${result.auto_knowledge.model_knowledge.payload_enabled}`);
          lines.push('');
        }

        // Optional detailed status
        if (include_status) {
          const status = getCacheStatus();
          lines.push('## Cache Status (After Refresh)');
          lines.push(`**Total Entries:** ${status.total_entries}`);
          lines.push(`**Timestamp:** ${status.timestamp}`);
          lines.push('');

          lines.push('### Services');
          for (const service of status.services) {
            lines.push(`**${service.name}:**`);
            lines.push('```json');
            lines.push(JSON.stringify(service.stats, null, 2));
            lines.push('```');
            lines.push('');
          }
        }

        // Usage hint
        lines.push('---');
        lines.push('*Schema caches refreshed. Queries will now use updated schema.*');
        lines.push('');
        lines.push('*Tip: Use `{ "sync_from_odoo": true }` to sync directly from Odoo API.*');

        return {
          content: [{
            type: 'text' as const,
            text: lines.join('\n')
          }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const duration = Date.now() - startTime;

        return {
          content: [{
            type: 'text' as const,
            text: `# Schema Refresh Failed\n\n` +
              `**Mode:** ${sync_from_odoo ? 'Odoo Sync' : 'Cache Refresh'}\n` +
              `**Error:** ${errorMessage}\n\n` +
              `**Duration:** ${duration}ms\n\n` +
              `**Troubleshooting:**\n` +
              (sync_from_odoo
                ? `- Check ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD\n` +
                  `- Verify Odoo API is accessible\n` +
                  `- Check QDRANT_HOST and VOYAGE_API_KEY\n`
                : `- Check that Excel files exist in project root\n` +
                  `- Verify file permissions\n`) +
              `- Check server logs for detailed error\n\n` +
              `If this persists, try restarting the server.`
          }]
        };
      }
    }
  );
}
