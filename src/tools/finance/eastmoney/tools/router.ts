/**
 * Eastmoney LangChain tool definitions.
 *
 * Each Eastmoney skill is exposed as a separate DynamicStructuredTool with
 * its own typed schema so the LLM can call them via proper function calling
 * rather than relying on fragile natural-language dispatch.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { formatToolResult } from '../../../types.js';
import { queryEastmoneyFinancialData } from '../eastmoney-data.js';
import { queryEastmoneyNews } from '../eastmoney-search.js';
import { querySelectStock } from '../eastmoney-select-stock.js';
import { manageSelfSelect } from '../eastmoney-selfselect.js';
import {
  queryPositions,
  queryBalance,
  queryOrders,
  executeTrade,
  cancelOrder,
} from '../eastmoney-stock-simulator.js';

// ── Tool descriptions (injected into system prompt) ───────────────────────────

export const EASTMONEY_DATA_DESCRIPTION = `
Query structured financial data, market quotes, and fundamental metrics for Chinese A-shares using Eastmoney's authoritative database. Provides real-time, accurate data to avoid model misconceptions based on outdated knowledge.

**Market Data** – Real-time prices, capital flows, PE/PB valuations for stocks, sectors, indices, funds, bonds.
**Fundamental Data** – Revenue, net profit, assets, liabilities, executive info, shareholder structure.
**Relationship Data** – Corporate relationships between stocks, companies, shareholders, executives.

Use when: "东方财富最新价", "贵州茅台市盈率", "宁德时代营收", "BYD主要股东"
Do NOT use for: news/events → EASTMONEY_SEARCH | trading → EASTMONEY_STOCK_SIMULATOR | watchlist → EASTMONEY_SELFSELECT

Requires: MX_APIKEY
`;

export const EASTMONEY_SEARCH_DESCRIPTION = `
Search financial news, announcements, research reports, and policy updates in Chinese markets using Eastmoney's intelligent news filtering.

**News & Announcements** – Real-time market news, company disclosures, regulatory announcements.
**Research & Analysis** – Analyst reports, industry deep-dives, investment ratings.
**Policy & Macro** – Government policies, trading rules, macroeconomic commentary.

Use when: "BYD最新新闻", "A股今日大跌原因", "AI行业研报", "新能源政策解读"
Do NOT use for: specific numbers → EASTMONEY_DATA | trading → EASTMONEY_STOCK_SIMULATOR

Requires: MX_APIKEY
`;

export const EASTMONEY_SELECT_STOCK_DESCRIPTION = `
Intelligent stock selection based on natural language criteria. Filters A-shares, sectors, funds, and ETFs by financial or technical conditions.

Use when: "市盈率低于20的半导体股票", "今日涨幅超2%的股票", "股息率大于3%的蓝筹股"
Do NOT use for: single stock data → EASTMONEY_DATA | trading → EASTMONEY_STOCK_SIMULATOR

Requires: MX_APIKEY
`;

export const EASTMONEY_SELFSELECT_DESCRIPTION = `
Manage personal stock watchlists from your Eastmoney account. Query, add, or remove stocks using structured actions.

Actions: query (list watchlist) | add (add a stock) | remove (remove a stock)

Use when: "查看我的自选股", "把贵州茅台加入自选", "删除宁德时代自选"
Do NOT use for: trading → EASTMONEY_STOCK_SIMULATOR | price data → EASTMONEY_DATA

Requires: MX_APIKEY
`;

export const EASTMONEY_STOCK_SIMULATOR_DESCRIPTION = `
Execute virtual stock trading and manage a simulated A-share portfolio. The ONLY tool for position, trade, and order operations.

**Trading** – Buy/sell with limit or market price orders.
**Orders** – Query pending orders, cancel by ID or cancel all.
**Account** – Check positions, available funds, total assets, trade history.

Use when: "买入100股贵州茅台", "查询我的持仓", "撤销委托123", "账户余额"
Do NOT use for: price queries → EASTMONEY_DATA | news → EASTMONEY_SEARCH | watchlist → EASTMONEY_SELFSELECT

Requires: MX_APIKEY
⚠️ All operations use virtual capital – no real funds involved.
`;

// ── Tool factory ──────────────────────────────────────────────────────────────

/** eastmoney_mx_data – structured financial data query */
export function createEastmoneyDataTool(_model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'eastmoney_mx_data',
    description: 'Query structured financial data (prices, fundamentals, valuations) for Chinese stocks via Eastmoney.',
    schema: z.object({
      toolQuery: z.string().describe('Natural language query, e.g. "东方财富最新价", "贵州茅台市盈率"'),
    }),
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      onProgress?.('Querying Eastmoney financial data...');

      const result = await queryEastmoneyFinancialData(input.toolQuery);

      if (!result.success) {
        return formatToolResult({ error: result.error, query: input.toolQuery }, []);
      }

      onProgress?.('Financial data retrieved');
      return formatToolResult(
        { query: input.toolQuery, summary: result.summary, data: result.data },
        []
      );
    },
  });
}

/** eastmoney_mx_search – financial news / research search */
export function createEastmoneySearchTool(_model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'eastmoney_mx_search',
    description: 'Search financial news, announcements, and research reports via Eastmoney.',
    schema: z.object({
      query: z.string().describe('Search query, e.g. "立讯精密最新研报", "A股今日大跌原因"'),
    }),
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      onProgress?.('Searching Eastmoney news...');

      const result = await queryEastmoneyNews(input.query);

      if (!result.success) {
        return formatToolResult({ error: result.error, query: input.query }, []);
      }

      onProgress?.('News search completed');
      return formatToolResult(
        { query: input.query, summary: result.summary, data: result.data },
        []
      );
    },
  });
}

/** eastmoney_mx_select_stock – intelligent stock screening */
export function createEastmoneySelectStockTool(_model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'eastmoney_mx_select_stock',
    description: 'Screen and filter Chinese stocks by natural language criteria via Eastmoney.',
    schema: z.object({
      keyword: z.string().describe('Stock selection criteria, e.g. "市盈率低于20的半导体股票"'),
      pageNo: z.number().int().min(1).default(1).describe('Page number (default 1)'),
      pageSize: z.number().int().min(1).max(100).default(20).describe('Results per page (default 20, max 100)'),
    }),
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      onProgress?.('Screening stocks...');

      const result = await querySelectStock(input.keyword, input.pageNo, input.pageSize);

      if (!result.success) {
        return formatToolResult({ error: result.error, keyword: input.keyword }, []);
      }

      onProgress?.(`Found ${result.total} matching stocks`);
      return formatToolResult(
        { keyword: input.keyword, total: result.total, summary: result.summary, rows: result.rows },
        []
      );
    },
  });
}

/** eastmoney_mx_selfselect – watchlist management */
export function createEastmoneySelfSelectTool(_model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'eastmoney_mx_selfselect',
    description: 'Manage Eastmoney personal stock watchlist: query, add, or remove stocks.',
    schema: z.object({
      action: z
        .enum(['query', 'add', 'remove'])
        .describe('"query" to list watchlist, "add" to add a stock, "remove" to remove a stock'),
      stockNameOrCode: z
        .string()
        .optional()
        .describe('Stock name or code (required for add/remove), e.g. "贵州茅台" or "600519"'),
    }),
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      onProgress?.(`Self-select: ${input.action}...`);

      const result = await manageSelfSelect(input.action, input.stockNameOrCode);

      if (!result.success) {
        return formatToolResult({ error: result.error, action: input.action }, []);
      }

      onProgress?.('Self-select operation completed');
      return formatToolResult(
        {
          action: input.action,
          message: result.message,
          summary: result.summary,
          stocks: result.stocks,
        },
        []
      );
    },
  });
}

/** eastmoney_mx_stock_simulator – simulated trading */
export function createEastmoneyStockSimulatorTool(_model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'eastmoney_mx_stock_simulator',
    description:
      'Simulated A-share trading: buy/sell stocks, query positions, check balance, manage orders.',
    schema: z.object({
      action: z
        .enum(['positions', 'balance', 'orders', 'trade', 'cancel'])
        .describe(
          '"positions" = query holdings | "balance" = query funds | "orders" = query order history | "trade" = buy/sell | "cancel" = cancel order(s)'
        ),
      // --- trade fields ---
      tradeType: z
        .enum(['buy', 'sell'])
        .optional()
        .describe('[trade] "buy" or "sell"'),
      stockCode: z
        .string()
        .optional()
        .describe('[trade/cancel] 6-digit A-share code, e.g. "600519"'),
      price: z
        .number()
        .optional()
        .describe('[trade] Limit price in yuan; omit when useMarketPrice=true'),
      quantity: z
        .number()
        .int()
        .optional()
        .describe('[trade] Number of shares, must be a multiple of 100'),
      useMarketPrice: z
        .boolean()
        .optional()
        .describe('[trade] Use latest market price instead of limit price (default false)'),
      // --- cancel fields ---
      cancelType: z
        .enum(['order', 'all'])
        .optional()
        .describe('[cancel] "order" = cancel specific order, "all" = cancel all pending'),
      orderId: z
        .string()
        .optional()
        .describe('[cancel] Order ID, required when cancelType="order"'),
      // --- orders filter fields ---
      fltOrderDrt: z
        .number()
        .int()
        .optional()
        .describe('[orders] Direction filter: 0=all (default), 1=buy, 2=sell'),
      fltOrderStatus: z
        .number()
        .int()
        .optional()
        .describe('[orders] Status filter: 0=all (default), 2=submitted, 4=filled'),
    }),
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      onProgress?.(`Stock simulator: ${input.action}...`);

      let result: { success: boolean; data?: unknown; summary?: string; message?: string; error?: string } =
        { success: false, error: 'Unknown action' };

      switch (input.action) {
        case 'positions':
          result = await queryPositions();
          break;
        case 'balance':
          result = await queryBalance();
          break;
        case 'orders':
          result = await queryOrders({
            fltOrderDrt: input.fltOrderDrt,
            fltOrderStatus: input.fltOrderStatus,
          });
          break;
        case 'trade':
          result = await executeTrade({
            type: input.tradeType!,
            stockCode: input.stockCode!,
            price: input.price,
            quantity: input.quantity!,
            useMarketPrice: input.useMarketPrice,
          });
          break;
        case 'cancel':
          result = await cancelOrder({
            type: input.cancelType ?? 'all',
            orderId: input.orderId,
            stockCode: input.stockCode,
          });
          break;
      }

      if (!result.success) {
        return formatToolResult({ error: result.error, action: input.action }, []);
      }

      onProgress?.(`${input.action} completed`);
      return formatToolResult(
        {
          action: input.action,
          message: result.message,
          summary: result.summary,
          data: result.data,
        },
        []
      );
    },
  });
}


