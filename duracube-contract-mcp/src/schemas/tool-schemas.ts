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
