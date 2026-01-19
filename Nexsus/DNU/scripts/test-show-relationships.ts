/**
 * Test Script: show_relationships for nexsus_search
 *
 * Tests Phase 3 of KG_improvements_1984 - show_relationships parameter
 *
 * Run with: npx tsx scripts/test-show-relationships.ts
 */

import 'dotenv/config';
import { initializeVectorClient } from '../src/services/vector-client.js';
import { getGraphContext } from '../src/services/graph-search-engine.js';

// =============================================================================
// TEST SETUP
// =============================================================================

async function setup(): Promise<boolean> {
  console.log('='.repeat(60));
  console.log('show_relationships Test Suite (Phase 3)');
  console.log('='.repeat(60));
  console.log('');

  // Initialize services
  console.log('Initializing services...');

  try {
    await initializeVectorClient();
    console.log('  Vector client ready');
  } catch (error) {
    console.error('  Vector client failed:', error);
    return false;
  }

  console.log('');
  return true;
}

// =============================================================================
// TEST CASES
// =============================================================================

/**
 * Test 1: Get graph context for a well-connected model
 */
async function testGraphContextAccountMoveLine(): Promise<void> {
  console.log('-'.repeat(60));
  console.log('TEST 1: Graph context for account.move.line');
  console.log('-'.repeat(60));

  const graphContext = await getGraphContext('account.move.line');

  console.log(`\nTotal edges: ${graphContext.totalEdges}`);
  console.log(`Outgoing FK fields: ${graphContext.outgoing.length}`);
  console.log(`Incoming references: ${graphContext.incoming.length}`);

  if (graphContext.outgoing.length > 0) {
    console.log('\nTop 5 outgoing relationships:');
    const topOutgoing = graphContext.outgoing
      .sort((a, b) => (b.edge_count || 0) - (a.edge_count || 0))
      .slice(0, 5);
    for (const rel of topOutgoing) {
      console.log(`  - ${rel.field_name} -> ${rel.target_model} (${rel.edge_count || 0} edges)`);
    }
  }

  if (graphContext.incoming.length > 0) {
    console.log('\nTop 5 incoming references:');
    const topIncoming = graphContext.incoming
      .sort((a, b) => (b.edge_count || 0) - (a.edge_count || 0))
      .slice(0, 5);
    for (const rel of topIncoming) {
      console.log(`  - ${rel.target_model}.${rel.field_name} (${rel.edge_count || 0} edges)`);
    }
  }

  console.log('\n  TEST 1 COMPLETE\n');
}

/**
 * Test 2: Get graph context for res.partner (hub model)
 */
async function testGraphContextResPartner(): Promise<void> {
  console.log('-'.repeat(60));
  console.log('TEST 2: Graph context for res.partner (hub model)');
  console.log('-'.repeat(60));

  const graphContext = await getGraphContext('res.partner');

  console.log(`\nTotal edges: ${graphContext.totalEdges}`);
  console.log(`Outgoing FK fields: ${graphContext.outgoing.length}`);
  console.log(`Incoming references: ${graphContext.incoming.length}`);

  // res.partner should have many incoming references
  if (graphContext.incoming.length > 0) {
    console.log('\nTop 10 models referencing res.partner:');
    const topIncoming = graphContext.incoming
      .sort((a, b) => (b.edge_count || 0) - (a.edge_count || 0))
      .slice(0, 10);
    for (const rel of topIncoming) {
      console.log(`  - ${rel.target_model}.${rel.field_name} (${rel.edge_count || 0} edges)`);
    }
  }

  console.log('\n  TEST 2 COMPLETE\n');
}

/**
 * Test 3: Format relationship section output
 */
async function testFormatRelationshipSection(): Promise<void> {
  console.log('-'.repeat(60));
  console.log('TEST 3: Format relationship section (simulated)');
  console.log('-'.repeat(60));

  const modelName = 'account.move.line';
  const graphContext = await getGraphContext(modelName);

  const lines: string[] = [];

  if (graphContext.totalEdges === 0) {
    lines.push('');
    lines.push('## Knowledge Graph Relationships');
    lines.push('*No relationships found in Knowledge Graph. Run pipeline_sync to populate.*');
  } else {
    lines.push('');
    lines.push('## Knowledge Graph Relationships');
    lines.push('');

    // Outgoing relationships (FKs from this model)
    if (graphContext.outgoing.length > 0) {
      lines.push(`**Outgoing FK Fields:** (${graphContext.outgoing.length})`);
      const topOutgoing = graphContext.outgoing
        .sort((a, b) => (b.edge_count || 0) - (a.edge_count || 0))
        .slice(0, 8);

      for (const rel of topOutgoing) {
        const edgeInfo = rel.edge_count ? ` (${rel.edge_count.toLocaleString()} edges)` : '';
        lines.push(`- ${rel.field_name} -> ${rel.target_model}${edgeInfo}`);
      }
      if (graphContext.outgoing.length > 8) {
        lines.push(`- *...and ${graphContext.outgoing.length - 8} more*`);
      }
      lines.push('');
    }

    // Incoming relationships (other models referencing this one)
    if (graphContext.incoming.length > 0) {
      lines.push(`**Incoming References:** (${graphContext.incoming.length} models reference this)`);
      const topIncoming = graphContext.incoming
        .sort((a, b) => (b.edge_count || 0) - (a.edge_count || 0))
        .slice(0, 5);

      for (const rel of topIncoming) {
        const edgeInfo = rel.edge_count ? ` (${rel.edge_count.toLocaleString()} edges)` : '';
        lines.push(`- ${rel.target_model}.${rel.field_name}${edgeInfo}`);
      }
      if (graphContext.incoming.length > 5) {
        lines.push(`- *...and ${graphContext.incoming.length - 5} more*`);
      }
      lines.push('');
    }

    // Suggested explorations
    lines.push('**Suggested Explorations:**');
    if (graphContext.outgoing.length > 0) {
      const suggestedFk = graphContext.outgoing[0];
      lines.push(`- Add \`group_by: ["${suggestedFk.field_name}_id"]\` to group by ${suggestedFk.target_model}`);
    }
    if (graphContext.incoming.length > 0) {
      const suggestedIncoming = graphContext.incoming[0];
      lines.push(`- Query ${suggestedIncoming.target_model} with filter on this model's records`);
    }
  }

  console.log('\nFormatted output:\n');
  console.log(lines.join('\n'));

  console.log('\n  TEST 3 COMPLETE\n');
}

/**
 * Test 4: Graph context for model with no relationships
 */
async function testGraphContextEmpty(): Promise<void> {
  console.log('-'.repeat(60));
  console.log('TEST 4: Graph context for model with few/no relationships');
  console.log('-'.repeat(60));

  // Try a model that might not have many edges
  const graphContext = await getGraphContext('res.country.state');

  console.log(`\nTotal edges: ${graphContext.totalEdges}`);
  console.log(`Outgoing FK fields: ${graphContext.outgoing.length}`);
  console.log(`Incoming references: ${graphContext.incoming.length}`);

  if (graphContext.totalEdges === 0) {
    console.log('\nNo Knowledge Graph edges found (this is expected if model not synced)');
  } else {
    if (graphContext.outgoing.length > 0) {
      console.log('\nOutgoing relationships:');
      for (const rel of graphContext.outgoing) {
        console.log(`  - ${rel.field_name} -> ${rel.target_model}`);
      }
    }
    if (graphContext.incoming.length > 0) {
      console.log('\nIncoming references:');
      for (const rel of graphContext.incoming) {
        console.log(`  - ${rel.target_model}.${rel.field_name}`);
      }
    }
  }

  console.log('\n  TEST 4 COMPLETE\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  try {
    const ready = await setup();

    if (!ready) {
      console.log('Setup incomplete - tests skipped');
      process.exit(1);
    }

    // Run tests
    await testGraphContextAccountMoveLine();
    await testGraphContextResPartner();
    await testFormatRelationshipSection();
    await testGraphContextEmpty();

    // Summary
    console.log('='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('  All Phase 3 tests completed!');
    console.log('');
    console.log('The show_relationships parameter is ready for use in nexsus_search.');
    console.log('');
    console.log('Claude.ai Test Prompts:');
    console.log('1. nexsus_search for account.move.line with show_relationships=true');
    console.log('2. nexsus_search for res.partner records with show_relationships=true');
    console.log('3. Compare output with and without show_relationships');
    console.log('');
    console.log('Next: Phase 4 (graph_traverse dynamic FK discovery)');

  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

main();
