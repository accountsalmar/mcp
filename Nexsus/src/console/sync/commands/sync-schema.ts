/**
 * Sync Schema Command
 *
 * Syncs schema to vector database from Excel or Odoo.
 * Replaces the schema_sync MCP tool.
 *
 * Two modes:
 * - Excel (default): Syncs from nexsus_schema_v2_generated.xlsx
 * - Odoo: Fetches directly from Odoo API (ir.model, ir.model.fields)
 */

import ora from 'ora';
import chalk from 'chalk';
import { initializeVectorClient, getQdrantClient } from '../../../common/services/vector-client.js';
import { initializeEmbeddingService } from '../../../common/services/embedding-service.js';
import { syncSchemaToUnified } from '../../../common/services/unified-schema-sync.js';
import { syncSchemaFromOdoo } from '../../../common/services/odoo-schema-sync.js';
import { clearSchemaCache } from '../../../common/services/schema-query-service.js';
import { UNIFIED_CONFIG } from '../../../common/constants.js';

interface SyncSchemaOptions {
  source: 'excel' | 'odoo';
  force: boolean;
  dryRun: boolean;
}

export async function syncSchemaCommand(options: SyncSchemaOptions): Promise<void> {
  const startTime = Date.now();

  console.log(chalk.bold('\n='.repeat(60)));
  console.log(chalk.bold.cyan('NEXSUS SYNC - Schema Sync'));
  console.log(chalk.bold('='.repeat(60)));
  console.log();

  console.log(chalk.white('Source:'), chalk.yellow(options.source));
  console.log(chalk.white('Force recreate:'), options.force ? chalk.red('Yes') : chalk.green('No'));
  if (options.source === 'odoo') {
    console.log(chalk.white('Dry run:'), options.dryRun ? chalk.yellow('Yes (preview only)') : chalk.green('No'));
  }
  console.log();

  // Initialize services
  const spinner = ora('Initializing services...').start();

  try {
    await initializeVectorClient();
    const embeddingInit = initializeEmbeddingService();
    if (!embeddingInit) {
      spinner.fail('Failed to initialize embedding service. Check VOYAGE_API_KEY.');
      process.exit(1);
    }
    spinner.succeed('Services initialized');
  } catch (error) {
    spinner.fail(`Failed to initialize: ${error}`);
    process.exit(1);
  }

  // Get current schema count
  const client = getQdrantClient();
  const beforeCount = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
    filter: {
      must: [{ key: 'point_type', match: { value: 'schema' } }],
    },
    exact: true,
  });
  console.log(chalk.white('Current schema points:'), chalk.cyan(beforeCount.count.toLocaleString()));

  // Delete existing schema if force
  if (options.force && beforeCount.count > 0) {
    spinner.start('Deleting existing schema points...');
    await client.delete(UNIFIED_CONFIG.COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }],
      },
    });
    spinner.succeed(`Deleted ${beforeCount.count} existing schema points`);
  }

  // Run schema sync
  console.log(chalk.bold('\n' + '-'.repeat(60)));
  console.log(chalk.bold.cyan('Syncing Schema...'));
  console.log(chalk.bold('-'.repeat(60) + '\n'));

  try {
    if (options.source === 'excel') {
      // Use unified schema sync (from Excel)
      console.log(chalk.cyan('Source: Excel file (nexsus_schema_v2_generated.xlsx)'));
      await syncSchemaToUnified();

      // G13: Auto-clear schema cache so pipeline uses fresh schema
      clearSchemaCache();
      console.log(chalk.green('Schema cache cleared - pipeline will use fresh schema'));
    } else {
      // Direct Odoo sync - fetches from Odoo API and syncs to Qdrant
      console.log(chalk.cyan('Source: Odoo API (ir.model, ir.model.fields)'));
      console.log(chalk.dim('This may take several minutes for large schemas...'));
      console.log();

      const syncResult = await syncSchemaFromOdoo({
        forceRecreate: options.force,
        dryRun: options.dryRun,
        onProgress: (phase, current, total) => {
          if (phase === 'fetching') {
            console.log(chalk.cyan('Fetching schema from Odoo...'));
          } else if (phase === 'transforming') {
            console.log(chalk.cyan(`Transforming ${total} fields...`));
          } else if (phase === 'embedding') {
            const progress = total > 0 ? ((current / total) * 100).toFixed(1) : '0';
            process.stdout.write(`\r${chalk.cyan('Embedding:')} ${progress}% (${current}/${total})   `);
          } else if (phase === 'uploading') {
            const progress = total > 0 ? ((current / total) * 100).toFixed(1) : '0';
            process.stdout.write(`\r${chalk.cyan('Uploading:')} ${progress}% (${current}/${total})   `);
          }
        },
      });

      console.log(); // New line after progress

      if (syncResult.success) {
        console.log(chalk.green('✓ Direct Odoo sync complete'));
        console.log(chalk.white('  Models found:'), chalk.cyan(syncResult.models_found));
        console.log(chalk.white('  FK fields found:'), chalk.cyan(syncResult.fk_fields_found));
        console.log(chalk.white('  Fields uploaded:'), chalk.cyan(syncResult.uploaded));
        console.log(chalk.white('  Duration:'), chalk.cyan(`${(syncResult.durationMs / 1000).toFixed(1)}s`));
      } else {
        console.log(chalk.red('✗ Direct Odoo sync failed'));
        if (syncResult.errors && syncResult.errors.length > 0) {
          for (const error of syncResult.errors.slice(0, 5)) {
            console.log(chalk.red(`  - ${error}`));
          }
          if (syncResult.errors.length > 5) {
            console.log(chalk.red(`  ... and ${syncResult.errors.length - 5} more errors`));
          }
        }
        process.exit(1);
      }
    }

    // Get final count
    const afterCount = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
      filter: {
        must: [{ key: 'point_type', match: { value: 'schema' } }],
      },
      exact: true,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Display results
    console.log(chalk.bold('\n' + '='.repeat(60)));
    console.log(chalk.bold.green('SCHEMA SYNC COMPLETE'));
    console.log(chalk.bold('='.repeat(60)));
    console.log();

    console.log(chalk.white('Duration:'), chalk.cyan(`${duration}s`));
    console.log(chalk.white('Schema points:'), chalk.cyan(`${beforeCount.count} → ${afterCount.count}`));
    console.log(chalk.white('Net change:'), afterCount.count > beforeCount.count
      ? chalk.green(`+${(afterCount.count - beforeCount.count).toLocaleString()}`)
      : chalk.yellow((afterCount.count - beforeCount.count).toLocaleString()));
    console.log();

  } catch (error) {
    console.error(chalk.red('\nSchema sync failed:'), error);
    process.exit(1);
  }
}
