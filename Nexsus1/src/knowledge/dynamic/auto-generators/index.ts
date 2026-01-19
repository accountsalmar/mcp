/**
 * Auto-Generators Index
 *
 * Exports all auto-knowledge generation functions for Stages 4-5.
 *
 * Usage:
 *   import { generateFieldKnowledge, generateModelMetadata } from './auto-generators/index.js';
 *
 * These functions generate intelligent defaults for field and model knowledge
 * based on schema structure, reducing manual data entry while maintaining
 * the ability to override with manual Excel entries.
 */

// Stage 4: Field Knowledge Generator (Level 4)
export {
  generateFieldKnowledge,
  generateAllFieldKnowledge,
  getFieldKnowledgeStats,
} from './field-knowledge-generator.js';

// Stage 5: Model Knowledge Generator (Level 3)
export {
  generateModelMetadata,
  generateAllModelMetadata,
  getModelKnowledgeStats,
  modelNameToBusinessName,
} from './model-knowledge-generator.js';
