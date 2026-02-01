import { z } from 'zod';

/**
 * Schema for get_duracube_principles tool
 */
export const GetPrinciplesSchema = z.object({
  include_examples: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include example departure templates in the response'),
});

export type GetPrinciplesInput = z.infer<typeof GetPrinciplesSchema>;

/**
 * Schema for get_learned_corrections tool
 */
export const GetLearnedCorrectionsSchema = z.object({
  category: z
    .enum(['all', 'security', 'insurance', 'dlp', 'design', 'methodology'])
    .optional()
    .default('all')
    .describe('Filter learnings by category'),
});

export type GetLearnedCorrectionsInput = z.infer<typeof GetLearnedCorrectionsSchema>;

/**
 * Schema for get_output_format tool
 */
export const GetOutputFormatSchema = z.object({});

export type GetOutputFormatInput = z.infer<typeof GetOutputFormatSchema>;

/**
 * Schema for get_finance_extraction_guide tool
 */
export const GetFinanceExtractionGuideSchema = z.object({
  include_json_template: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include the complete JSON output template in the response'),
  category: z
    .enum(['all', 'contract_value', 'parties', 'payment', 'retention', 'documentation', 'submission', 'project_manager', 'dollar_values'])
    .optional()
    .default('all')
    .describe('Filter to specific extraction category'),
});

export type GetFinanceExtractionGuideInput = z.infer<typeof GetFinanceExtractionGuideSchema>;
