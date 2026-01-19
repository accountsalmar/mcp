/**
 * Test Odoo Write/Delete Access Rights
 *
 * Checks if the user has create, write, and unlink (delete) permissions.
 */

import 'dotenv/config';
import xmlrpc from 'xmlrpc';
const { createSecureClient } = xmlrpc;

import { ODOO_CONFIG } from '../src/common/constants.js';

async function testWriteAccess(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Odoo Write/Delete Access Test');
  console.log('='.repeat(60));
  console.log();

  const commonUrl = new URL('/xmlrpc/2/common', ODOO_CONFIG.URL);
  const objectUrl = new URL('/xmlrpc/2/object', ODOO_CONFIG.URL);

  const commonClient = createSecureClient({
    host: commonUrl.hostname,
    port: 443,
    path: commonUrl.pathname,
    headers: { 'Content-Type': 'text/xml' }
  });

  const objectClient = createSecureClient({
    host: objectUrl.hostname,
    port: 443,
    path: objectUrl.pathname,
    headers: { 'Content-Type': 'text/xml' }
  });

  // Authenticate
  console.log('Authenticating...');
  const uid = await new Promise<number>((resolve, reject) => {
    commonClient.methodCall(
      'authenticate',
      [ODOO_CONFIG.DB, ODOO_CONFIG.USERNAME, ODOO_CONFIG.PASSWORD, {}],
      (error, value) => {
        if (error) reject(error);
        else if (value === false) reject(new Error('Invalid credentials'));
        else resolve(value as number);
      }
    );
  });
  console.log(`Authenticated as user ID: ${uid}`);
  console.log();

  // Test check_access_rights for different operations
  const models = ['account.account', 'account.move', 'account.move.line', 'res.partner', 'crm.lead'];
  const operations = ['read', 'create', 'write', 'unlink'];

  console.log('Checking access rights...');
  console.log('-'.repeat(60));
  console.log('Model'.padEnd(25) + 'Read'.padEnd(10) + 'Create'.padEnd(10) + 'Write'.padEnd(10) + 'Delete');
  console.log('-'.repeat(60));

  for (const model of models) {
    const results: Record<string, string> = {};

    for (const operation of operations) {
      try {
        const hasAccess = await new Promise<boolean>((resolve, reject) => {
          objectClient.methodCall(
            'execute_kw',
            [
              ODOO_CONFIG.DB,
              uid,
              ODOO_CONFIG.PASSWORD,
              model,
              'check_access_rights',
              [operation],
              { raise_exception: false }
            ],
            (error, value) => {
              if (error) reject(error);
              else resolve(value as boolean);
            }
          );
        });
        results[operation] = hasAccess ? 'YES' : 'NO';
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('does not exist') || msg.includes('KeyError')) {
          results[operation] = 'N/A';
        } else {
          results[operation] = 'ERR';
        }
      }
    }

    console.log(
      model.padEnd(25) +
      results['read'].padEnd(10) +
      results['create'].padEnd(10) +
      results['write'].padEnd(10) +
      results['unlink']
    );
  }

  console.log('-'.repeat(60));
  console.log();

  // Try to get more details about the user's groups
  console.log('Checking user access groups via ir.model.access...');
  try {
    const accessRules = await new Promise<any[]>((resolve, reject) => {
      objectClient.methodCall(
        'execute_kw',
        [
          ODOO_CONFIG.DB,
          uid,
          ODOO_CONFIG.PASSWORD,
          'ir.model.access',
          'search_read',
          [[['model_id.model', 'in', models]]],
          {
            fields: ['name', 'model_id', 'group_id', 'perm_read', 'perm_create', 'perm_write', 'perm_unlink'],
            limit: 50
          }
        ],
        (error, value) => {
          if (error) reject(error);
          else resolve(value as any[]);
        }
      );
    });

    if (accessRules.length > 0) {
      console.log(`Found ${accessRules.length} access rules:`);
      for (const rule of accessRules) {
        const perms = [];
        if (rule.perm_read) perms.push('R');
        if (rule.perm_create) perms.push('C');
        if (rule.perm_write) perms.push('W');
        if (rule.perm_unlink) perms.push('D');
        console.log(`  ${rule.name}: [${perms.join('')}] - Group: ${rule.group_id ? rule.group_id[1] : 'All Users'}`);
      }
    }
  } catch (error) {
    console.log(`  Could not read access rules: ${error instanceof Error ? error.message.slice(0, 50) : String(error)}`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Legend: YES = Has Access, NO = No Access, N/A = Model Not Found, ERR = Error');
  console.log('='.repeat(60));
}

testWriteAccess().catch(console.error);
