import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { GetPrinciplesInput, GetLearnedCorrectionsInput } from '../schemas/tool-schemas.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JSON knowledge files
const principlesPath = join(__dirname, '..', 'knowledge', 'principles.json');
const learningsPath = join(__dirname, '..', 'knowledge', 'learnings.json');
const formatPath = join(__dirname, '..', 'knowledge', 'format.json');

interface PrinciplesData {
  principles: Array<{
    id: number;
    name: string;
    standard: string;
    risk_level: string;
    search_terms: {
      primary: string[];
      alternative: string[];
      related: string[];
    };
    red_flags: string[];
    compliance_logic: {
      compliant_if: string;
      non_compliant_if: string;
      no_term_risk: string;
      special_note?: string;
      critical_alert?: string;
    };
    negotiation_positions: {
      preferred: string;
      fallback: string;
      deal_breaker: string;
    };
    departure_template: string;
  }>;
  critical_non_negotiables: Record<string, unknown>;
  methodology: Record<string, unknown>;
  interconnected_principles: Array<unknown>;
}

interface LearningsData {
  learnings: Array<{
    id: string;
    category: string;
    principle_id: number | null;
    date_logged?: string;
    issue: string;
    correction: string;
    rule: string;
    examples?: Record<string, string | string[]>;
    interconnected_principles?: number[];
    decision_tree?: Record<string, string>;
  }>;
  decision_trees: Record<string, unknown>;
  category_summaries: Record<string, unknown>;
}

interface FormatData {
  csv_structure: Record<string, unknown>;
  column_specifications: Record<string, unknown>;
  example_rows: string[];
  quality_checklist: string[];
  complete_csv_example: string;
}

let principlesData: PrinciplesData;
let learningsData: LearningsData;
let formatData: FormatData;

// Load data lazily to avoid issues during module initialization
function loadData() {
  if (!principlesData) {
    principlesData = JSON.parse(readFileSync(principlesPath, 'utf-8'));
  }
  if (!learningsData) {
    learningsData = JSON.parse(readFileSync(learningsPath, 'utf-8'));
  }
  if (!formatData) {
    formatData = JSON.parse(readFileSync(formatPath, 'utf-8'));
  }
}

/**
 * Get all 28 DuraCube commercial principles with standards, search terms,
 * red flags, and compliance logic for contract review
 */
export function getDuracubePrinciples(input: GetPrinciplesInput): string {
  loadData();

  const { include_examples } = input;

  // Build response with principles
  const response: {
    total_principles: number;
    principles: Array<{
      id: number;
      name: string;
      standard: string;
      risk_level: string;
      search_terms: {
        primary: string[];
        alternative: string[];
        related: string[];
      };
      red_flags: string[];
      compliance_logic: {
        compliant_if: string;
        non_compliant_if: string;
        no_term_risk: string;
        special_note?: string;
        critical_alert?: string;
      };
      negotiation_positions: {
        preferred: string;
        fallback: string;
        deal_breaker: string;
      };
      departure_template?: string;
    }>;
    critical_non_negotiables: Record<string, unknown>;
    methodology: Record<string, unknown>;
    interconnected_principles: Array<unknown>;
  } = {
    total_principles: principlesData.principles.length,
    principles: principlesData.principles.map(p => {
      const principle: {
        id: number;
        name: string;
        standard: string;
        risk_level: string;
        search_terms: {
          primary: string[];
          alternative: string[];
          related: string[];
        };
        red_flags: string[];
        compliance_logic: {
          compliant_if: string;
          non_compliant_if: string;
          no_term_risk: string;
          special_note?: string;
          critical_alert?: string;
        };
        negotiation_positions: {
          preferred: string;
          fallback: string;
          deal_breaker: string;
        };
        departure_template?: string;
      } = {
        id: p.id,
        name: p.name,
        standard: p.standard,
        risk_level: p.risk_level,
        search_terms: p.search_terms,
        red_flags: p.red_flags,
        compliance_logic: p.compliance_logic,
        negotiation_positions: p.negotiation_positions,
      };

      if (include_examples) {
        principle.departure_template = p.departure_template;
      }

      return principle;
    }),
    critical_non_negotiables: principlesData.critical_non_negotiables,
    methodology: principlesData.methodology,
    interconnected_principles: principlesData.interconnected_principles,
  };

  return JSON.stringify(response, null, 2);
}

/**
 * Get documented learnings from past contract review errors -
 * critical edge cases for accurate analysis
 */
export function getLearnedCorrections(input: GetLearnedCorrectionsInput): string {
  loadData();

  const { category } = input;

  // Filter learnings by category if specified
  const filteredLearnings = category === 'all'
    ? learningsData.learnings
    : learningsData.learnings.filter(l => l.category === category);

  const response = {
    total_learnings: filteredLearnings.length,
    filter_applied: category,
    learnings: filteredLearnings,
    decision_trees: learningsData.decision_trees,
    category_summaries: category === 'all'
      ? learningsData.category_summaries
      : { [category]: learningsData.category_summaries[category as keyof typeof learningsData.category_summaries] },
  };

  return JSON.stringify(response, null, 2);
}

/**
 * Get exact CSV format specification for departure schedules
 */
export function getOutputFormat(): string {
  loadData();

  return JSON.stringify(formatData, null, 2);
}

// Export tool definitions for MCP registration
export const toolDefinitions = {
  get_duracube_principles: {
    name: 'get_duracube_principles',
    description: `Get all 28 DuraCube commercial principles with standards, search terms, red flags, and compliance logic for contract review.

This tool provides:
- All 28 commercial principles with DuraCube's standards
- Search terms to find relevant contract clauses
- Red flags indicating non-compliant terms
- Compliance logic for classification decisions
- Critical non-negotiables (PI Insurance, unconditional guarantees, parent company guarantees)
- Analysis methodology (3-pass extraction, 3-step comparison)

Use this tool FIRST when reviewing any customer contract against DuraCube standards.`,
    inputSchema: {
      type: 'object',
      properties: {
        include_examples: {
          type: 'boolean',
          default: false,
          description: 'Include departure templates showing example language changes',
        },
      },
    },
  },
  get_learned_corrections: {
    name: 'get_learned_corrections',
    description: `Get documented learnings from past contract review errors - critical edge cases for accurate analysis.

This tool provides:
- Documented errors and their corrections
- Decision trees for complex assessments
- Category-specific rules (security, insurance, DLP, design, methodology)
- Interconnected principle dependencies

Categories:
- security: Bank guarantees, retention, parent company guarantees
- insurance: PI Insurance, coverage limits, favorable absence
- dlp: Defects Liability Period vs Warranty distinction
- design: Design scope limitations, shop drawings
- methodology: Page references, template analysis, favorability assessment

Use this tool to avoid repeating known errors and handle edge cases correctly.`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'security', 'insurance', 'dlp', 'design', 'methodology'],
          default: 'all',
          description: 'Filter learnings by category',
        },
      },
    },
  },
  get_output_format: {
    name: 'get_output_format',
    description: `Get exact CSV format specification for departure schedules.

This tool provides:
- CSV structure with row formats
- Column specifications with validation rules
- Multiple example rows showing correct formatting
- Quality checklist for output validation
- Complete CSV example for reference

CRITICAL RULES:
- Page references MUST include clause numbers: "Page 5, Clause 8.1"
- Status must be: Compliant | Non-Compliant | No Term
- Departures use action verbs: Insert: | Replace: | Amend: | Delete:
- Comments column always empty

Use this tool BEFORE generating the final departure schedule to ensure correct format.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
};
