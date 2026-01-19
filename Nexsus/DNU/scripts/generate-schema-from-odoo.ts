#!/usr/bin/env npx tsx
/**
 * Generate V2 Schema Excel from Odoo
 *
 * This script fetches all field metadata from Odoo's ir.model and ir.model.fields
 * tables, generates V2 format UUIDs, and writes to an Excel file.
 *
 * Usage:
 *   npx tsx scripts/generate-schema-from-odoo.ts
 *
 * Output:
 *   nexsus Schema V2.xlsx
 *
 * Part of Stage 0: Auto-Generate Schema from Odoo
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { OdooClient } from '../src/services/odoo-client.js';
import {
  OdooSchemaFetcher,
  V2SchemaRow,
} from '../src/services/odoo-schema-fetcher.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const OUTPUT_FILE = 'nexsus_schema_v2_generated.xlsx';
const SHEET_NAME = 'Schema';

// ============================================================================
// EXCEL WRITER
// ============================================================================

/**
 * Write V2 schema rows to Excel file
 */
function writeExcel(rows: V2SchemaRow[], outputPath: string): void {
  console.error(`[ExcelWriter] Writing ${rows.length} rows to ${outputPath}...`);

  // Prepare data for Excel
  // Column A: Qdrant ID, Column B: Semantic Text, Column C: Payload
  const excelData: string[][] = [];

  // Add header row
  excelData.push(['Qdrant ID', 'Vector', 'Payload']);

  // Add data rows
  for (const row of rows) {
    excelData.push([
      row.qdrant_id,
      row.semantic_text,
      row.raw_payload,
    ]);
  }

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 40 },  // Qdrant ID
    { wch: 100 }, // Semantic Text
    { wch: 150 }, // Payload
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);

  // Write to file
  XLSX.writeFile(workbook, outputPath);

  console.error(`[ExcelWriter] Excel file written successfully`);
}

// ============================================================================
// STATISTICS
// ============================================================================

interface SchemaStats {
  totalFields: number;
  totalModels: number;
  fieldTypeBreakdown: Record<string, number>;
  storedFields: number;
  computedFields: number;
  fkFields: number;
  v2UuidSample: string[];
}

function calculateStats(rows: V2SchemaRow[]): SchemaStats {
  const models = new Set<string>();
  const fieldTypes: Record<string, number> = {};
  let storedCount = 0;
  let computedCount = 0;
  let fkCount = 0;

  for (const row of rows) {
    models.add(row.model_name);

    fieldTypes[row.field_type] = (fieldTypes[row.field_type] || 0) + 1;

    if (row.stored) {
      storedCount++;
    } else {
      computedCount++;
    }

    if (row.fk_target_model) {
      fkCount++;
    }
  }

  // Sample V2 UUIDs
  const v2UuidSample = rows.slice(0, 5).map(r => r.qdrant_id);

  return {
    totalFields: rows.length,
    totalModels: models.size,
    fieldTypeBreakdown: fieldTypes,
    storedFields: storedCount,
    computedFields: computedCount,
    fkFields: fkCount,
    v2UuidSample,
  };
}

function printStats(stats: SchemaStats): void {
  console.log('\n========================================');
  console.log('  SCHEMA GENERATION COMPLETE');
  console.log('========================================\n');

  console.log(`Total Fields:     ${stats.totalFields.toLocaleString()}`);
  console.log(`Total Models:     ${stats.totalModels.toLocaleString()}`);
  console.log(`Stored Fields:    ${stats.storedFields.toLocaleString()}`);
  console.log(`Computed Fields:  ${stats.computedFields.toLocaleString()}`);
  console.log(`FK Fields:        ${stats.fkFields.toLocaleString()}`);

  console.log('\nField Type Breakdown:');
  const sortedTypes = Object.entries(stats.fieldTypeBreakdown)
    .sort(([, a], [, b]) => b - a);
  for (const [type, count] of sortedTypes.slice(0, 10)) {
    console.log(`  ${type.padEnd(15)} ${count.toLocaleString()}`);
  }

  console.log('\nSample V2 UUIDs (first 5):');
  for (const uuid of stats.v2UuidSample) {
    console.log(`  ${uuid}`);
  }

  console.log('\n========================================\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  Stage 0: Generate Schema from Odoo');
  console.log('========================================\n');

  // Check environment variables
  const requiredEnvVars = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_PASSWORD'];
  const missing = requiredEnvVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    console.error('Set these in your .env file or environment');
    process.exit(1);
  }

  console.log(`Odoo URL:  ${process.env.ODOO_URL}`);
  console.log(`Odoo DB:   ${process.env.ODOO_DB}`);
  console.log(`Odoo User: ${process.env.ODOO_USERNAME}\n`);

  try {
    // Create Odoo client
    const odooConfig = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      username: process.env.ODOO_USERNAME!,
      password: process.env.ODOO_PASSWORD!,
    };

    const odooClient = new OdooClient(odooConfig);

    // Authenticate
    console.log('[Main] Authenticating with Odoo...');
    const uid = await odooClient.authenticate();
    console.log(`[Main] Authenticated as UID ${uid}\n`);

    // Create fetcher
    const fetcher = new OdooSchemaFetcher(odooClient);

    // Fetch all schema in V2 format
    console.log('[Main] Fetching schema from Odoo...\n');
    const v2Rows = await fetcher.fetchAllSchemaV2();

    // Calculate statistics
    const stats = calculateStats(v2Rows);

    // Write to Excel
    const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);
    writeExcel(v2Rows, outputPath);

    // Print results
    printStats(stats);

    console.log(`Output file: ${outputPath}`);
    console.log(`File size:   ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

    // Test scenarios from plan
    console.log('\n--- Test Scenario Verification ---\n');
    console.log(`T0.1 Fetch ir.model count: ${stats.totalModels} models (PASS if > 400)`);
    console.log(`T0.6 Write Excel file: ${stats.totalFields} rows (Target: ~17,933)`);

    // Find account.move.line fields for T0.2
    const amlFields = v2Rows.filter(r => r.model_name === 'account.move.line');
    console.log(`T0.2 account.move.line fields: ${amlFields.length} (PASS if > 100)`);

    // Check V2 UUID format for T0.3
    const amlPartner = v2Rows.find(r => r.model_name === 'account.move.line' && r.field_name === 'partner_id');
    if (amlPartner) {
      const matchesV2 = amlPartner.qdrant_id.startsWith('00000003-');
      console.log(`T0.3 V2 UUID format: ${amlPartner.qdrant_id} (${matchesV2 ? 'PASS' : 'FAIL'})`);

      // Check graph_ref for FK field
      const hasGraphRef = !!amlPartner.graph_ref;
      console.log(`T0.5 FK has graph_ref: ${hasGraphRef ? 'PASS' : 'FAIL'} (${amlPartner.graph_ref || 'N/A'})`);
    }

    console.log('\n--- Stage 0 Complete ---\n');

  } catch (error) {
    console.error('[Main] Error:', error);
    process.exit(1);
  }
}

// Run
main();
