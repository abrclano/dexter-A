/**
 * Tool Factory for Tushare module
 *
 * Generates DynamicStructuredTool instances from declarative ToolConfig objects.
 * Handles schema generation, validation injection, caching, and response transformation.
 */

import { tool } from '@langchain/core/tools';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolConfig } from '../types/tool-config.js';
import { validateToolConfig } from '../types/tool-config.js';
import type { TushareApiClient } from './api.js';
import { CacheStrategy } from '../types/api.js';
import { TushareError } from './error.js';
import { formatToolResult, sortTimeSeriesData, normaliseRows } from '../utils/formatting.js';

// ============================================================================
// Schema Generation
// ============================================================================

/** Descriptions for common Tushare parameters used in generated schemas. */
const PARAM_DESCRIPTIONS: Record<string, string> = {
  ts_code:
    'Stock code in Tushare format: 000001.SZ (Shenzhen), 600519.SH (Shanghai), 830799.BJ (BSE). Use get_cn_stock_list to look up codes.',
  start_date: "Start date in YYYYMMDD format, e.g. '20240101'.",
  end_date: "End date in YYYYMMDD format, e.g. '20241231'.",
  trade_date: "Trade date in YYYYMMDD format, e.g. '20240115'.",
  period:
    "Report period end date in YYYYMMDD format, e.g. '20231231' for annual, '20230630' for H1.",
  report_type:
    'Report type: 1=consolidated (default), 2=consolidated adjusted, 4=parent company, 5=parent adjusted.',
  exchange: 'Exchange: SSE (Shanghai), SZSE (Shenzhen), BSE (Beijing).',
  list_status: 'Listing status: L=listed, D=delisted, P=paused.',
  limit_type: 'Limit type: U=limit up (涨停), D=limit down (跌停).',
};

/**
 * Generates a Zod schema for a tool based on its config.
 *
 * Schema is derived from apiName and parameterNames, covering the common
 * Tushare parameter patterns without requiring a pre-built schema in the config.
 */
export function generateSchema(config: ToolConfig): z.ZodObject<z.ZodRawShape> {
  const { apiName, parameterNames, name } = config;

  const hasStockCode = !!parameterNames?.stockCode;
  const hasDateRange = !!(parameterNames?.startDate || parameterNames?.endDate);

  const isFinancialStatement = ['income', 'balancesheet', 'cashflow', 'fina_indicator'].includes(
    apiName
  );
  const isReferenceData = ['stock_basic', 'trade_cal'].includes(apiName);
  const isDailyPrice = ['daily', 'daily_basic'].includes(apiName);
  const isMarketData = ['moneyflow_hsgt', 'margin', 'block_trade', 'limit_list'].includes(apiName);
  const isWeekMonthAdj = apiName === 'stk_week_month_adj';

  if (isFinancialStatement) {
    return z.object({
      ts_code: z.string().describe(PARAM_DESCRIPTIONS['ts_code']!),
      period: z.string().optional().describe(PARAM_DESCRIPTIONS['period']!),
      start_date: z.string().optional().describe(PARAM_DESCRIPTIONS['start_date']!),
      end_date: z.string().optional().describe(PARAM_DESCRIPTIONS['end_date']!),
      report_type: z
        .enum(['1', '2', '3', '4', '5', '11', '12'])
        .default('1')
        .describe(PARAM_DESCRIPTIONS['report_type']!),
    });
  }

  if (isDailyPrice) {
    if (hasDateRange) {
      // get_cn_stock_prices: ts_code + date range required
      return z.object({
        ts_code: z.string().describe(PARAM_DESCRIPTIONS['ts_code']!),
        start_date: z.string().describe(PARAM_DESCRIPTIONS['start_date']!),
        end_date: z.string().describe(PARAM_DESCRIPTIONS['end_date']!),
      });
    }
    // get_cn_stock_price / get_cn_stock_basic: optional trade_date
    const isOptionalCode = name === 'get_cn_stock_basic';
    return z.object({
      ts_code: isOptionalCode
        ? z
            .string()
            .optional()
            .describe(
              PARAM_DESCRIPTIONS['ts_code']! +
                ' If omitted, returns all stocks for the given trade_date.'
            )
        : z.string().describe(PARAM_DESCRIPTIONS['ts_code']!),
      trade_date: z
        .string()
        .optional()
        .describe(
          PARAM_DESCRIPTIONS['trade_date']! + ' If omitted, returns most recent trading day.'
        ),
    });
  }

  if (isWeekMonthAdj) {
    return z.object({
      ts_code: z.string().optional().describe(PARAM_DESCRIPTIONS['ts_code']!),
      freq: z.enum(['week', 'month']).describe("Frequency: 'week' for weekly bars, 'month' for monthly bars."),
      trade_date: z.string().optional().describe(PARAM_DESCRIPTIONS['trade_date']!),
      start_date: z.string().optional().describe(PARAM_DESCRIPTIONS['start_date']!),
      end_date: z.string().optional().describe(PARAM_DESCRIPTIONS['end_date']!),
    });
  }

  if (isMarketData) {
    if (apiName === 'limit_list') {
      return z.object({
        trade_date: z.string().describe(PARAM_DESCRIPTIONS['trade_date']!),
        limit_type: z
          .enum(['U', 'D'])
          .optional()
          .describe(PARAM_DESCRIPTIONS['limit_type']!),
      });
    }
    // moneyflow_hsgt, margin, block_trade: optional date filters
    return z.object({
      ...(hasStockCode
        ? { ts_code: z.string().optional().describe(PARAM_DESCRIPTIONS['ts_code']!) }
        : {}),
      trade_date: z.string().optional().describe(PARAM_DESCRIPTIONS['trade_date']!),
      start_date: z.string().optional().describe(PARAM_DESCRIPTIONS['start_date']!),
      end_date: z.string().optional().describe(PARAM_DESCRIPTIONS['end_date']!),
    });
  }

  const isExpress = apiName === 'express';

  if (isExpress) {
    return z.object({
      ts_code: z.string().describe(PARAM_DESCRIPTIONS['ts_code']!),
      ann_date: z.string().optional().describe(PARAM_DESCRIPTIONS['ann_date'] ?? 'Announcement date in YYYYMMDD format.'),
      start_date: z.string().optional().describe(PARAM_DESCRIPTIONS['start_date']!),
      end_date: z.string().optional().describe(PARAM_DESCRIPTIONS['end_date']!),
      period: z.string().optional().describe(PARAM_DESCRIPTIONS['period']!),
    });
  }

  const isForecast = apiName === 'forecast';

  if (isForecast) {
    return z.object({
      ts_code: z.string().optional().describe(PARAM_DESCRIPTIONS['ts_code']!),
      ann_date: z.string().optional().describe(PARAM_DESCRIPTIONS['ann_date'] ?? 'Announcement date in YYYYMMDD format, e.g. "20190131".'),
      start_date: z.string().optional().describe(PARAM_DESCRIPTIONS['start_date']!),
      end_date: z.string().optional().describe(PARAM_DESCRIPTIONS['end_date']!),
      period: z.string().optional().describe(PARAM_DESCRIPTIONS['period']!),
      type: z
        .enum(['预增', '预减', '扭亏', '首亏', '续亏', '续盈', '略增', '略减'])
        .optional()
        .describe('业绩预告类型'),
    });
  }

  if (isReferenceData) {
    if (apiName === 'stock_basic') {
      return z.object({
        list_status: z
          .enum(['L', 'D', 'P'])
          .optional()
          .describe(PARAM_DESCRIPTIONS['list_status']!),
        exchange: z
          .enum(['SSE', 'SZSE', 'BSE'])
          .optional()
          .describe(PARAM_DESCRIPTIONS['exchange']!),
      });
    }
    // trade_cal
    return z.object({
      exchange: z
        .enum(['SSE', 'SZSE', 'BSE'])
        .optional()
        .describe(PARAM_DESCRIPTIONS['exchange']!),
      start_date: z.string().optional().describe(PARAM_DESCRIPTIONS['start_date']!),
      end_date: z.string().optional().describe(PARAM_DESCRIPTIONS['end_date']!),
    });
  }

  // Fallback: generic schema based on parameterNames hints
  return z.object({
    ...(hasStockCode
      ? { ts_code: z.string().optional().describe(PARAM_DESCRIPTIONS['ts_code']!) }
      : {}),
    ...(hasDateRange
      ? {
          start_date: z.string().optional().describe(PARAM_DESCRIPTIONS['start_date']!),
          end_date: z.string().optional().describe(PARAM_DESCRIPTIONS['end_date']!),
        }
      : {}),
  });
}

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Factory for creating DynamicStructuredTool instances from ToolConfig objects.
 */
export class ToolFactory {
  constructor(private readonly apiClient: TushareApiClient) {}

  /**
   * Validate a single tool configuration.
   * Throws a descriptive TushareError if the config is invalid.
   */
  validateConfig(config: unknown): ToolConfig {
    try {
      return validateToolConfig(config);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new TushareError(
        `Invalid tool configuration: ${detail}`,
        'INVALID_TOOL_CONFIG',
        'Check that the config follows the ToolConfig schema (name, description, apiName, cacheStrategy are required)'
      );
    }
  }

  /**
   * Create a single DynamicStructuredTool from a ToolConfig.
   * Validates the config, generates a Zod schema, and wires up the API call.
   */
  createTool(config: ToolConfig): DynamicStructuredTool {
    const validated = this.validateConfig(config);
    const schema = generateSchema(validated);
    const apiClient = this.apiClient;

    return tool(
      async (input) => {
        // Run custom validation if provided
        if (validated.validate) {
          validated.validate(input as Record<string, unknown>);
        }

        // Build params — strip undefined values
        const params: Record<string, string | number | undefined> = {};
        for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
          if (v !== undefined) {
            params[k] = v as string | number;
          }
        }

        // Determine returnSingle
        const returnSingle =
          typeof validated.returnSingle === 'function'
            ? (validated.returnSingle as (input: Record<string, unknown>) => boolean)(input as Record<string, unknown>)
            : (validated.returnSingle ?? false);

        // Call API
        const response = await apiClient.call<Record<string, unknown>[]>({
          apiName: validated.apiName,
          params,
          fields: validated.fields,
          options: {
            cacheable: validated.cacheStrategy !== CacheStrategy.NO_CACHE,
            cacheStrategy: validated.cacheStrategy,
          },
        });

        // Apply field mappings if configured
        let data = response.data;
        if (validated.fieldMappings && data.length > 0) {
          data = applyFieldMappings(data, validated.fieldMappings);
        }

        // Apply custom transform if provided
        if (validated.transform) {
          data = (validated.transform as (d: unknown) => Record<string, unknown>[])(data);
        }

        // Normalise null/undefined values consistently across all tools
        data = normaliseRows(data);

        // Sort time-series data descending by date (most recent first)
        if (!returnSingle) {
          data = sortTimeSeriesData(data);
        }

        // Return single item or array
        const result = returnSingle ? (data[0] ?? {}) : data;

        // Build standardised output envelope.
        // Prefer per-tool doc URL from config over the generic API client URL.
        const sourceUrls = validated.sourceUrl
          ? [validated.sourceUrl]
          : response.sourceUrls;
        const formatted = formatToolResult(result, sourceUrls, response.metadata);
        return JSON.stringify(formatted);
      },
      {
        name: validated.name,
        description: validated.description,
        schema,
      }
    ) as DynamicStructuredTool;
  }

  /**
   * Create multiple tools from an array of configs.
   * Validates ALL configs before creating any tools so startup failures are caught early.
   */
  createTools(configs: ToolConfig[]): DynamicStructuredTool[] {
    // Validate all first — fail fast before creating any tools
    const validated = configs.map((config, index) => {
      try {
        return this.validateConfig(config);
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        const toolName = (config as { name?: string }).name ?? 'unknown';
        throw new TushareError(
          `Tool config at index ${index} ("${toolName}") is invalid: ${detail}`,
          'INVALID_TOOL_CONFIG',
          'Fix the configuration error before starting the application'
        );
      }
    });

    return validated.map((config) => this.createTool(config));
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Apply field mappings to rename response fields.
 */
function applyFieldMappings(
  data: Record<string, unknown>[],
  mappings: Record<string, string>
): Record<string, unknown>[] {
  return data.map((row) => {
    const mapped: Record<string, unknown> = { ...row };
    for (const [from, to] of Object.entries(mappings)) {
      if (from in mapped) {
        mapped[to] = mapped[from];
        delete mapped[from];
      }
    }
    return mapped;
  });
}
