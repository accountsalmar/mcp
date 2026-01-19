/**
 * Get the most recently created account.account record
 */

import 'dotenv/config';
import { OdooClient } from '../src/common/services/odoo-client.js';
import { ODOO_CONFIG } from '../src/common/constants.js';

async function main() {
  console.log('Connecting to Odoo...');

  const client = new OdooClient({
    url: ODOO_CONFIG.URL,
    db: ODOO_CONFIG.DB,
    username: ODOO_CONFIG.USERNAME,
    password: ODOO_CONFIG.PASSWORD,
  });

  await client.authenticate();
  console.log('Authenticated!\n');

  // Fetch most recently created account
  console.log('Fetching most recently created account...\n');

  const accounts = await client.searchRead<Record<string, unknown>>(
    'account.account',
    [],
    ['id', 'code', 'name', 'account_type', 'create_date', 'write_date', 'company_id', 'deprecated', 'reconcile'],
    { limit: 5, order: 'create_date desc' }
  );

  console.log('='.repeat(60));
  console.log('Most Recently Created Accounts (Top 5)');
  console.log('='.repeat(60));

  for (const acc of accounts) {
    console.log(`\nID: ${acc.id}`);
    console.log(`Code: ${acc.code}`);
    console.log(`Name: ${acc.name}`);
    console.log(`Type: ${acc.account_type}`);
    console.log(`Created: ${acc.create_date}`);
    console.log(`Modified: ${acc.write_date}`);
    console.log(`Company: ${Array.isArray(acc.company_id) ? acc.company_id[1] : acc.company_id}`);
    console.log(`Deprecated: ${acc.deprecated}`);
    console.log(`Reconcile: ${acc.reconcile}`);
    console.log('-'.repeat(40));
  }
}

main().catch(console.error);
