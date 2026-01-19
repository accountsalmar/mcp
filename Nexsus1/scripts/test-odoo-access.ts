/**
 * Test Odoo Connection and Access Rights
 *
 * This script connects to Odoo using the configured credentials
 * and checks what models/permissions the user has access to.
 */

import 'dotenv/config';
import { OdooClient } from '../src/common/services/odoo-client.js';
import { ODOO_CONFIG } from '../src/common/constants.js';

// Common models to check access for
const MODELS_TO_CHECK = [
  // Core models
  'res.users',
  'res.partner',
  'res.company',

  // CRM
  'crm.lead',
  'crm.stage',
  'crm.team',

  // Sales
  'sale.order',
  'sale.order.line',

  // Purchases
  'purchase.order',
  'purchase.order.line',

  // Accounting
  'account.move',
  'account.move.line',
  'account.account',
  'account.journal',
  'account.analytic.account',
  'account.analytic.line',

  // Products
  'product.product',
  'product.template',
  'product.category',

  // Inventory
  'stock.warehouse',
  'stock.location',
  'stock.picking',
  'stock.move',
  'stock.quant',

  // Projects
  'project.project',
  'project.task',

  // HR
  'hr.employee',
  'hr.department',

  // Custom models (common in DuraCube)
  'x_budget',
  'x_specification',
  'x_lead_source',
  'x_architect',
];

interface AccessResult {
  model: string;
  hasAccess: boolean;
  recordCount?: number;
  error?: string;
}

async function testOdooAccess(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Odoo Connection & Access Rights Test');
  console.log('='.repeat(60));
  console.log();

  // Display configuration
  console.log('Configuration:');
  console.log(`  URL:      ${ODOO_CONFIG.URL}`);
  console.log(`  Database: ${ODOO_CONFIG.DB}`);
  console.log(`  Username: ${ODOO_CONFIG.USERNAME}`);
  console.log(`  Password: ${ODOO_CONFIG.PASSWORD ? '***' + ODOO_CONFIG.PASSWORD.slice(-4) : '(not set)'}`);
  console.log();

  // Check if configuration is complete
  if (!ODOO_CONFIG.URL || !ODOO_CONFIG.DB || !ODOO_CONFIG.USERNAME || !ODOO_CONFIG.PASSWORD) {
    console.error('ERROR: Odoo configuration is incomplete!');
    console.error('Please set these environment variables in .env:');
    console.error('  ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD');
    process.exit(1);
  }

  // Create client
  const client = new OdooClient({
    url: ODOO_CONFIG.URL,
    db: ODOO_CONFIG.DB,
    username: ODOO_CONFIG.USERNAME,
    password: ODOO_CONFIG.PASSWORD,
  });

  // Test authentication
  console.log('Testing authentication...');
  try {
    const uid = await client.authenticate();
    console.log(`SUCCESS: Authenticated as user ID ${uid}`);
    console.log();
  } catch (error) {
    console.error('FAILED: Authentication failed!');
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Get user info
  console.log('Fetching user information...');
  try {
    const users = await client.searchRead<{
      id: number;
      name: string;
      login: string;
      groups_id: number[];
      company_id: [number, string];
    }>('res.users', [['login', '=', ODOO_CONFIG.USERNAME]], ['id', 'name', 'login', 'groups_id', 'company_id']);

    if (users.length > 0) {
      const user = users[0];
      console.log(`  User ID:    ${user.id}`);
      console.log(`  Name:       ${user.name}`);
      console.log(`  Login:      ${user.login}`);
      console.log(`  Company:    ${user.company_id[1]} (ID: ${user.company_id[0]})`);
      console.log(`  Groups:     ${user.groups_id.length} groups assigned`);
      console.log();

      // Fetch group names
      if (user.groups_id.length > 0) {
        console.log('Fetching group memberships...');
        const groups = await client.read<{ id: number; name: string; full_name: string }>(
          'res.groups',
          user.groups_id.slice(0, 50), // Limit to first 50 groups
          ['id', 'name', 'full_name']
        );

        console.log('  Security Groups:');
        for (const group of groups) {
          console.log(`    - ${group.full_name || group.name}`);
        }
        if (user.groups_id.length > 50) {
          console.log(`    ... and ${user.groups_id.length - 50} more groups`);
        }
        console.log();
      }
    }
  } catch (error) {
    console.log(`  Warning: Could not fetch user info: ${error instanceof Error ? error.message : String(error)}`);
    console.log();
  }

  // Test access to models
  console.log('Testing model access...');
  console.log('-'.repeat(60));

  const results: AccessResult[] = [];

  for (const model of MODELS_TO_CHECK) {
    process.stdout.write(`  ${model.padEnd(30)} `);

    try {
      const count = await client.searchCount(model, []);
      results.push({ model, hasAccess: true, recordCount: count });
      console.log(`ACCESS OK (${count.toLocaleString()} records)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if it's an access denied error or model doesn't exist
      if (errorMsg.includes('AccessError') || errorMsg.includes('Access Denied')) {
        results.push({ model, hasAccess: false, error: 'Access Denied' });
        console.log('NO ACCESS');
      } else if (errorMsg.includes('KeyError') || errorMsg.includes("does not exist")) {
        results.push({ model, hasAccess: false, error: 'Model Not Found' });
        console.log('NOT FOUND');
      } else {
        results.push({ model, hasAccess: false, error: errorMsg.slice(0, 50) });
        console.log(`ERROR: ${errorMsg.slice(0, 40)}...`);
      }
    }
  }

  console.log('-'.repeat(60));
  console.log();

  // Summary
  const accessible = results.filter(r => r.hasAccess);
  const denied = results.filter(r => !r.hasAccess && r.error === 'Access Denied');
  const notFound = results.filter(r => !r.hasAccess && r.error === 'Model Not Found');
  const errors = results.filter(r => !r.hasAccess && r.error !== 'Access Denied' && r.error !== 'Model Not Found');

  console.log('Summary:');
  console.log(`  Models with access:    ${accessible.length}`);
  console.log(`  Access denied:         ${denied.length}`);
  console.log(`  Models not found:      ${notFound.length}`);
  console.log(`  Other errors:          ${errors.length}`);
  console.log();

  // List accessible models with record counts
  if (accessible.length > 0) {
    console.log('Accessible Models (by record count):');
    const sorted = accessible.sort((a, b) => (b.recordCount || 0) - (a.recordCount || 0));
    for (const r of sorted) {
      console.log(`  ${r.model.padEnd(30)} ${(r.recordCount || 0).toLocaleString().padStart(10)} records`);
    }
    console.log();
  }

  // List denied models
  if (denied.length > 0) {
    console.log('Access Denied:');
    for (const r of denied) {
      console.log(`  - ${r.model}`);
    }
    console.log();
  }

  console.log('='.repeat(60));
  console.log('Test completed!');
}

// Run the test
testOdooAccess().catch(console.error);
