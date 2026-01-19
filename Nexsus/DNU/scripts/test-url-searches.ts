/**
 * Test URL Builder search logic with context filtering
 *
 * Simulates what the url-builder-tool.ts will find for different searches
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION = process.env.UNIFIED_COLLECTION_NAME || 'nexsus_unified';

// Test cases from user's working URLs
const testCases = [
  { search: 'bill', expectedAction: 325, expectedMenu: 204 },
  { search: 'vendor bill', expectedAction: 325, expectedMenu: 204 },
  { search: 'aged receivable', expectedAction: 465, expectedMenu: 297 },
  { search: 'profit and loss', expectedAction: 1389, expectedMenu: 808 },
  { search: 'sales order', expectedAction: 746, expectedMenu: 438 },
  { search: 'contact', expectedAction: 334, expectedMenu: 225 },
];

function isContextDependent(context: unknown): boolean {
  if (!context) return false;
  const contextStr = String(context);
  return contextStr.includes('active_id') || contextStr.includes('active_ids');
}

async function main() {
  const client = new QdrantClient({
    url: QDRANT_HOST,
    apiKey: QDRANT_API_KEY,
    checkCompatibility: false
  });

  console.log('='.repeat(60));
  console.log('URL BUILDER SEARCH TEST (with context filtering)');
  console.log('='.repeat(60));

  for (const tc of testCases) {
    console.log(`\n## Search: "${tc.search}"`);
    console.log(`   Expected: action=${tc.expectedAction}, menu=${tc.expectedMenu}`);

    // Step 1: Search ir.actions.act_window by name
    const actionsResult = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: 'ir.actions.act_window' } },
        ]
      },
      with_payload: true,
      limit: 1000
    });

    const searchLower = tc.search.toLowerCase();
    const matchingActions = actionsResult.points.filter(p => {
      const name = String(p.payload?.name || '').toLowerCase();
      const resModel = String(p.payload?.res_model || '').toLowerCase();
      return name.includes(searchLower) || resModel.includes(searchLower);
    });

    // Separate safe vs context-dependent actions
    const safeActions = matchingActions.filter(p => !isContextDependent(p.payload?.context));
    const contextDependentActions = matchingActions.filter(p => isContextDependent(p.payload?.context));

    if (matchingActions.length > 0) {
      console.log(`   Window actions found: ${matchingActions.length} (${safeActions.length} safe, ${contextDependentActions.length} context-dependent)`);

      if (safeActions.length > 0) {
        console.log(`   ✓ Safe actions:`);
        safeActions.slice(0, 3).forEach(p => {
          console.log(`     - ${p.payload?.record_id}: ${p.payload?.name}`);
        });
      }

      if (contextDependentActions.length > 0 && safeActions.length === 0) {
        console.log(`   ⚠️  ALL actions are context-dependent - will try menu fallback`);
      }
    } else {
      console.log(`   ✗ No window actions found - will try menu fallback`);
    }

    // Step 2: Search ir.ui.menu by name (fallback for reports OR when all actions are context-dependent)
    const menusResult = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'point_type', match: { value: 'data' } },
          { key: 'model_name', match: { value: 'ir.ui.menu' } },
        ]
      },
      with_payload: true,
      limit: 1000
    });

    const matchingMenus = menusResult.points.filter(p => {
      const name = String(p.payload?.name || '').toLowerCase();
      const completeName = String(p.payload?.complete_name || '').toLowerCase();
      return name.includes(searchLower) || completeName.includes(searchLower);
    });

    if (matchingMenus.length > 0) {
      console.log(`   ✓ Found ${matchingMenus.length} menu(s):`);
      matchingMenus.slice(0, 3).forEach(p => {
        const action = p.payload?.action;
        const actionMatch = String(action || '').match(/,(\d+)$/);
        const actionId = actionMatch ? actionMatch[1] : action;
        console.log(`     - menu=${p.payload?.record_id}: ${p.payload?.name} → action=${actionId}`);
      });
    } else if (safeActions.length === 0) {
      console.log(`   ✗ No menus found - search will show context-dependent warning`);
    }

    // Determine outcome
    let outcome: string;
    let willFindExpected = false;

    if (safeActions.length > 0) {
      outcome = '✓ Will return safe action(s)';
      willFindExpected = safeActions.some(p => p.payload?.record_id === tc.expectedAction);
    } else if (matchingMenus.length > 0) {
      outcome = '✓ Will return menu-based URL(s)';
      willFindExpected = matchingMenus.some(p => p.payload?.record_id === tc.expectedMenu);
    } else if (contextDependentActions.length > 0) {
      outcome = '⚠️  Will show context-dependent warning';
      willFindExpected = false;
    } else {
      outcome = '✗ No results found';
      willFindExpected = false;
    }

    console.log(`   Result: ${outcome}`);
    console.log(`   Finds expected: ${willFindExpected ? '✓ YES' : '✗ NO'}`);
  }
}

main().catch(console.error);
