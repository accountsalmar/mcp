/**
 * Inspect account.move.line records to understand payload structure
 * and debug exact_query filter issues
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const DATA_COLLECTION = 'nexsus_data';

async function inspectAccountMoveLines() {
  console.log('='.repeat(60));
  console.log('Inspecting account.move.line records');
  console.log('='.repeat(60));
  console.log('');

  // Initialize Qdrant client
  const config: { url: string; apiKey?: string; checkCompatibility?: boolean } = {
    url: QDRANT_HOST,
    checkCompatibility: false,
  };
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);
  console.log('[Init] Connected to Qdrant');
  console.log('');

  // Step 1: Get a sample account.move.line record
  console.log('Step 1: Fetching sample account.move.line record...');
  console.log('-'.repeat(50));

  const simpleFilter = {
    must: [
      { key: 'model_name', match: { value: 'account.move.line' } }
    ]
  };

  try {
    const result = await client.scroll(DATA_COLLECTION, {
      filter: simpleFilter,
      limit: 1,
      with_payload: true,
      with_vector: false
    });

    if (result.points.length === 0) {
      console.log('ERROR: No account.move.line records found!');
      return;
    }

    const payload = result.points[0].payload as Record<string, unknown>;
    console.log('Sample record payload keys:');
    const keys = Object.keys(payload).sort();
    for (const key of keys) {
      const value = payload[key];
      const type = typeof value;
      let display = String(value);
      if (display.length > 60) display = display.substring(0, 60) + '...';
      console.log(`  ${key}: (${type}) ${display}`);
    }

    // Step 2: Check key fields for exact_query
    console.log('');
    console.log('Step 2: Key fields for exact_query...');
    console.log('-'.repeat(50));

    const keyFields = ['account_id_id', 'account_id', 'date', 'parent_state', 'state', 'debit', 'credit', 'balance', 'move_id'];
    for (const field of keyFields) {
      const value = payload[field];
      console.log(`  ${field}: ${JSON.stringify(value)} (${typeof value})`);
    }

    // Step 3: Count total account.move.line records
    console.log('');
    console.log('Step 3: Counting total account.move.line records...');
    console.log('-'.repeat(50));

    const totalCount = await client.count(DATA_COLLECTION, {
      filter: simpleFilter,
      exact: true
    });
    console.log(`  Total: ${totalCount.count.toLocaleString()} records`);

    // Step 4: Count records with account_id_id = 319
    console.log('');
    console.log('Step 4: Counting records with account_id_id = 319...');
    console.log('-'.repeat(50));

    const filter319 = {
      must: [
        { key: 'model_name', match: { value: 'account.move.line' } },
        { key: 'account_id_id', match: { value: 319 } }
      ]
    };

    const count319 = await client.count(DATA_COLLECTION, {
      filter: filter319,
      exact: true
    });
    console.log(`  Records with account_id_id=319: ${count319.count.toLocaleString()}`);

    // Step 5: Get sample record for account 319
    if (count319.count > 0) {
      console.log('');
      console.log('Step 5: Sample record for account 319...');
      console.log('-'.repeat(50));

      const sample = await client.scroll(DATA_COLLECTION, {
        filter: filter319,
        limit: 1,
        with_payload: true,
        with_vector: false
      });

      if (sample.points.length > 0) {
        const p = sample.points[0].payload as Record<string, unknown>;
        console.log('Sample record:');
        console.log(JSON.stringify(p, null, 2));
      }
    }

    // Step 6: Test date filtering
    console.log('');
    console.log('Step 6: Testing date filtering...');
    console.log('-'.repeat(50));

    // First check what date values look like
    const sampleDates = await client.scroll(DATA_COLLECTION, {
      filter: simpleFilter,
      limit: 5,
      with_payload: { include: ['date', 'record_id'] },
      with_vector: false
    });

    console.log('Sample dates:');
    for (const pt of sampleDates.points) {
      const p = pt.payload as Record<string, unknown>;
      console.log(`  record_id=${p.record_id}: date="${p.date}"`);
    }

    // Step 7: Manual aggregation for account 319
    console.log('');
    console.log('Step 7: Manual aggregation for account 319 (all periods)...');
    console.log('-'.repeat(50));

    let totalDebit = 0;
    let totalCredit = 0;
    let recordCount = 0;
    let offset: string | number | null = null;

    do {
      const scrollParams: {
        filter: typeof filter319;
        limit: number;
        offset?: string | number;
        with_payload: { include: string[] };
        with_vector: boolean;
      } = {
        filter: filter319,
        limit: 1000,
        with_payload: { include: ['debit', 'credit', 'balance', 'date'] },
        with_vector: false
      };

      if (offset !== null) {
        scrollParams.offset = offset;
      }

      const batch = await client.scroll(DATA_COLLECTION, scrollParams);

      for (const pt of batch.points) {
        const p = pt.payload as Record<string, unknown>;
        const debit = typeof p.debit === 'number' ? p.debit : 0;
        const credit = typeof p.credit === 'number' ? p.credit : 0;
        totalDebit += debit;
        totalCredit += credit;
        recordCount++;
      }

      offset = batch.next_page_offset ?? null;
    } while (offset !== null);

    console.log(`  Total records: ${recordCount.toLocaleString()}`);
    console.log(`  Total debit: ${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    console.log(`  Total credit: ${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    console.log(`  Net balance: ${(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

inspectAccountMoveLines().catch(console.error);
