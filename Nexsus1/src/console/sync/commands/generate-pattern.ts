/**
 * Generate Pattern Command
 *
 * CLI command to generate narrative patterns for models using Claude AI.
 * Reads sample records from Excel, sends to Claude for analysis,
 * and saves the resulting pattern to data/patterns/{model}.json.
 *
 * Usage:
 *   npm run sync -- generate-pattern customer
 *   npm run sync -- generate-pattern actual --samples 20
 *   npm run sync -- generate-pattern budget --dry-run
 *   npm run sync -- generate-pattern master --force
 */

import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { getModelFieldsForPipeline } from '../../../common/services/excel-pipeline-loader.js';
import {
  savePattern,
  patternExists,
  getPatternFilePath,
} from '../../../common/services/pattern-service.js';
import type { NarrativePattern, PipelineField } from '../../../common/types.js';
import { PATTERN_CONFIG } from '../../../common/constants.js';

// =============================================================================
// TYPES
// =============================================================================

interface GeneratePatternOptions {
  samples?: string;
  dryRun?: boolean;
  force?: boolean;
}

// =============================================================================
// DATA DIRECTORY RESOLUTION
// =============================================================================

/**
 * Get the samples directory path
 */
function getSamplesDir(): string {
  const paths = [
    path.join(process.cwd(), 'samples'),
    path.join(process.cwd(), '..', 'samples'),
    path.join(__dirname, '..', '..', '..', '..', 'samples'),
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return paths[0]; // Return default even if doesn't exist
}

/**
 * Get data file path for a model
 */
function getDataFilePath(modelName: string): string {
  const samplesDir = getSamplesDir();
  return path.join(samplesDir, `SAMPLE_${modelName}_data.xlsx`);
}

/**
 * Read sample records from Excel file
 */
function readSampleRecords(
  filePath: string,
  maxRecords: number
): Array<Record<string, unknown>> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, {
    raw: true,
    defval: null,
  }) as Array<Record<string, unknown>>;

  // Return limited sample
  return data.slice(0, maxRecords);
}

// =============================================================================
// CLAUDE PROMPT CONSTRUCTION
// =============================================================================

/**
 * Build the system prompt for pattern generation
 */
function buildSystemPrompt(): string {
  return `You are a Business Analyst specializing in data modeling and semantic search optimization.

Your task is to analyze sample records from a data model and create a "narrative pattern" that will be used to generate human-readable text for vector embeddings.

The narrative should:
1. Tell the "story" of what each record represents in business terms
2. Put the most searchable/important terms prominently (names, key identifiers, status)
3. Use natural language, not just field labels
4. Be concise but informative (aim for 100-300 characters for core narrative)

You must return a valid JSON object with the exact structure specified. Do not include any other text before or after the JSON.`;
}

/**
 * Build the user prompt with sample records and field definitions
 */
function buildUserPrompt(
  modelName: string,
  sampleRecords: Array<Record<string, unknown>>,
  fields: PipelineField[]
): string {
  // Build field definitions summary
  const fieldDefs = fields.map((f) => ({
    name: f.field_name,
    label: f.field_label,
    type: f.field_type,
    is_fk: f.field_type === 'many2one' || !!f.fk_location_model,
    fk_target: f.fk_location_model || null,
  }));

  const prompt = `Analyze these ${sampleRecords.length} sample records from the "${modelName}" model:

## Sample Records
\`\`\`json
${JSON.stringify(sampleRecords, null, 2)}
\`\`\`

## Field Definitions
\`\`\`json
${JSON.stringify(fieldDefs, null, 2)}
\`\`\`

## Instructions

Create a narrative pattern for this model. The pattern will be used to convert records into human-readable text for semantic search.

### Template Syntax
- Use {field_name} for direct value insertion
- Use {field_name:formatter} for formatted values

### Available Formatters
- currency: Format as money (e.g., 20000 -> "$20,000.00")
- readable_date: Format as readable date (e.g., 2026-01-01 -> "January 1, 2026")
- name: Extract name from FK tuple (e.g., [123, "Australia"] -> "Australia")
- percentage: Format as percent (e.g., 75 -> "75%")
- count_with_summary: Count array items with summary
- truncate_50: Truncate to 50 chars
- truncate_100: Truncate to 100 chars
- boolean_yes_no: Convert boolean to Yes/No
- default: Default string conversion

### Required JSON Structure
Return ONLY a JSON object with this exact structure:

\`\`\`json
{
  "model": "${modelName}",
  "business_context": "One paragraph explaining what this model represents in business terms",
  "core_narrative": {
    "template": "Your narrative template here with {placeholders} and {field:formatters}",
    "key_fields": ["list", "of", "most", "important", "fields"],
    "field_formatters": {
      "field_name": "formatter_name"
    }
  },
  "dynamic_appendix": {
    "prefix": "Additional details:",
    "exclude": ["id", "record_id", "fields", "to", "exclude", "from", "appendix"]
  },
  "generated_at": "${new Date().toISOString()}",
  "generated_by": "claude",
  "version": ${PATTERN_CONFIG.VERSION}
}
\`\`\`

### Tips
1. Start with the most identifying information (name, ID, title)
2. Include key relationships (customer, partner, account)
3. Add important measures (amount, revenue, quantity) with formatters
4. Put status/state information for context
5. Exclude technical fields (id, create_uid, write_uid, __last_update) from appendix

Return ONLY the JSON object, no additional text.`;

  return prompt;
}

// =============================================================================
// CLAUDE API CALL
// =============================================================================

/**
 * Call Claude API to generate pattern
 */
async function callClaudeForPattern(
  modelName: string,
  sampleRecords: Array<Record<string, unknown>>,
  fields: PipelineField[]
): Promise<NarrativePattern> {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required for pattern generation'
    );
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(modelName, sampleRecords, fields);

  console.error(chalk.gray(`  Sending ${sampleRecords.length} samples to Claude...`));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    temperature: 0.3, // Lower temperature for structured output
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Extract response text
  const responseText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');

  // Parse JSON from response
  let pattern: NarrativePattern;
  try {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    pattern = JSON.parse(jsonMatch[0]) as NarrativePattern;
  } catch (parseError) {
    console.error(chalk.red('\nFailed to parse Claude response as JSON:'));
    console.error(chalk.gray(responseText.substring(0, 500)));
    throw new Error(`Invalid JSON response from Claude: ${parseError}`);
  }

  // Validate required fields
  if (!pattern.model || !pattern.core_narrative?.template) {
    throw new Error('Pattern missing required fields (model, core_narrative.template)');
  }

  // Ensure metadata
  pattern.generated_at = new Date().toISOString();
  pattern.generated_by = 'claude';
  pattern.version = PATTERN_CONFIG.VERSION;

  return pattern;
}

// =============================================================================
// COMMAND HANDLER
// =============================================================================

/**
 * Generate pattern command handler
 */
export async function generatePatternCommand(
  modelName: string,
  options: GeneratePatternOptions
): Promise<void> {
  const spinner = ora();
  const sampleCount = parseInt(options.samples || String(PATTERN_CONFIG.DEFAULT_SAMPLE_COUNT), 10);

  console.log(chalk.blue('\n' + '='.repeat(60)));
  console.log(chalk.blue('NEXSUS - Generate Narrative Pattern'));
  console.log(chalk.blue('='.repeat(60)));
  console.log('');

  console.log(`Model: ${chalk.bold(modelName)}`);
  console.log(`Samples: ${sampleCount}`);
  console.log(`Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`Force overwrite: ${options.force ? 'Yes' : 'No'}`);
  console.log('');

  // Check if pattern already exists
  if (patternExists(modelName) && !options.force) {
    const existingPath = getPatternFilePath(modelName);
    console.log(chalk.yellow(`Pattern already exists: ${existingPath}`));
    console.log(chalk.yellow('Use --force to overwrite'));
    return;
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY environment variable is required'));
    console.error(chalk.gray('Set it in your .env file or export it in your shell'));
    process.exit(1);
  }

  // Step 1: Load schema fields
  spinner.start('Loading schema fields...');
  let fields: PipelineField[];
  try {
    fields = getModelFieldsForPipeline(modelName);
    if (fields.length === 0) {
      spinner.fail(`No schema fields found for model '${modelName}'`);
      console.error(chalk.gray('Ensure the model exists in samples/Nexsus1_schema.xlsx'));
      process.exit(1);
    }
    spinner.succeed(`Loaded ${fields.length} fields for ${modelName}`);
  } catch (error) {
    spinner.fail(`Failed to load schema: ${error}`);
    process.exit(1);
  }

  // Step 2: Read sample records
  spinner.start('Reading sample records...');
  let sampleRecords: Array<Record<string, unknown>>;
  try {
    const dataFilePath = getDataFilePath(modelName);
    sampleRecords = readSampleRecords(dataFilePath, sampleCount);
    if (sampleRecords.length === 0) {
      spinner.fail(`No records found in data file`);
      process.exit(1);
    }
    spinner.succeed(`Read ${sampleRecords.length} sample records from Excel`);
  } catch (error) {
    spinner.fail(`Failed to read data file: ${error}`);
    console.error(chalk.gray(`Expected file: samples/SAMPLE_${modelName}_data.xlsx`));
    process.exit(1);
  }

  // Step 3: Call Claude API
  spinner.start('Generating pattern with Claude AI...');
  let pattern: NarrativePattern;
  try {
    pattern = await callClaudeForPattern(modelName, sampleRecords, fields);
    spinner.succeed('Pattern generated successfully');
  } catch (error) {
    spinner.fail(`Failed to generate pattern: ${error}`);
    process.exit(1);
  }

  // Step 4: Display pattern
  console.log('');
  console.log(chalk.blue('-'.repeat(60)));
  console.log(chalk.blue('Generated Pattern'));
  console.log(chalk.blue('-'.repeat(60)));
  console.log('');

  console.log(chalk.cyan('Business Context:'));
  console.log(chalk.white(`  ${pattern.business_context}`));
  console.log('');

  console.log(chalk.cyan('Core Narrative Template:'));
  console.log(chalk.white(`  ${pattern.core_narrative.template}`));
  console.log('');

  console.log(chalk.cyan('Key Fields:'));
  console.log(chalk.white(`  ${pattern.core_narrative.key_fields.join(', ')}`));
  console.log('');

  console.log(chalk.cyan('Field Formatters:'));
  for (const [field, formatter] of Object.entries(pattern.core_narrative.field_formatters)) {
    console.log(chalk.white(`  ${field}: ${formatter}`));
  }
  console.log('');

  console.log(chalk.cyan('Dynamic Appendix:'));
  console.log(chalk.white(`  Prefix: "${pattern.dynamic_appendix.prefix}"`));
  console.log(chalk.white(`  Exclude: ${pattern.dynamic_appendix.exclude.join(', ')}`));
  console.log('');

  // Step 5: Save pattern (unless dry-run)
  if (options.dryRun) {
    console.log(chalk.yellow('Dry run - pattern not saved'));
    console.log('');
    console.log(chalk.gray('Full pattern JSON:'));
    console.log(chalk.gray(JSON.stringify(pattern, null, 2)));
  } else {
    spinner.start('Saving pattern...');
    try {
      savePattern(pattern);
      const savedPath = getPatternFilePath(modelName);
      spinner.succeed(`Pattern saved to ${savedPath}`);
    } catch (error) {
      spinner.fail(`Failed to save pattern: ${error}`);
      process.exit(1);
    }
  }

  console.log('');
  console.log(chalk.green('='.repeat(60)));
  console.log(chalk.green('Pattern generation complete!'));
  console.log(chalk.green('='.repeat(60)));
  console.log('');

  if (!options.dryRun) {
    console.log('Next steps:');
    console.log(chalk.gray(`  1. Review the pattern in data/patterns/${modelName}.json`));
    console.log(chalk.gray(`  2. Re-sync the model to apply the pattern:`));
    console.log(chalk.gray(`     npm run sync -- sync data ${modelName} --force`));
  }
}
