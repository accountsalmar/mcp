/**
 * Discover JSON FK Command
 *
 * Discovers JSON fields that may contain foreign key references.
 * Uses naming patterns and data sampling to calculate confidence scores.
 *
 * Usage:
 *   npx nexsus-sync discover-json-fk
 *   npx nexsus-sync discover-json-fk --model crm.lead
 *   npx nexsus-sync discover-json-fk --min-confidence 0.9
 *   npx nexsus-sync discover-json-fk --add-config
 */

import chalk from 'chalk';
import ora from 'ora';
import {
  detectJsonFkFields,
  generateConfigEntries,
  summarizeDetectionResults,
  type DetectionOptions,
} from '../../services/json-fk-detector.js';
import {
  addJsonFkMappings,
  getJsonFkConfigStatus,
} from '../../../common/services/json-fk-config.js';

interface DiscoverOptions {
  model?: string;
  minConfidence: string;
  addConfig: boolean;
  dryRun: boolean;
  skipSampling: boolean;
  sampleSize: string;
  includeExisting: boolean;
}

export async function discoverJsonFkCommand(options: DiscoverOptions): Promise<void> {
  console.log(chalk.bold('\n' + '='.repeat(60)));
  console.log(chalk.bold.cyan('NEXSUS - Discover JSON FK Fields'));
  console.log(chalk.bold('='.repeat(60)));
  console.log();

  // Show current config status
  const configStatus = getJsonFkConfigStatus();
  console.log(chalk.white('Current Configuration:'));
  console.log(chalk.dim(`  Loaded: ${configStatus.loaded}`));
  console.log(chalk.dim(`  Total mappings: ${configStatus.mappingCount}`));
  console.log(chalk.dim(`  FK mappings: ${configStatus.fkCount}`));
  console.log(chalk.dim(`  Metadata mappings: ${configStatus.metadataCount}`));
  console.log();

  // Parse options
  const minConfidence = parseFloat(options.minConfidence) || 0.5;
  const sampleSize = parseInt(options.sampleSize, 10) || 5;

  // Show options
  console.log(chalk.white('Detection Options:'));
  if (options.model) {
    console.log(chalk.dim(`  Model filter: ${options.model}`));
  }
  console.log(chalk.dim(`  Min confidence: ${(minConfidence * 100).toFixed(0)}%`));
  console.log(chalk.dim(`  Data sampling: ${options.skipSampling ? 'disabled' : `enabled (${sampleSize} records)`}`));
  console.log(chalk.dim(`  Include existing: ${options.includeExisting}`));
  console.log(chalk.dim(`  Add to config: ${options.addConfig}${options.dryRun ? ' (dry-run)' : ''}`));
  console.log();

  // Run detection
  const spinner = ora('Discovering JSON FK fields...').start();

  try {
    const detectionOptions: DetectionOptions = {
      modelFilter: options.model,
      minConfidence,
      skipDataSampling: options.skipSampling,
      sampleSize,
      includeExisting: options.includeExisting,
    };

    const result = await detectJsonFkFields(detectionOptions);
    spinner.succeed(`Found ${result.candidates.length} candidates`);
    console.log();

    // Show errors if any
    if (result.errors.length > 0) {
      console.log(chalk.yellow('Warnings/Errors:'));
      for (const error of result.errors) {
        console.log(chalk.yellow(`  - ${error}`));
      }
      console.log();
    }

    // Show summary
    console.log(chalk.bold.cyan('Detection Results'));
    console.log(chalk.dim('-'.repeat(40)));
    console.log(chalk.white(`  Total candidates: ${result.candidates.length}`));
    console.log(chalk.green(`  FK fields: ${result.fkCount}`));
    console.log(chalk.blue(`  Metadata fields: ${result.metadataCount}`));
    console.log(chalk.dim(`  Skipped (already configured): ${result.skippedCount}`));
    console.log();

    // Show detailed candidates
    if (result.candidates.length > 0) {
      console.log(chalk.bold.cyan('Detected Fields'));
      console.log(chalk.dim('-'.repeat(40)));

      // Group by type
      const fkCandidates = result.candidates.filter((c) => !c.isLikelyMetadata);
      const metadataCandidates = result.candidates.filter((c) => c.isLikelyMetadata);

      if (fkCandidates.length > 0) {
        console.log();
        console.log(chalk.green.bold('  FK Fields (likely foreign key references):'));
        for (const c of fkCandidates) {
          const conf = (c.confidence * 100).toFixed(0);
          const target = c.likelyTargetModel ? ` -> ${c.likelyTargetModel}` : '';
          console.log(chalk.green(`    ${c.sourceModel}.${c.fieldName}`));
          console.log(chalk.dim(`      Confidence: ${conf}% | Method: ${c.detectionMethod}${target}`));
          if (c.reasons.length > 0) {
            console.log(chalk.dim(`      Reasons: ${c.reasons.slice(0, 2).join('; ')}`));
          }
        }
      }

      if (metadataCandidates.length > 0) {
        console.log();
        console.log(chalk.blue.bold('  Metadata Fields (non-FK JSON):'));
        for (const c of metadataCandidates) {
          const conf = (c.confidence * 100).toFixed(0);
          console.log(chalk.blue(`    ${c.sourceModel}.${c.fieldName}`));
          console.log(chalk.dim(`      Confidence: ${conf}% | Method: ${c.detectionMethod}`));
          if (c.reasons.length > 0) {
            console.log(chalk.dim(`      Reasons: ${c.reasons.slice(0, 2).join('; ')}`));
          }
        }
      }
    }

    // Add to config if requested
    if (options.addConfig && result.candidates.length > 0) {
      console.log();
      console.log(chalk.bold.cyan('Adding to Configuration'));
      console.log(chalk.dim('-'.repeat(40)));

      const configEntries = generateConfigEntries(result.candidates, minConfidence);
      console.log(chalk.white(`  Generated ${configEntries.length} config entries`));

      if (options.dryRun) {
        console.log(chalk.yellow('\n  [DRY-RUN] Would add the following mappings:'));
        for (const entry of configEntries) {
          const type = entry.mapping_type || 'fk';
          console.log(chalk.dim(`    - ${entry.source_model}.${entry.field_name} (${type})`));
        }
        console.log();
        console.log(chalk.yellow('  Run without --dry-run to actually add these mappings.'));
      } else {
        const addResult = addJsonFkMappings(configEntries);

        if (addResult.successCount > 0) {
          console.log(chalk.green(`  Added ${addResult.successCount} new mappings`));
          if (addResult.backupPath) {
            console.log(chalk.dim(`  Backup created: ${addResult.backupPath}`));
          }
        }

        if (addResult.skipCount > 0) {
          console.log(chalk.yellow(`  Skipped ${addResult.skipCount} (already exist)`));
        }

        if (addResult.failCount > 0) {
          console.log(chalk.red(`  Failed ${addResult.failCount} entries`));
          for (const detail of addResult.details.filter((d) => d.status === 'failed')) {
            console.log(chalk.red(`    - ${detail.mapping}: ${detail.message}`));
          }
        }
      }
    }

    console.log();

  } catch (error) {
    spinner.fail('Detection failed');
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
