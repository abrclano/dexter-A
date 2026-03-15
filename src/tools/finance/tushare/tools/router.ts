/**
 * Enhanced cn_market_search router
 *
 * Routes natural language queries to appropriate Tushare tools using a
 * two-phase approach:
 *   1. LLM selects tools from a compact summary index (~1K tokens)
 *   2. Selected tools are executed in parallel with partial-failure tolerance
 *
 * Key features:
 * - Tool summary index to reduce token usage vs full descriptions
 * - Stock code resolution for ambiguous company names
 * - Parallel execution with Promise.allSettled
 * - Result size limiting (20K chars per tool)
 * - Result deduplication by ts_code + date
 * - Progress callbacks for CLI feedback
 * - Query pattern tracking via MetricsTracker
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
import type { ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../../../model/llm.js';
import { formatToolResult } from '../../../types.js';
import { getCurrentDate } from '../../../../agent/prompts.js';
import { MetricsTrackerImpl } from '../core/metrics.js';

import { getCnStockPrice, getCnStockPrices, getCnStockWeekMonthAdj } from './price/daily.js';
import { getCnStockBasic } from './price/basic.js';
import { getCnIncome, getCnBalance, getCnCashflow, getCnIndicators } from './fundamentals/index.js';
import {
  getCnNorthboundFlow,
  getCnMarginData,
  getCnBlockTrades,
  getCnLimitList,
} from './market/index.js';
import { getCnStockList, getCnTradeCalendar } from './reference/index.js';

// ============================================================================
// Tool Registry
// ============================================================================

/** All tools available to the router */
const ALL_TOOLS: StructuredToolInterface[] = [
  getCnStockPrice,
  getCnStockPrices,
  getCnStockWeekMonthAdj,
  getCnStockBasic,
  getCnIncome,
  getCnBalance,
  getCnCashflow,
  getCnIndicators,
  getCnNorthboundFlow,
  getCnMarginData,
  getCnBlockTrades,
  getCnLimitList,
  getCnStockList,
  getCnTradeCalendar,
];

const TOOL_MAP = new Map<string, StructuredToolInterface>(ALL_TOOLS.map((t) => [t.name, t]));

// ============================================================================
// Tool Summary Index (Task 13.0)
// Concise 1-2 sentence summaries for initial LLM selection (~1K tokens total)
// Full descriptions are loaded only for selected tools during execution.
// ============================================================================

interface ToolSummary {
  name: string;
  category: 'price' | 'fundamentals' | 'market' | 'reference';
  summary: string;
}

const TOOL_SUMMARIES: ToolSummary[] = [
  // Price
  {
    name: 'get_cn_stock_price',
    category: 'price',
    summary: 'Get the latest daily OHLCV price for a single A-share stock (most recent trading day).',
  },
  {
    name: 'get_cn_stock_prices',
    category: 'price',
    summary: 'Get historical daily OHLCV prices for an A-share stock over a date range.',
  },
  {
    name: 'get_cn_stock_week_month_adj',
    category: 'price',
    summary: 'Get weekly or monthly adjusted (前复权/后复权) OHLCV prices for an A-share stock.',
  },
  {
    name: 'get_cn_stock_basic',
    category: 'price',
    summary: 'Get daily valuation metrics (PE, PB, PS, market cap, turnover rate) for A-share stocks.',
  },
  // Fundamentals
  {
    name: 'get_cn_income',
    category: 'fundamentals',
    summary: 'Get income statement (revenue, profit, EPS) for a Chinese A-share company.',
  },
  {
    name: 'get_cn_balance',
    category: 'fundamentals',
    summary: 'Get balance sheet (assets, liabilities, equity) for a Chinese A-share company.',
  },
  {
    name: 'get_cn_cashflow',
    category: 'fundamentals',
    summary: 'Get cash flow statement (operating, investing, financing, free cash flow) for an A-share company.',
  },
  {
    name: 'get_cn_indicators',
    category: 'fundamentals',
    summary: 'Get pre-calculated financial ratios (ROE, ROA, margins, growth rates) for an A-share company.',
  },
  // Market
  {
    name: 'get_cn_northbound_flow',
    category: 'market',
    summary: 'Get aggregate northbound capital flow data through Hong Kong Stock Connect (北向资金).',
  },
  {
    name: 'get_cn_margin_data',
    category: 'market',
    summary: 'Get margin trading and short selling data (融资融券) for A-share stocks.',
  },
  {
    name: 'get_cn_block_trades',
    category: 'market',
    summary: 'Get block trade (大宗交易) records showing large institutional transactions.',
  },
  {
    name: 'get_cn_limit_list',
    category: 'market',
    summary: 'Get daily limit-up/limit-down list (涨跌停) for A-share stocks on a given date.',
  },
  // Reference
  {
    name: 'get_cn_stock_list',
    category: 'reference',
    summary: 'Get the full A-share stock list with codes and names; use to resolve company names to ts_code.',
  },
  {
    name: 'get_cn_trade_calendar',
    category: 'reference',
    summary: 'Get the trading calendar showing which dates are trading days for Chinese exchanges.',
  },
];

/** Compact index string sent to LLM for tool selection */
const TOOL_SUMMARY_INDEX = TOOL_SUMMARIES.map((t) => `${t.name}: ${t.summary}`).join('\n');

// ============================================================================
// Metrics (shared singleton for query pattern tracking — Task 13.15)
// ============================================================================

const routerMetrics = new MetricsTrackerImpl();

// ============================================================================
// Router Prompt Builder (Task 13.1)
// ============================================================================

function buildSelectionPrompt(): string {
  return `You are a Chinese A-share stock market data routing assistant.
Current date: ${getCurrentDate()}

Given a user query, call the appropriate tool(s) from the list below.

## Available Tools

${TOOL_SUMMARY_INDEX}

## Guidelines

### Stock Code Resolution (Task 13.2)
- If the query mentions a company by name (Chinese or English) and you don't know its ts_code,
  call get_cn_stock_list FIRST to resolve the code, then call the data tool.
- Well-known codes you can use directly:
  - 贵州茅台/茅台 → 600519.SH
  - 宁德时代 → 300750.SZ
  - 平安银行 → 000001.SZ
  - 比亚迪 → 002594.SZ
  - 中芯国际 → 688981.SH
  - 工商银行 → 601398.SH
  - 招商银行 → 600036.SH
  - 中国平安 → 601318.SH
  - 格力电器 → 000651.SZ
  - 美的集团 → 000333.SZ
- Shanghai codes: 6xxxxx.SH, 688xxx.SH (STAR Market)
- Shenzhen codes: 0xxxxx.SZ, 3xxxxx.SZ (ChiNext)
- Beijing codes: 8xxxxx.BJ

### Date Format
- Always YYYYMMDD (no hyphens)
- "去年" → 20250101 to 20251231
- "最近一周" → 7 days ago to today
- "2024年报" → period=20241231

### Tool Selection
- Current price → get_cn_stock_price
- Historical prices → get_cn_stock_prices
- 周线/月线/复权行情 → get_cn_stock_week_month_adj
- PE/PB/市值/换手率 → get_cn_stock_basic
- 营收/净利润/利润表 → get_cn_income
- 资产/负债/资产负债表 → get_cn_balance
- 现金流 → get_cn_cashflow
- ROE/ROA/毛利率/增长率 → get_cn_indicators
- 北向资金/外资 → get_cn_northbound_flow
- 融资融券 → get_cn_margin_data
- 大宗交易 → get_cn_block_trades
- 涨停/跌停 → get_cn_limit_list
- 股票代码查询 → get_cn_stock_list
- 交易日历 → get_cn_trade_calendar

Call the appropriate tool(s) now.`;
}

// ============================================================================
// Result Helpers
// ============================================================================

const MAX_RESULT_CHARS = 20_000;

/**
 * Limit a single tool result to MAX_RESULT_CHARS (Task 13.8).
 * Adds truncation metadata when the result is cut.
 */
function limitResultSize(data: unknown): unknown {
  if (!Array.isArray(data)) return data;

  const serialized = JSON.stringify(data);
  if (serialized.length <= MAX_RESULT_CHARS) return data;

  // Binary-search for the largest prefix that fits
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (JSON.stringify(data.slice(0, mid)).length <= MAX_RESULT_CHARS) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return {
    items: data.slice(0, lo),
    total_count: data.length,
    truncated: true,
    note: `Showing ${lo} of ${data.length} results (truncated to ${MAX_RESULT_CHARS} chars)`,
  };
}

/**
 * Deduplicate results by ts_code + date fields (Task 13.10).
 * Keeps the last-seen entry (most recently processed = most complete).
 */
function deduplicateResults(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>();

  for (const item of items) {
    const code = (item['ts_code'] as string | undefined) ?? '';
    const date =
      (item['trade_date'] as string | undefined) ??
      (item['end_date'] as string | undefined) ??
      (item['ann_date'] as string | undefined) ??
      (item['cal_date'] as string | undefined) ??
      '';
    const key = `${code}::${date}`;
    seen.set(key, item);
  }

  return Array.from(seen.values());
}

/**
 * Merge all successful tool results into a single deduplicated array or object map.
 */
function mergeResults(
  results: Array<{ tool: string; args: Record<string, unknown>; data: unknown; sourceUrls: string[] }>
): { combined: Record<string, unknown>; allUrls: string[] } {
  const combined: Record<string, unknown> = {};
  const allUrls: string[] = [];

  for (const r of results) {
    allUrls.push(...r.sourceUrls);

    const tsCode = r.args['ts_code'] as string | undefined;
    const key = tsCode ? `${r.tool}_${tsCode}` : r.tool;

    // Deduplicate array results
    if (Array.isArray(r.data)) {
      combined[key] = deduplicateResults(r.data as Record<string, unknown>[]);
    } else {
      combined[key] = r.data;
    }
  }

  return { combined, allUrls };
}

// ============================================================================
// Tool Execution (Tasks 13.4, 13.6)
// ============================================================================

interface ToolExecutionResult {
  tool: string;
  args: Record<string, unknown>;
  data: unknown;
  sourceUrls: string[];
  error: string | null;
}

/**
 * Execute a single tool call, catching errors for partial-failure tolerance.
 */
async function executeTool(tc: ToolCall): Promise<ToolExecutionResult> {
  const tool = TOOL_MAP.get(tc.name);
  if (!tool) {
    return {
      tool: tc.name,
      args: (tc.args as Record<string, unknown>) ?? {},
      data: null,
      sourceUrls: [],
      error: `Tool '${tc.name}' not found`,
    };
  }

  try {
    const rawResult = await tool.invoke(tc.args as Record<string, unknown>);
    const resultStr = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
    const parsed = JSON.parse(resultStr) as { data?: unknown; sourceUrls?: string[] };

    return {
      tool: tc.name,
      args: (tc.args as Record<string, unknown>) ?? {},
      data: limitResultSize(parsed.data),
      sourceUrls: parsed.sourceUrls ?? [],
      error: null,
    };
  } catch (err) {
    return {
      tool: tc.name,
      args: (tc.args as Record<string, unknown>) ?? {},
      data: null,
      sourceUrls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute all tool calls in parallel using Promise.allSettled for partial-failure
 * tolerance (Tasks 13.4, 13.6). Returns both successful and failed results.
 */
async function executeToolsInParallel(toolCalls: ToolCall[]): Promise<{
  successful: ToolExecutionResult[];
  failed: ToolExecutionResult[];
}> {
  // Promise.allSettled ensures we collect all results even if some reject
  const settled = await Promise.allSettled(toolCalls.map((tc) => executeTool(tc)));

  const successful: ToolExecutionResult[] = [];
  const failed: ToolExecutionResult[] = [];

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      if (result.value.error === null) {
        successful.push(result.value);
      } else {
        failed.push(result.value);
      }
    } else {
      // Promise itself rejected (shouldn't happen since executeTool catches, but be safe)
      failed.push({
        tool: 'unknown',
        args: {},
        data: null,
        sourceUrls: [],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  return { successful, failed };
}

// ============================================================================
// Router Schema & Description
// ============================================================================

export const CN_MARKET_SEARCH_DESCRIPTION = `
Intelligent meta-tool for Chinese A-share stock market data research. Takes a natural language query (Chinese or English) and automatically routes to appropriate Tushare data tools.

## When to Use

- Chinese A-share stock prices and historical data
- A-share valuation metrics (PE, PB, PS, market cap, turnover)
- Chinese company financial statements (income, balance sheet, cash flow)
- Key financial indicators (ROE, ROA, margins, growth rates)
- Northbound capital flows (Stock Connect / 北向资金)
- Margin trading data (融资融券)
- Block trades (大宗交易)
- Limit up/down lists (涨跌停)
- Stock code lookup by company name
- Trading calendar queries

## When NOT to Use

- US stocks or international markets (use financial_search instead)
- Hong Kong stocks (HK tools removed per configuration)
- General web searches (use web_search)
- Questions that don't require Chinese A-share market data

## Usage Notes

- Accepts both Chinese and English queries
- Handles company name → ts_code resolution (茅台 → 600519.SH, 宁德时代 → 300750.SZ)
- Date format: YYYYMMDD (no hyphens)
- A-share code format: 000001.SZ (Shenzhen), 600519.SH (Shanghai), 830799.BJ (BSE)
`.trim();

const CnMarketSearchSchema = z.object({
  query: z.string().describe(
    'Natural language query about Chinese A-share market data (Chinese or English)'
  ),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createCnMarketSearch(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'cn_market_search',
    description: CN_MARKET_SEARCH_DESCRIPTION,
    schema: CnMarketSearchSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      const startTime = Date.now();

      onProgress?.('Searching Chinese market data...');

      // ── Phase 1: Tool selection via compact summary index (Task 13.1) ──────
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildSelectionPrompt(),
        tools: ALL_TOOLS,
      });

      // Handle text response (no tools selected — Task 13.13)
      if (typeof response === 'string') {
        routerMetrics.recordApiCall('router_no_match', Date.now() - startTime, false);
        return formatToolResult(
          {
            error: 'No appropriate tools found for this query',
            suggestion:
              'Try rephrasing your query. For stock prices use a ts_code like "600519.SH". ' +
              'For company lookup use "find stock code for [company name]".',
            query: input.query,
          },
          []
        );
      }

      const aiMessage = response as AIMessage;
      const toolCalls = (aiMessage.tool_calls ?? []) as ToolCall[];

      // No tool calls selected (Task 13.13)
      if (toolCalls.length === 0) {
        routerMetrics.recordApiCall('router_no_match', Date.now() - startTime, false);
        return formatToolResult(
          {
            error: 'No appropriate tools found for this query',
            suggestion:
              'Available data: A-share prices, financials (income/balance/cashflow/indicators), ' +
              'northbound flow, margin data, block trades, limit lists, stock list, trade calendar.',
            query: input.query,
          },
          []
        );
      }

      // ── Phase 2: Progress update (Task 13.12) ────────────────────────────
      const uniqueToolNames = [...new Set(toolCalls.map((tc) => tc.name))];
      const displayNames = uniqueToolNames
        .map((n) => n.replace(/^get_cn_/, '').replace(/_/g, ' '))
        .join(', ');
      onProgress?.(`Fetching: ${displayNames}...`);

      // Track query pattern (Task 13.15)
      routerMetrics.recordApiCall(`router_query`, Date.now() - startTime, false);
      for (const tc of toolCalls) {
        routerMetrics.recordApiCall(`router_selected:${tc.name}`, 0, false);
      }

      // ── Phase 3: Parallel execution with partial-failure tolerance ────────
      const { successful, failed } = await executeToolsInParallel(toolCalls);

      // Progress: report completion (Task 13.12)
      if (successful.length > 0) {
        const completedNames = successful
          .map((r) => r.tool.replace(/^get_cn_/, '').replace(/_/g, ' '))
          .join(', ');
        onProgress?.(`Completed: ${completedNames}`);
      }

      // ── Phase 4: Merge, deduplicate, and build response ──────────────────
      const { combined, allUrls } = mergeResults(successful);

      // Attach error details for failed tools (Task 13.6)
      if (failed.length > 0) {
        combined['_errors'] = failed.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
        for (const f of failed) {
          routerMetrics.recordError(`router_selected:${f.tool}`, 'tool_execution_error');
        }
      }

      return formatToolResult(combined, allUrls);
    },
  });
}
