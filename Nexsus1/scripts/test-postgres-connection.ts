/**
 * Test PostgreSQL Connection to Odoo Database
 *
 * Usage:
 *   npx ts-node scripts/test-postgres-connection.ts
 *
 * Or set environment variables first:
 *   set POSTGRES_PASSWORD=your_password
 *   npx ts-node scripts/test-postgres-connection.ts
 */

import { Client } from 'pg';

async function testConnection() {
  console.log('='.repeat(60));
  console.log('PostgreSQL Connection Test - Odoo Database');
  console.log('='.repeat(60));

  // Connection details from Power BI Gateway screenshot
  const config = {
    host: process.env.POSTGRES_HOST || '172.31.32.167',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'live',
    user: process.env.POSTGRES_USER || 'odoo',
    password: process.env.POSTGRES_PASSWORD || '',
    // Connection timeout (10 seconds)
    connectionTimeoutMillis: 10000,
    // SSL settings
    ssl: process.env.POSTGRES_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  };

  console.log('\nConnection Settings:');
  console.log(`  Host:     ${config.host}`);
  console.log(`  Port:     ${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User:     ${config.user}`);
  console.log(`  Password: ${config.password ? '***' + config.password.slice(-3) : '(not set)'}`);
  console.log(`  SSL:      ${config.ssl}`);

  if (!config.password) {
    console.log('\n❌ ERROR: Password not set!');
    console.log('\nSet the password using environment variable:');
    console.log('  Windows CMD:  set POSTGRES_PASSWORD=your_password');
    console.log('  PowerShell:   $env:POSTGRES_PASSWORD="your_password"');
    console.log('  Linux/Mac:    export POSTGRES_PASSWORD=your_password');
    process.exit(1);
  }

  const client = new Client(config);

  try {
    console.log('\n⏳ Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test 1: Basic connection info
    console.log('--- Test 1: Server Info ---');
    const versionResult = await client.query('SELECT version()');
    console.log(`PostgreSQL Version: ${versionResult.rows[0].version.split(',')[0]}`);

    // Test 2: Check if this is an Odoo database
    console.log('\n--- Test 2: Odoo Database Check ---');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('res_partner', 'crm_lead', 'account_move', 'account_move_line', 'ir_model')
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('✅ This is an Odoo database! Found tables:');
      tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));
    } else {
      console.log('⚠️  Odoo tables not found. This may not be an Odoo database.');
    }

    // Test 3: Count some key tables
    console.log('\n--- Test 3: Record Counts ---');
    const countQueries = [
      { table: 'res_partner', label: 'Partners/Contacts' },
      { table: 'crm_lead', label: 'CRM Leads' },
      { table: 'account_move', label: 'Journal Entries' },
      { table: 'account_move_line', label: 'Journal Items' },
      { table: 'product_template', label: 'Products' },
    ];

    for (const q of countQueries) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${q.table}`);
        console.log(`   ${q.label.padEnd(20)} (${q.table}): ${parseInt(countResult.rows[0].count).toLocaleString()} records`);
      } catch (err) {
        console.log(`   ${q.label.padEnd(20)} (${q.table}): ❌ Table not accessible`);
      }
    }

    // Test 4: Sample data from res_partner
    console.log('\n--- Test 4: Sample Partner Data ---');
    const sampleResult = await client.query(`
      SELECT id, name, email, phone, city, country_id
      FROM res_partner
      WHERE active = true AND name IS NOT NULL
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log('Latest 5 partners:');
    sampleResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. [${row.id}] ${row.name} ${row.email ? `<${row.email}>` : ''} ${row.city || ''}`);
    });

    // Test 5: Check account_move_line structure (for financial data)
    console.log('\n--- Test 5: Account Move Line Columns ---');
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'account_move_line'
      ORDER BY ordinal_position
      LIMIT 15
    `);

    console.log('First 15 columns in account_move_line:');
    columnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed! Connection is working.');
    console.log('='.repeat(60));
    console.log('\nYou can now add these to your .env file:');
    console.log(`POSTGRES_HOST=${config.host}`);
    console.log(`POSTGRES_PORT=${config.port}`);
    console.log(`POSTGRES_DATABASE=${config.database}`);
    console.log(`POSTGRES_USER=${config.user}`);
    console.log(`POSTGRES_PASSWORD=your_password_here`);

  } catch (error: any) {
    console.log('\n❌ Connection FAILED!');
    console.log('\nError Details:');
    console.log(`  Code:    ${error.code || 'N/A'}`);
    console.log(`  Message: ${error.message}`);

    // Common error explanations
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Hint: Host not found. The IP address may not be reachable from your network.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Hint: Connection refused. Check if PostgreSQL is running and the port is open.');
    } else if (error.code === '28P01') {
      console.log('\n💡 Hint: Authentication failed. Check username and password.');
    } else if (error.code === '3D000') {
      console.log('\n💡 Hint: Database does not exist. Check the database name.');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Hint: Connection timed out. The server may be behind a firewall.');
      console.log('         Try checking if port 5432 is open on 172.31.32.167');
    } else if (error.message.includes('SSL')) {
      console.log('\n💡 Hint: SSL error. Try setting ssl: true or ssl: { rejectUnauthorized: false }');
    }

  } finally {
    await client.end();
  }
}

testConnection().catch(console.error);
