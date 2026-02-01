import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { GetPrinciplesInput, GetLearnedCorrectionsInput, GetFinanceExtractionGuideInput } from '../schemas/tool-schemas.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JSON knowledge files
const principlesPath = join(__dirname, '..', 'knowledge', 'principles.json');
const learningsPath = join(__dirname, '..', 'knowledge', 'learnings.json');
const formatPath = join(__dirname, '..', 'knowledge', 'format.json');
const financeExtractionPath = join(__dirname, '..', 'knowledge', 'finance-extraction.json');

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

interface FinanceExtractionData {
  tool_metadata: {
    name: string;
    version: string;
    purpose: string;
    design_principle: string;
  };
  business_context: {
    company: string;
    industry: string;
    typical_contracts: string[];
    contract_value_range: string;
    regulatory_context: string;
  };
  target_audience: {
    team: string;
    responsibilities: string[];
    use_case: string;
  };
  extraction_categories: Array<{
    id: number;
    name: string;
    description: string;
    alternative_names?: string[];
    search_terms: {
      primary: string[];
      secondary: string[];
      related: string[];
    };
    extraction_rules: string[];
    output_fields: Record<string, string>;
  }>;
  extraction_methodology: {
    document_scan_order: Array<{
      priority: number;
      section: string;
      rationale: string;
    }>;
    extraction_rules: string[];
  };
  edge_case_handling: Record<string, unknown>;
  output_format: {
    style_requirements: Record<string, string>;
    json_structure: Record<string, unknown>;
  };
  validation_checklist: string[];
  explicit_constraints: {
    do_not: string[];
  };
  domain_expertise: {
    regulatory_knowledge: string[];
    contract_standards: string[];
    terminology: Record<string, string>;
  };
}

let principlesData: PrinciplesData;
let learningsData: LearningsData;
let formatData: FormatData;
let financeExtractionData: FinanceExtractionData;

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
  if (!financeExtractionData) {
    financeExtractionData = JSON.parse(readFileSync(financeExtractionPath, 'utf-8'));
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

/**
 * Get finance extraction guide for extracting 9 key finance data points from contracts.
 * This is for DuraCube's finance team - EXTRACT ONLY, no assessment or judgment.
 */
export function getFinanceExtractionGuide(input: GetFinanceExtractionGuideInput): string {
  loadData();

  const { include_json_template, category } = input;

  // Category mapping for filtering
  const categoryMap: Record<string, number[]> = {
    all: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    contract_value: [1],
    parties: [2],
    payment: [3, 4],
    retention: [5],
    documentation: [6],
    submission: [7],
    project_manager: [8],
    dollar_values: [9],
  };

  const categoryIds = categoryMap[category] || categoryMap.all;

  // Filter categories based on selection
  const filteredCategories = financeExtractionData.extraction_categories.filter(
    (cat) => categoryIds.includes(cat.id)
  );

  // Build the response
  const response: {
    tool_purpose: string;
    design_principle: string;
    business_context: typeof financeExtractionData.business_context;
    target_audience: typeof financeExtractionData.target_audience;
    total_categories: number;
    filter_applied: string;
    extraction_categories: typeof filteredCategories;
    extraction_methodology: typeof financeExtractionData.extraction_methodology;
    edge_case_handling: typeof financeExtractionData.edge_case_handling;
    validation_checklist: typeof financeExtractionData.validation_checklist;
    explicit_constraints: typeof financeExtractionData.explicit_constraints;
    domain_expertise: typeof financeExtractionData.domain_expertise;
    output_format?: typeof financeExtractionData.output_format;
    json_output_template?: string;
  } = {
    tool_purpose: financeExtractionData.tool_metadata.purpose,
    design_principle: financeExtractionData.tool_metadata.design_principle,
    business_context: financeExtractionData.business_context,
    target_audience: financeExtractionData.target_audience,
    total_categories: filteredCategories.length,
    filter_applied: category,
    extraction_categories: filteredCategories,
    extraction_methodology: financeExtractionData.extraction_methodology,
    edge_case_handling: financeExtractionData.edge_case_handling,
    validation_checklist: financeExtractionData.validation_checklist,
    explicit_constraints: financeExtractionData.explicit_constraints,
    domain_expertise: financeExtractionData.domain_expertise,
  };

  // Include JSON template if requested
  if (include_json_template) {
    response.output_format = financeExtractionData.output_format;
    response.json_output_template = `{
  "extraction_metadata": {
    "document_name": "[PDF filename]",
    "extraction_date": "[DD/MM/YYYY]",
    "total_pages": "[Number]",
    "document_type": "[Subcontract/Supply Agreement/Other]"
  },

  "contract_value": {
    "amount": "$X,XXX,XXX",
    "gst_treatment": "[Exclusive/Inclusive/Not specified]",
    "source": "Page X, Clause X.X"
  },

  "contract_parties": [
    {
      "name": "[Full legal entity name]",
      "role": "[Principal/Head Contractor/Contractor/Subcontractor/Supplier]",
      "abn": "[11-digit ABN or null]",
      "acn": "[9-digit ACN or null]",
      "source": "Page X, Clause X.X"
    }
  ],

  "payment_terms": {
    "frequency": "[Monthly/Progress-based/Milestone/Upon completion]",
    "timing": "[e.g., 'Within 30 business days of valid claim']",
    "claim_due_date": "[e.g., '25th of each month']",
    "reference_period": "[e.g., 'Calendar month']",
    "source": "Page X, Clause X.X"
  },

  "payment_claim_conditions": {
    "required_documents": ["[Document 1]", "[Document 2]"],
    "conditions_precedent": ["[Condition 1]", "[Condition 2]"],
    "submission_email": "[Email address or null]",
    "tax_invoice_requirements": "[Requirements or null]",
    "source": "Page X, Clause X.X"
  },

  "retention_and_securities": {
    "retention_percentage": "[X%]",
    "retention_cap": "[Maximum amount or null]",
    "security_type": "[Bank Guarantee/Cash Retention/Insurance Bond/None required]",
    "security_amount": "[Amount or formula]",
    "release_conditions": "[Conditions for release]",
    "release_timing": "[When security is released]",
    "source": "Page X, Clause X.X"
  },

  "additional_claim_documentation": {
    "subcontractor_statement": "[Required/Not required/State-specific requirement]",
    "other_requirements": ["[Requirement 1]", "[Requirement 2]"],
    "source": "Page X, Clause X.X"
  },

  "claim_submission_method": {
    "method": "[Portal/Email/Hard copy/Multiple]",
    "portal_url": "[URL or null]",
    "email_address": "[Email or null]",
    "special_requirements": "[Any specific instructions or null]",
    "source": "Page X, Clause X.X"
  },

  "project_manager": {
    "name": "[Full name]",
    "company": "[Company they represent]",
    "email": "[Email or null]",
    "phone": "[Phone or null]",
    "source": "Page X, Clause X.X"
  },

  "dollar_values": [
    {
      "amount": "$X,XXX",
      "context": "[What this amount relates to]",
      "source": "Page X"
    }
  ],

  "edge_cases": {
    "conflicts_detected": [],
    "handwritten_amendments": [],
    "external_references": [],
    "conditional_values": []
  },

  "extraction_notes": "[Any factual observations about document quality or structure]"
}`;
  }

  return JSON.stringify(response, null, 2);
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
  get_finance_extraction_guide: {
    name: 'get_finance_extraction_guide',
    description: `Get the finance extraction guide for extracting 9 key finance data points from contracts.

PURPOSE: Extract data for DuraCube's accounts receivable and project accounting team.
DESIGN PRINCIPLE: EXTRACT ONLY - no assessment, no comparison, no judgment.

This tool provides:
- 9 extraction categories with search terms and rules
- Document scan methodology (priority section order)
- Edge case handling (conflicts, amendments, external references)
- JSON output template for structured extraction
- Validation checklist
- Domain expertise (SOP Act, AS2124, AS4000 terminology)

EXTRACTION CATEGORIES:
1. Contract Value (Excluding GST)
2. Contract Parties (with ABN/ACN)
3. Payment Terms
4. Payment Claim Conditions
5. Retention and Securities
6. Additional Claim Documentation
7. Claim Submission Method
8. Project Manager
9. Dollar Value Mentions

CRITICAL RULES:
- EXTRACT ONLY - never assess or judge terms
- Do NOT calculate (GST, security amounts, dates)
- Include source reference for every value: "Page X, Clause X.X"
- Use NOT_FOUND with search summary for missing data
- Flag conflicts when values differ across sections

Use this tool when performing FINANCE REVIEW (separate from commercial 28-principle review).`,
    inputSchema: {
      type: 'object',
      properties: {
        include_json_template: {
          type: 'boolean',
          default: true,
          description: 'Include the complete JSON output template in the response',
        },
        category: {
          type: 'string',
          enum: ['all', 'contract_value', 'parties', 'payment', 'retention', 'documentation', 'submission', 'project_manager', 'dollar_values'],
          default: 'all',
          description: 'Filter to specific extraction category',
        },
      },
    },
  },
};
