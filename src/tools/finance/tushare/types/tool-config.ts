import { z } from 'zod';
import { CacheStrategy } from './api.js';

/**
 * Zod schema for ToolConfig validation
 * Ensures configuration structure is type-safe before writing actual configs
 */

// Field definition schema
export const FieldDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'TsCode', 'DateYYYYMMDD']),
  optional: z.boolean().optional(),
  description: z.string().optional(),
});

// Tool configuration schema (used for runtime validation only)
export const ToolConfigSchema = z.object({
  // Tool identification
  name: z
    .string()
    .min(1)
    .regex(
      /^(get|list|search)_(cn|hk)_[a-z_]+$/,
      'Tool name must follow pattern: {action}_{market}_{data_type}'
    ),

  // Tool description
  description: z
    .string()
    .min(10)
    .refine(
      (desc) => desc.includes('When to Use') && desc.includes('When NOT to Use'),
      'Description must include "When to Use" and "When NOT to Use" sections'
    )
    .refine(
      (desc) => desc.includes('Example:') || desc.includes('example'),
      'Description must include concrete input examples'
    ),

  // API configuration
  apiName: z.string().min(1),
  fields: z.array(z.string()).optional(),

  // Caching strategy
  cacheStrategy: z.nativeEnum(CacheStrategy),

  // Optional transformations and validations
  // Note: z.function() is used for runtime presence-check only; the TypeScript
  // type uses explicit signatures below to avoid the `never` inference issue.
  transform: z.function().optional(),
  validate: z.function().optional(),

  // Return behavior
  returnSingle: z.union([z.boolean(), z.function()]).optional(),

  // Field mappings for response transformation
  fieldMappings: z.record(z.string(), z.string()).optional(),

  // Optional per-tool Tushare documentation URL (overrides default)
  sourceUrl: z.string().url().optional(),

  // Parameter naming validation
  parameterNames: z
    .object({
      stockCode: z.literal('ts_code').optional(),
      startDate: z.literal('start_date').optional(),
      endDate: z.literal('end_date').optional(),
    })
    .optional(),
});

/**
 * Explicit TypeScript interface for ToolConfig.
 *
 * We derive most fields from the Zod schema but override `validate`,
 * `transform`, and `returnSingle` with proper callable signatures so the
 * factory can invoke them without hitting `never` parameter types.
 */
export interface ToolConfig extends Omit<z.infer<typeof ToolConfigSchema>, 'validate' | 'transform' | 'returnSingle'> {
  validate?: (input: Record<string, unknown>) => void;
  transform?: (data: Record<string, unknown>[]) => Record<string, unknown>[];
  returnSingle?: boolean | ((input: Record<string, unknown>) => boolean);
}

export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

/**
 * Validates a tool configuration against the schema
 * Throws descriptive ZodError if validation fails
 */
export function validateToolConfig(config: unknown): ToolConfig {
  // Runtime shape validation via Zod; cast to the explicit interface after
  return ToolConfigSchema.parse(config) as unknown as ToolConfig;
}

/**
 * Validates multiple tool configurations
 * Returns array of validated configs or throws on first error
 */
export function validateToolConfigs(configs: unknown[]): ToolConfig[] {
  return configs.map((config, index) => {
    try {
      return validateToolConfig(config);
    } catch (error) {
      throw new Error(`Tool config at index ${index} is invalid: ${error}`);
    }
  });
}
