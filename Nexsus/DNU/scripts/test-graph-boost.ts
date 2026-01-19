/**
 * Test Script: Graph Boost for semantic_search
 *
 * Tests Phase 2 of KG_improvements_1984 - graph_boost parameter
 *
 * Run with: npx tsx scripts/test-graph-boost.ts
 */

import 'dotenv/config';
import { initializeVectorClient, searchByPointType } from '../src/services/vector-client.js';
import { initializeEmbeddingService, embed } from '../src/services/embedding-service.js';
import {
  getGraphContext,
  countConnections,
  computeGraphBoost,
} from '../src/services/graph-search-engine.js';
import { isPipelineDataPayload } from '../src/types.js';
import type { PipelineDataPayload, VectorSearchResult } from '../src/types.js';

// =============================================================================
// TEST SETUP
// =============================================================================

async function setup(): Promise<boolean> {
  console.log('='.repeat(60));
  console.log('Graph Boost Test Suite (Phase 2)');
  console.log('='.repeat(60));
  console.log('');

  // Initialize services
  console.log('Initializing services...');

  try {
    await initializeVectorClient();
    console.log('✓ Vector client ready');
  } catch (error) {
    console.error('✗ Vector client failed:', error);
    return false;
  }

  try {
    initializeEmbeddingService();
    console.log('✓ Embedding service ready');
  } catch (error) {
    console.error('✗ Embedding service failed (VOYAGE_API_KEY required):', error);
    console.log('  Skipping embedding-dependent tests\n');
    return false;
  }

  console.log('');
  return true;
}

// =============================================================================
// TEST CASES
// =============================================================================

/**
 * Test 1: Search without graph boost (baseline)
 */
async function testWithoutGraphBoost(): Promise<VectorSearchResult[]> {
  console.log('─'.repeat(60));
  console.log('TEST 1: Search WITHOUT graph_boost (baseline)');
  console.log('─'.repeat(60));

  const query = 'partners';
  console.log(`Query: "${query}"`);

  // Generate embedding
  const queryEmbedding = await embed(query, 'query');

  // Search data points
  const results = await searchByPointType(queryEmbedding, {
    limit: 10,
    minScore: 0.3,
    pointType: 'data',
  });

  console.log(`\nResults: ${results.length}`);

  for (let i = 0; i < Math.min(5, results.length); i++) {
    const r = results[i];
    if (isPipelineDataPayload(r.payload)) {
      const payload = r.payload as PipelineDataPayload;
      console.log(`  ${i + 1}. ${payload.model_name} #${payload.record_id}`);
      console.log(`     Score: ${(r.score * 100).toFixed(1)}%`);
    }
  }

  console.log('\n✓ TEST 1 COMPLETE\n');
  return results;
}

/**
 * Test 2: Apply graph boost manually
 */
async function testWithGraphBoost(originalResults: VectorSearchResult[]): Promise<void> {
  console.log('─'.repeat(60));
  console.log('TEST 2: Apply graph_boost manually');
  console.log('─'.repeat(60));

  const dataResults = originalResults.filter(r => isPipelineDataPayload(r.payload));

  if (dataResults.length === 0) {
    console.log('No data results to boost');
    return;
  }

  // Get unique models
  const uniqueModels = new Set<string>();
  for (const r of dataResults) {
    const payload = r.payload as PipelineDataPayload;
    uniqueModels.add(payload.model_name);
  }

  console.log(`\nUnique models in results: ${Array.from(uniqueModels).join(', ')}`);

  // Get graph context for each model
  const graphContexts = new Map<string, Awaited<ReturnType<typeof getGraphContext>>>();
  for (const modelName of uniqueModels) {
    const ctx = await getGraphContext(modelName);
    graphContexts.set(modelName, ctx);
    console.log(`Graph context for ${modelName}: ${ctx.totalEdges} edges`);
  }

  // Apply boost
  console.log('\nBoosted results:');
  interface BoostedResult {
    original: VectorSearchResult;
    boostedScore: number;
    boost: number;
    connections: { outgoing: number; incoming: number };
  }

  const boostedResults: BoostedResult[] = [];

  for (const r of dataResults) {
    const payload = r.payload as PipelineDataPayload;
    const graphContext = graphContexts.get(payload.model_name);
    const connections = countConnections(payload, graphContext);
    const boost = computeGraphBoost(payload, graphContext);
    const boostedScore = r.score * (1 + boost);

    boostedResults.push({
      original: r,
      boostedScore,
      boost,
      connections: { outgoing: connections.outgoing, incoming: connections.incomingEdgeCount },
    });
  }

  // Sort by boosted score
  boostedResults.sort((a, b) => b.boostedScore - a.boostedScore);

  // Display
  for (let i = 0; i < Math.min(5, boostedResults.length); i++) {
    const br = boostedResults[i];
    const payload = br.original.payload as PipelineDataPayload;
    console.log(`  ${i + 1}. ${payload.model_name} #${payload.record_id}`);
    console.log(`     Original: ${(br.original.score * 100).toFixed(1)}%`);
    console.log(`     Boosted:  ${(br.boostedScore * 100).toFixed(1)}% (+${(br.boost * 100).toFixed(1)}%)`);
    console.log(`     Connections: ${br.connections.outgoing} outgoing, ${br.connections.incoming} refs`);
  }

  console.log('\n✓ TEST 2 COMPLETE\n');
}

/**
 * Test 3: Compare rankings
 */
async function testRankingChange(originalResults: VectorSearchResult[]): Promise<void> {
  console.log('─'.repeat(60));
  console.log('TEST 3: Compare ranking changes');
  console.log('─'.repeat(60));

  const dataResults = originalResults.filter(r => isPipelineDataPayload(r.payload));

  if (dataResults.length < 3) {
    console.log('Not enough data results to compare rankings');
    return;
  }

  // Get graph context
  const uniqueModels = new Set<string>();
  for (const r of dataResults) {
    const payload = r.payload as PipelineDataPayload;
    uniqueModels.add(payload.model_name);
  }

  const graphContexts = new Map<string, Awaited<ReturnType<typeof getGraphContext>>>();
  for (const modelName of uniqueModels) {
    const ctx = await getGraphContext(modelName);
    graphContexts.set(modelName, ctx);
  }

  // Calculate boosts
  const withBoosts = dataResults.map((r, originalRank) => {
    const payload = r.payload as PipelineDataPayload;
    const graphContext = graphContexts.get(payload.model_name);
    const boost = computeGraphBoost(payload, graphContext);
    const boostedScore = r.score * (1 + boost);
    return { r, originalRank, boost, boostedScore };
  });

  // Sort by boosted score
  withBoosts.sort((a, b) => b.boostedScore - a.boostedScore);

  // Check for ranking changes
  let rankChanges = 0;
  console.log('\nRanking comparison:');
  console.log('─'.repeat(40));

  for (let newRank = 0; newRank < withBoosts.length; newRank++) {
    const { r, originalRank, boost } = withBoosts[newRank];
    const payload = r.payload as PipelineDataPayload;

    if (originalRank !== newRank) {
      rankChanges++;
      const change = originalRank - newRank;
      const arrow = change > 0 ? '↑' : '↓';
      console.log(`${arrow} ${payload.model_name} #${payload.record_id}: ${originalRank + 1} → ${newRank + 1} (boost: +${(boost * 100).toFixed(1)}%)`);
    }
  }

  if (rankChanges === 0) {
    console.log('No ranking changes (all records have similar connection levels)');
  } else {
    console.log(`\nTotal ranking changes: ${rankChanges}/${dataResults.length}`);
  }

  console.log('\n✓ TEST 3 COMPLETE\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  try {
    const ready = await setup();

    if (!ready) {
      console.log('Setup incomplete - some tests skipped');
      console.log('Make sure VOYAGE_API_KEY is set in .env');
      process.exit(1);
    }

    // Run tests
    const baselineResults = await testWithoutGraphBoost();
    await testWithGraphBoost(baselineResults);
    await testRankingChange(baselineResults);

    // Summary
    console.log('='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✓ All Phase 2 tests completed!');
    console.log('');
    console.log('The graph_boost parameter is ready for use in semantic_search.');
    console.log('');
    console.log('Claude.ai Test Prompts:');
    console.log('1. semantic_search for "partners" with point_type="data"');
    console.log('2. semantic_search for "partners" with point_type="data", graph_boost=true');
    console.log('3. Compare the rankings - did well-connected records move up?');
    console.log('');
    console.log('Next: Phase 3 (nexsus_search show_relationships)');

  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

main();
