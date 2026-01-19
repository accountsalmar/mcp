/**
 * Verify URL Builder Actions
 *
 * Checks if the expected action and menu IDs from working URLs exist in Qdrant
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION = process.env.UNIFIED_COLLECTION_NAME || 'nexsus_unified';

// Working URL examples provided by user
const EXPECTED_ACTIONS = [
  { id: 325, name: 'Bills', model: 'account.move', menuId: 204 },
  { id: 335, name: 'Contacts (form)', model: 'res.partner', menuId: 228 },
  { id: 334, name: 'Contacts (kanban)', model: 'res.partner', menuId: 225 },
  { id: 746, name: 'Sales Orders', model: 'sale.order', menuId: 438 },
  { id: 465, name: 'Aged Receivables', model: null, menuId: 297 },
  { id: 1389, name: 'Profit and Loss', model: null, menuId: 808 },
];

const EXPECTED_MENUS = [204, 225, 228, 297, 438, 808];

async function main() {
  const client = new QdrantClient({
    url: QDRANT_HOST,
    apiKey: QDRANT_API_KEY,
    checkCompatibility: false
  });

  console.log('='.repeat(60));
  console.log('VERIFYING URL BUILDER DATA IN QDRANT');
  console.log('='.repeat(60));

  // Check ir.actions.act_window records
  console.log('\n## ir.actions.act_window Records\n');

  for (const expected of EXPECTED_ACTIONS) {
    // Build UUID for action record (model ID for ir.actions.act_window is ~312)
    // First, let's scroll to find the actual records by record_id
    const actionResult = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: 'ir.actions.act_window' } },
          { key: 'record_id', match: { value: expected.id } },
        ]
      },
      with_payload: true,
      limit: 1
    });

    if (actionResult.points.length > 0) {
      const payload = actionResult.points[0].payload as Record<string, unknown>;
      console.log(`✓ Action ${expected.id} (${expected.name})`);
      console.log(`  - name: ${payload.name}`);
      console.log(`  - res_model: ${payload.res_model || '(none)'}`);
      console.log(`  - view_mode: ${payload.view_mode || '(none)'}`);
      console.log(`  - context: ${payload.context ? String(payload.context).substring(0, 50) + '...' : '(none)'}`);
      console.log(`  - type: ${payload.type || '(none)'}`);
    } else {
      console.log(`✗ Action ${expected.id} (${expected.name}) - NOT FOUND`);
    }
  }

  // Check ir.ui.menu records
  console.log('\n## ir.ui.menu Records\n');

  for (const menuId of EXPECTED_MENUS) {
    const menuResult = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: 'ir.ui.menu' } },
          { key: 'record_id', match: { value: menuId } },
        ]
      },
      with_payload: true,
      limit: 1
    });

    if (menuResult.points.length > 0) {
      const payload = menuResult.points[0].payload as Record<string, unknown>;
      console.log(`✓ Menu ${menuId}`);
      console.log(`  - name: ${payload.name}`);
      console.log(`  - action: ${payload.action || '(none)'}`);
      console.log(`  - complete_name: ${payload.complete_name || '(none)'}`);
    } else {
      console.log(`✗ Menu ${menuId} - NOT FOUND`);
    }
  }

  // Check action types that exist
  console.log('\n## Action 465 & 1389 Details (Reports)\n');

  // These might be ir.actions.client or ir.actions.report, not ir.actions.act_window
  // Let's search across all action types
  const actionTypes = [
    'ir.actions.act_window',
    'ir.actions.client',
    'ir.actions.report.xml',
    'ir.actions.act_url',
    'ir.actions.server'
  ];

  for (const actionId of [465, 1389]) {
    console.log(`\nSearching for Action ${actionId} across all action types:`);

    for (const actionType of actionTypes) {
      const result = await client.scroll(COLLECTION, {
        filter: {
          must: [
            { key: 'point_type', match: { value: 'data' } },
            { key: 'model_name', match: { value: actionType } },
            { key: 'record_id', match: { value: actionId } },
          ]
        },
        with_payload: true,
        limit: 1
      });

      if (result.points.length > 0) {
        const payload = result.points[0].payload as Record<string, unknown>;
        console.log(`  ✓ Found in ${actionType}:`);
        console.log(`    - name: ${payload.name}`);
        console.log(`    - All payload keys: ${Object.keys(payload).join(', ')}`);
      }
    }
  }

  // Summary: Check what action types are synced
  console.log('\n## Synced Action Types Summary\n');

  for (const actionType of actionTypes) {
    const countResult = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: actionType } },
        ]
      },
      limit: 1
    });

    // Get count
    const fullResult = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: actionType } },
        ]
      },
      limit: 10000
    });

    console.log(`${actionType}: ${fullResult.points.length} records`);
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
