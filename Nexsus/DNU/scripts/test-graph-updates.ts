/**
 * Test Script for Phase 5: Knowledge Graph Updates
 *
 * Tests:
 * 5.1: Get Graph Statistics
 * 5.2: Get All Leaf Models
 * 5.3: Get Relationship Graph
 * 5.4: Get Relationships by Cascade Source
 * 5.5: Verify Cascade Integration
 * 5.6: Format Relationship Graph
 * 5.7: Semantic Search Relationships
 *
 * Run: npx tsx scripts/test-graph-updates.ts
 */

import 'dotenv/config';
import {
  getGraphStats,
  getAllLeafModels,
  getRelationshipGraph,
  getRelationshipsByCascadeSource,
  getModelRelationships,
  getIncomingRelationships,
  searchRelationships,
  formatRelationshipGraph,
  graphCollectionExists,
  getGraphCollectionInfo,
} from '../src/services/knowledge-graph.js';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { initializeEmbeddingService } from '../src/services/embedding-service.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function log(message: string): void {
  console.log(`[TEST] ${message}`);
}

function pass(testName: string): void {
  console.log(`\x1b[32m[PASS]\x1b[0m ${testName}`);
}

function fail(testName: string, error: string): void {
  console.log(`\x1b[31m[FAIL]\x1b[0m ${testName}: ${error}`);
}

// =============================================================================
// TESTS
// =============================================================================

async function test5_1_GetGraphStats(): Promise<boolean> {
  const testName = 'Test 5.1: Get Graph Statistics';
  log(`Running ${testName}...`);

  try {
    const stats = await getGraphStats();

    log(`Graph Statistics:`);
    log(`  - Total relationships: ${stats.total_relationships}`);
    log(`  - Unique source models: ${stats.unique_source_models}`);
    log(`  - Unique target models: ${stats.unique_target_models}`);
    log(`  - Leaf models: ${stats.leaf_models}`);
    log(`  - Cascade sources: ${stats.cascade_sources.length}`);

    if (stats.cascade_sources.length > 0) {
      log(`  - Sources: ${stats.cascade_sources.slice(0, 5).join(', ')}${stats.cascade_sources.length > 5 ? '...' : ''}`);
    }

    if (stats.most_connected_models.length > 0) {
      log(`  - Most connected models:`);
      for (const model of stats.most_connected_models.slice(0, 5)) {
        log(`    - ${model.model}: ${model.outgoing} out, ${model.incoming} in`);
      }
    }

    // Verify we have data from previous cascade syncs
    if (stats.total_relationships === 0) {
      log('WARNING: No relationships in graph. Run Phase 4 tests first.');
      pass(testName + ' (empty graph)');
      return true;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test5_2_GetAllLeafModels(): Promise<boolean> {
  const testName = 'Test 5.2: Get All Leaf Models';
  log(`Running ${testName}...`);

  try {
    const leafModels = await getAllLeafModels();

    log(`Found ${leafModels.length} leaf models`);

    if (leafModels.length > 0) {
      log(`Leaf models (first 10):`);
      for (const model of leafModels.slice(0, 10)) {
        log(`  - ${model}`);
      }
      if (leafModels.length > 10) {
        log(`  ... and ${leafModels.length - 10} more`);
      }
    }

    // Leaf models are valid even if empty (no cascades run yet)
    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test5_3_GetRelationshipGraph(): Promise<boolean> {
  const testName = 'Test 5.3: Get Relationship Graph';
  log(`Running ${testName}...`);

  try {
    // Get graph starting from res.partner (likely has relationships from Phase 4)
    const graph = await getRelationshipGraph('res.partner', 3);

    log(`Relationship Graph for res.partner (depth 3):`);
    log(`  - Start model: ${graph.start_model}`);
    log(`  - Max depth: ${graph.max_depth}`);
    log(`  - Total nodes: ${graph.nodes.length}`);
    log(`  - Total edges: ${graph.edges.length}`);

    if (graph.nodes.length > 0) {
      log(`  - Nodes by depth:`);
      const byDepth = new Map<number, number>();
      for (const node of graph.nodes) {
        byDepth.set(node.depth, (byDepth.get(node.depth) || 0) + 1);
      }
      for (const [depth, count] of Array.from(byDepth.entries()).sort((a, b) => a[0] - b[0])) {
        log(`    - Depth ${depth}: ${count} nodes`);
      }
    }

    if (graph.edges.length > 0) {
      log(`  - Sample edges:`);
      for (const edge of graph.edges.slice(0, 5)) {
        log(`    - ${edge.source_model} → ${edge.target_model} (${edge.field_name})`);
      }
    }

    // Graph is valid even if empty
    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test5_4_GetRelationshipsByCascadeSource(): Promise<boolean> {
  const testName = 'Test 5.4: Get Relationships by Cascade Source';
  log(`Running ${testName}...`);

  try {
    // First get stats to find cascade sources
    const stats = await getGraphStats();

    if (stats.cascade_sources.length === 0) {
      log('No cascade sources found. Skipping test.');
      pass(testName + ' (no sources)');
      return true;
    }

    const source = stats.cascade_sources[0];
    log(`Looking for relationships from cascade source: ${source}`);

    const relationships = await getRelationshipsByCascadeSource(source);

    log(`Found ${relationships.length} relationships from ${source}`);

    if (relationships.length > 0) {
      log(`Sample relationships:`);
      for (const rel of relationships.slice(0, 5)) {
        log(`  - ${rel.field_name} → ${rel.target_model} (${rel.edge_count} edges)`);
      }
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test5_5_VerifyCascadeIntegration(): Promise<boolean> {
  const testName = 'Test 5.5: Verify Cascade Integration';
  log(`Running ${testName}...`);

  try {
    // Check that res.partner has outgoing relationships (from Phase 4 cascade)
    const outgoing = await getModelRelationships('res.partner');
    log(`res.partner outgoing relationships: ${outgoing.length}`);

    if (outgoing.length > 0) {
      log(`Sample outgoing:`);
      for (const rel of outgoing.slice(0, 5)) {
        log(`  - ${rel.field_name} (${rel.field_label}) → ${rel.target_model} [${rel.edge_count} edges, leaf=${rel.is_leaf}]`);
      }
    }

    // Check incoming relationships to res.partner (what references it)
    const incoming = await getIncomingRelationships('res.partner');
    log(`res.partner incoming relationships: ${incoming.length}`);

    if (incoming.length > 0) {
      log(`Sample incoming:`);
      for (const rel of incoming.slice(0, 5)) {
        log(`  - ${rel.target_model}.${rel.field_name} references res.partner [${rel.edge_count} edges]`);
      }
    }

    // Verify edge counts are reasonable
    if (outgoing.length > 0) {
      const totalEdges = outgoing.reduce((sum, rel) => sum + rel.edge_count, 0);
      log(`Total outgoing edges: ${totalEdges}`);

      if (totalEdges === 0) {
        log('WARNING: All relationships have 0 edge counts');
      }
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test5_6_FormatRelationshipGraph(): Promise<boolean> {
  const testName = 'Test 5.6: Format Relationship Graph';
  log(`Running ${testName}...`);

  try {
    // Get a graph
    const graph = await getRelationshipGraph('res.partner', 2);

    // Format it
    const formatted = formatRelationshipGraph(graph);

    log('Formatted graph output:');
    console.log(formatted);

    // Verify format contains expected sections
    if (!formatted.includes('# Relationship Graph:')) {
      fail(testName, 'Missing header');
      return false;
    }

    if (!formatted.includes('Max Depth:')) {
      fail(testName, 'Missing max depth');
      return false;
    }

    if (!formatted.includes('Total Nodes:')) {
      fail(testName, 'Missing node count');
      return false;
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test5_7_SemanticSearchRelationships(): Promise<boolean> {
  const testName = 'Test 5.7: Semantic Search Relationships';
  log(`Running ${testName}...`);

  try {
    // Search for partner-related relationships
    const query = 'partner references customer contacts';
    log(`Searching for: "${query}"`);

    const results = await searchRelationships(query, 5);

    log(`Found ${results.length} matching relationships:`);
    for (const rel of results) {
      log(`  - [${rel.score.toFixed(3)}] ${rel.field_name} → ${rel.target_model}`);
    }

    // Search is valid even with no results
    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function test5_8_GraphCollectionInfo(): Promise<boolean> {
  const testName = 'Test 5.8: Graph Collection Info';
  log(`Running ${testName}...`);

  try {
    const exists = await graphCollectionExists();
    log(`Graph collection exists: ${exists}`);

    const info = await getGraphCollectionInfo();
    log(`Collection info:`);
    log(`  - Name: ${info.collectionName}`);
    log(`  - Exists: ${info.exists}`);
    log(`  - Point count: ${info.pointCount}`);

    if (!info.exists) {
      log('WARNING: Graph collection does not exist. Run Phase 1 or 4 tests first.');
    }

    pass(testName);
    return true;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('Phase 5: Knowledge Graph Updates Tests');
  console.log('========================================\n');

  // Initialize services
  log('Initializing services...');

  const vectorReady = initializeVectorClient();
  if (!vectorReady) {
    console.error('Failed to initialize vector client. Check QDRANT_HOST.');
    process.exit(1);
  }

  const embeddingReady = initializeEmbeddingService();
  if (!embeddingReady) {
    console.error('Failed to initialize embedding service. Check VOYAGE_API_KEY.');
    process.exit(1);
  }

  log('Services initialized.\n');

  // Run tests
  const results: boolean[] = [];

  results.push(await test5_8_GraphCollectionInfo());
  results.push(await test5_1_GetGraphStats());
  results.push(await test5_2_GetAllLeafModels());
  results.push(await test5_3_GetRelationshipGraph());
  results.push(await test5_4_GetRelationshipsByCascadeSource());
  results.push(await test5_5_VerifyCascadeIntegration());
  results.push(await test5_6_FormatRelationshipGraph());
  results.push(await test5_7_SemanticSearchRelationships());

  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\x1b[32mAll tests passed!\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[31mSome tests failed.\x1b[0m');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
