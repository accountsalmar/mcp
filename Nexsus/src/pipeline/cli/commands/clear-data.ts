/**
 * Clear Data Command
 *
 * Clears all data and knowledge graph points from the vector database
 * while preserving schema points.
 *
 * Usage:
 *   npm run sync -- clear-data --dry-run    # Preview deletion
 *   npm run sync -- clear-data --confirm    # Execute deletion
 */

import ora from 'ora';
import chalk from 'chalk';
import { initializeVectorClient, getQdrantClient, clearDataAndGraph } from '../../../common/services/vector-client.js';
import { UNIFIED_CONFIG } from '../../../common/constants.js';

interface ClearDataOptions {
  dryRun: boolean;
  confirm: boolean;
}

export async function clearDataCommand(options: ClearDataOptions): Promise<void> {
  const startTime = Date.now();

  console.log(chalk.bold('\n' + '='.repeat(60)));
  console.log(chalk.bold.red('NEXSUS SYNC - Clear All Data + Knowledge Graph'));
  console.log(chalk.bold('='.repeat(60)));
  console.log();

  // Safety check: require either --dry-run or --confirm
  if (!options.dryRun && !options.confirm) {
    console.log(chalk.red('ERROR: This is a destructive operation.'));
    console.log();
    console.log('You must specify one of:');
    console.log(chalk.yellow('  --dry-run'), '  Preview what will be deleted');
    console.log(chalk.yellow('  --confirm'), '  Execute the deletion');
    console.log();
    console.log('Example:');
    console.log(chalk.dim('  npm run sync -- clear-data --dry-run'));
    console.log(chalk.dim('  npm run sync -- clear-data --confirm'));
    console.log();
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(chalk.bgYellow.black(' DRY RUN '), 'No data will be deleted');
    console.log();
  } else {
    console.log(chalk.bgRed.white(' DESTRUCTIVE OPERATION '));
    console.log(chalk.red('This will delete ALL data and knowledge graph points!'));
    console.log();
  }

  // Initialize services
  const spinner = ora('Initializing services...').start();

  try {
    await initializeVectorClient();
    spinner.succeed('Services initialized');
  } catch (error) {
    spinner.fail(`Failed to initialize: ${error}`);
    process.exit(1);
  }

  const client = getQdrantClient();

  // Count current points
  spinner.start('Counting current points...');

  const dataCount = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
    exact: true,
  });

  const graphCount = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'graph' } }] },
    exact: true,
  });

  const schemaCount = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'schema' } }] },
    exact: true,
  });

  spinner.succeed('Point counts retrieved');

  console.log();
  console.log(chalk.bold('Current State:'));
  console.log(chalk.white('  Data points:'), chalk.yellow(dataCount.count.toLocaleString()));
  console.log(chalk.white('  Graph points:'), chalk.yellow(graphCount.count.toLocaleString()));
  console.log(chalk.white('  Schema points:'), chalk.green(schemaCount.count.toLocaleString()), chalk.dim('(preserved)'));
  console.log();

  console.log(chalk.bold('Will Delete:'));
  console.log(chalk.red(`  ${dataCount.count.toLocaleString()} data points`));
  console.log(chalk.red(`  ${graphCount.count.toLocaleString()} graph points`));
  console.log(chalk.green(`  0 schema points (preserved)`));
  console.log();

  if (options.dryRun) {
    console.log(chalk.bgYellow.black('\n DRY RUN COMPLETE '));
    console.log(`Would delete ${dataCount.count.toLocaleString()} data + ${graphCount.count.toLocaleString()} graph points.`);
    console.log(`Schema points (${schemaCount.count.toLocaleString()}) would be preserved.`);
    console.log();
    return;
  }

  // Execute deletion
  console.log(chalk.bold.red('Executing deletion...'));
  console.log();

  spinner.start('Deleting data points...');

  try {
    const result = await clearDataAndGraph();
    spinner.succeed(`Cleared ${result.data_deleted.toLocaleString()} data + ${result.graph_deleted.toLocaleString()} graph points`);
  } catch (error) {
    spinner.fail(`Failed to clear: ${error}`);
    process.exit(1);
  }

  // Verify deletion
  spinner.start('Verifying deletion...');

  const dataAfter = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'data' } }] },
    exact: true,
  });

  const graphAfter = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'graph' } }] },
    exact: true,
  });

  const schemaAfter = await client.count(UNIFIED_CONFIG.COLLECTION_NAME, {
    filter: { must: [{ key: 'point_type', match: { value: 'schema' } }] },
    exact: true,
  });

  spinner.succeed('Deletion verified');

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(chalk.bold('\n' + '='.repeat(60)));
  console.log(chalk.bold.green('CLEAR DATA COMPLETE'));
  console.log(chalk.bold('='.repeat(60)));
  console.log();
  console.log(chalk.white('Duration:'), chalk.cyan(`${duration}s`));
  console.log();
  console.log(chalk.bold('Final State:'));
  console.log(chalk.white('  Data points:'), chalk.green(dataAfter.count.toLocaleString()));
  console.log(chalk.white('  Graph points:'), chalk.green(graphAfter.count.toLocaleString()));
  console.log(chalk.white('  Schema points:'), chalk.green(schemaAfter.count.toLocaleString()), chalk.dim('(preserved)'));
  console.log();

  if (dataAfter.count === 0 && graphAfter.count === 0) {
    console.log(chalk.green('✓ All data and graph points cleared successfully.'));
  } else {
    console.log(chalk.yellow('⚠ Some points may remain. Run again if needed.'));
  }
  console.log();
}
