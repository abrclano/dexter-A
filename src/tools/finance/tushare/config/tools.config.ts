/**
 * Tool configurations for Tushare module
 * Centralized configuration for all tools and API settings
 */

import { CacheStrategy } from '../types/api.js';
import type { ToolConfig } from '../types/tool-config.js';
import { validateStockCode, validateDate, validateDateRange } from '../utils/validation.js';

// ============================================================================
// API Configuration
// ============================================================================

/**
 * API client configuration
 * Defines timeout, retry, and concurrency limits
 */
export const API_CONFIG = {
  /** Base URL for Tushare API */
  baseUrl: 'https://api.tushare.pro',
  /** Request timeout in milliseconds */
  timeout: 30000,
  /** Maximum number of retries for failed requests */
  maxRetries: 3,
  /** Maximum concurrent requests */
  maxConcurrent: 5,
  /** Retry delay configuration */
  retryDelay: {
    /** Base delay in milliseconds */
    base: 1000,
    /** Exponential backoff multiplier */
    multiplier: 2,
    /** Maximum delay cap in milliseconds */
    max: 10000,
  },
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache manager configuration
 * Defines size limits and TTL strategies
 */
export const CACHE_CONFIG = {
  /** Maximum cache size in bytes (100MB) */
  maxSize: 100 * 1024 * 1024,
  /** TTL strategies in milliseconds */
  strategies: {
    [CacheStrategy.HISTORICAL]: Infinity,
    [CacheStrategy.CURRENT_DAY]: 5 * 60 * 1000, // 5 minutes
    [CacheStrategy.FINANCIAL]: 24 * 60 * 60 * 1000, // 24 hours
    [CacheStrategy.REFERENCE]: 7 * 24 * 60 * 60 * 1000, // 7 days
    [CacheStrategy.NO_CACHE]: 0,
  },
} as const;

// ============================================================================
// Tool Configurations
// ============================================================================

/**
 * All tool configurations
 * Each config defines a tool's behavior, API endpoint, caching strategy, and validation
 */
export const TOOL_CONFIGS: ToolConfig[] = [
  // ============================================================================
  // Price Tools
  // ============================================================================

  {
    name: 'get_cn_stock_price',
    description: `Fetches the latest daily OHLCV (Open, High, Low, Close, Volume) price data for a Chinese A-share stock.

When to Use:
- Get the most recent trading day's price data for a single stock
- Check current price, daily change, and trading volume
- Retrieve OHLCV data for technical analysis

When NOT to Use:
- For historical price ranges (use get_cn_stock_prices instead)
- For valuation metrics like PE ratio (use get_cn_stock_basic instead)
- For intraday or real-time prices (Tushare provides end-of-day data only)

Example:
- ts_code: "600519.SH" (Kweichow Moutai)
- trade_date: "20240115" (optional, defaults to latest trading day)

Returns: Single price record with fields: ts_code, trade_date, open, high, low, close, pre_close, change, pct_chg, vol, amount`,
    apiName: 'daily',
    fields: [
      'ts_code',
      'trade_date',
      'open',
      'high',
      'low',
      'close',
      'pre_close',
      'change',
      'pct_chg',
      'vol',
      'amount',
    ],
    cacheStrategy: CacheStrategy.CURRENT_DAY,
    returnSingle: true,
    validate: (input: any) => {
      validateStockCode(input.ts_code);
      if (input.trade_date) {
        validateDate(input.trade_date);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
    },
  },

  {
    name: 'get_cn_stock_prices',
    description: `Retrieves historical daily OHLCV price data for a Chinese A-share stock over a date range.

When to Use:
- Analyze price trends over weeks, months, or years
- Calculate historical returns and volatility
- Build price charts and technical indicators
- Backtest trading strategies

When NOT to Use:
- For just the latest price (use get_cn_stock_price instead)
- For valuation metrics (use get_cn_stock_basic instead)
- For intraday data (not available in Tushare)

Example:
- ts_code: "000001.SZ" (Ping An Bank)
- start_date: "20230101"
- end_date: "20231231"

Returns: Array of price records sorted by date (most recent first), each with fields: ts_code, trade_date, open, high, low, close, pre_close, pct_chg, vol, amount`,
    apiName: 'daily',
    fields: [
      'ts_code',
      'trade_date',
      'open',
      'high',
      'low',
      'close',
      'pre_close',
      'pct_chg',
      'vol',
      'amount',
    ],
    cacheStrategy: CacheStrategy.HISTORICAL,
    validate: (input: any) => {
      validateStockCode(input.ts_code);
      validateDateRange(input.start_date, input.end_date);
    },
    parameterNames: {
      stockCode: 'ts_code',
      startDate: 'start_date',
      endDate: 'end_date',
    },
  },

  {
    name: 'get_cn_stock_basic',
    description: `Fetches daily valuation metrics and market statistics for Chinese A-share stocks.

When to Use:
- Get valuation ratios: PE, PB, PS ratios
- Check market capitalization and shares outstanding
- Analyze turnover rate and trading activity
- Compare valuations across stocks

When NOT to Use:
- For price data only (use get_cn_stock_price instead)
- For financial statement ratios (use get_cn_indicators instead)
- For historical valuation trends over long periods (data may be large)

Example:
- ts_code: "600519.SH" (optional, omit to get all stocks)
- trade_date: "20240115" (optional, defaults to latest trading day)

Returns: Valuation metrics with fields: ts_code, trade_date, close, turnover_rate, turnover_rate_f, volume_ratio, pe, pe_ttm, pb, ps, ps_ttm, dv_ratio, dv_ttm, total_share, float_share, total_mv, circ_mv`,
    apiName: 'daily_basic',
    fields: [
      'ts_code',
      'trade_date',
      'close',
      'turnover_rate',
      'turnover_rate_f',
      'volume_ratio',
      'pe',
      'pe_ttm',
      'pb',
      'ps',
      'ps_ttm',
      'dv_ratio',
      'dv_ttm',
      'total_share',
      'float_share',
      'total_mv',
      'circ_mv',
    ],
    cacheStrategy: CacheStrategy.CURRENT_DAY,
    returnSingle: (input: any) => !!input.ts_code,
    validate: (input: any) => {
      if (input.ts_code) {
        validateStockCode(input.ts_code);
      }
      if (input.trade_date) {
        validateDate(input.trade_date);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
    },
  },

  // ============================================================================
  // Fundamental Tools
  // ============================================================================

  {
    name: 'get_cn_income',
    description: `Fetches income statement data for Chinese A-share companies.

When to Use:
- Analyze revenue, profit margins, and profitability trends
- Get operating expenses breakdown (selling, admin, R&D, financial)
- Calculate earnings per share (EPS) and profit metrics
- Compare financial performance across periods

When NOT to Use:
- For balance sheet data (use get_cn_balance instead)
- For cash flow data (use get_cn_cashflow instead)
- For calculated financial ratios (use get_cn_indicators instead)

Example:
- ts_code: "600519.SH"
- period: "20231231" (fiscal period end date, typically quarter or year end)
- report_type: "1" (optional: 1=consolidated, 4=parent company)

Returns: Income statement with fields: ts_code, ann_date, f_ann_date, end_date, report_type, total_revenue, revenue, total_cogs, oper_cost, sell_exp, admin_exp, rd_exp, fin_exp, operate_profit, total_profit, income_tax, n_income, n_income_attr_p, basic_eps, diluted_eps`,
    apiName: 'income',
    fields: [
      'ts_code',
      'ann_date',
      'f_ann_date',
      'end_date',
      'report_type',
      'total_revenue',
      'revenue',
      'total_cogs',
      'oper_cost',
      'sell_exp',
      'admin_exp',
      'rd_exp',
      'fin_exp',
      'operate_profit',
      'total_profit',
      'income_tax',
      'n_income',
      'n_income_attr_p',
      'basic_eps',
      'diluted_eps',
    ],
    cacheStrategy: CacheStrategy.FINANCIAL,
    validate: (input: any) => {
      validateStockCode(input.ts_code);
      if (input.period) {
        validateDate(input.period);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
    },
  },

  {
    name: 'get_cn_balance',
    description: `Fetches balance sheet data for Chinese A-share companies.

When to Use:
- Analyze assets, liabilities, and equity structure
- Calculate financial leverage and solvency ratios
- Assess working capital and liquidity position
- Track changes in asset composition over time

When NOT to Use:
- For income/profit data (use get_cn_income instead)
- For cash flow data (use get_cn_cashflow instead)
- For pre-calculated ratios (use get_cn_indicators instead)

Example:
- ts_code: "000001.SZ"
- period: "20231231"
- report_type: "1" (optional: 1=consolidated, 4=parent company)

Returns: Balance sheet with fields: ts_code, ann_date, end_date, report_type, total_assets, total_liab, total_hldr_eqy_exc_min_int, total_cur_assets, total_nca, total_cur_liab, total_ncl, and more`,
    apiName: 'balancesheet',
    fields: [
      'ts_code',
      'ann_date',
      'f_ann_date',
      'end_date',
      'report_type',
      'total_assets',
      'total_liab',
      'total_hldr_eqy_exc_min_int',
      'total_cur_assets',
      'total_nca',
      'total_cur_liab',
      'total_ncl',
      'money_cap',
      'trad_asset',
      'notes_receiv',
      'accounts_receiv',
      'oth_receiv',
      'prepayment',
      'inventories',
      'fix_assets',
      'intan_assets',
      'goodwill',
      'lt_borr',
      'bond_payable',
    ],
    cacheStrategy: CacheStrategy.FINANCIAL,
    validate: (input: any) => {
      validateStockCode(input.ts_code);
      if (input.period) {
        validateDate(input.period);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
    },
  },

  {
    name: 'get_cn_cashflow',
    description: `Fetches cash flow statement data for Chinese A-share companies.

When to Use:
- Analyze operating, investing, and financing cash flows
- Calculate free cash flow
- Assess cash generation ability
- Evaluate capital allocation decisions

When NOT to Use:
- For income statement data (use get_cn_income instead)
- For balance sheet data (use get_cn_balance instead)
- For pre-calculated ratios (use get_cn_indicators instead)

Example:
- ts_code: "600519.SH"
- period: "20231231"
- report_type: "1" (optional: 1=consolidated, 4=parent company)

Returns: Cash flow statement with fields: ts_code, ann_date, end_date, report_type, n_cashflow_act, n_cashflow_inv_act, n_cash_flows_fnc_act, free_cashflow, and more`,
    apiName: 'cashflow',
    fields: [
      'ts_code',
      'ann_date',
      'f_ann_date',
      'end_date',
      'report_type',
      'n_cashflow_act',
      'n_cashflow_inv_act',
      'n_cash_flows_fnc_act',
      'c_fr_sale_sg',
      'c_paid_goods_s',
      'c_paid_to_for_empl',
      'c_paid_for_taxes',
      'n_incr_cash_cash_equ',
      'c_cash_equ_beg_period',
      'c_cash_equ_end_period',
      'free_cashflow',
    ],
    cacheStrategy: CacheStrategy.FINANCIAL,
    validate: (input: any) => {
      validateStockCode(input.ts_code);
      if (input.period) {
        validateDate(input.period);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
    },
  },

  {
    name: 'get_cn_indicators',
    description: `Fetches comprehensive financial indicators and ratios for Chinese A-share companies.

When to Use:
- Get pre-calculated financial ratios (ROE, ROA, profit margins)
- Analyze profitability, efficiency, and leverage metrics
- Compare financial health across companies
- Track ratio trends over time

When NOT to Use:
- For raw financial statement data (use get_cn_income, get_cn_balance, get_cn_cashflow)
- For market valuation ratios (use get_cn_stock_basic instead)

Example:
- ts_code: "600519.SH"
- period: "20231231"

Returns: Financial indicators with fields: ts_code, ann_date, end_date, eps, bps, roe, roe_dt, roa, grossprofit_margin, netprofit_margin, debt_to_assets, current_ratio, quick_ratio, and more`,
    apiName: 'fina_indicator',
    fields: [
      'ts_code',
      'ann_date',
      'end_date',
      'eps',
      'bps',
      'roe',
      'roe_dt',
      'roa',
      'grossprofit_margin',
      'netprofit_margin',
      'debt_to_assets',
      'current_ratio',
      'quick_ratio',
      'ocf_to_or',
      'ocf_to_opincome',
      'inc_revenue_yoy',
      'inc_net_profit_yoy',
      'inc_total_assets_yoy',
    ],
    cacheStrategy: CacheStrategy.FINANCIAL,
    validate: (input: any) => {
      validateStockCode(input.ts_code);
      if (input.period) {
        validateDate(input.period);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
    },
  },

  // ============================================================================
  // Market Data Tools
  // ============================================================================

  {
    name: 'get_cn_northbound_flow',
    description: `Fetches northbound capital flow data through Hong Kong Stock Connect.

When to Use:
- Track foreign capital inflows/outflows to Chinese A-shares
- Analyze market sentiment from international investors
- Monitor Shanghai and Shenzhen Stock Connect activity
- Identify capital flow trends

When NOT to Use:
- For individual stock flows (this is aggregate market data)
- For southbound flows (HK to mainland, not available)
- For historical data older than Stock Connect launch (2014)

Example:
- trade_date: "20240115" (optional, omit for date range)
- start_date: "20240101"
- end_date: "20240131"

Returns: Northbound flow data with fields: trade_date, ggt_ss (Shanghai inflow), ggt_sz (Shenzhen inflow), hgt, sgt, north_money (total northbound), south_money`,
    apiName: 'moneyflow_hsgt',
    fields: [
      'trade_date',
      'ggt_ss',
      'ggt_sz',
      'hgt',
      'sgt',
      'north_money',
      'south_money',
    ],
    cacheStrategy: CacheStrategy.HISTORICAL,
    validate: (input: any) => {
      if (input.trade_date) {
        validateDate(input.trade_date);
      }
      if (input.start_date && input.end_date) {
        validateDateRange(input.start_date, input.end_date);
      }
    },
    parameterNames: {
      startDate: 'start_date',
      endDate: 'end_date',
    },
  },

  {
    name: 'get_cn_margin_data',
    description: `Fetches margin trading and short selling data for Chinese A-share stocks.

When to Use:
- Analyze margin trading activity and leverage
- Track short interest and short selling trends
- Monitor margin debt levels
- Assess market sentiment through margin activity

When NOT to Use:
- For stocks without margin trading approval
- For aggregate market margin data (this is per-stock)

Example:
- ts_code: "600519.SH"
- trade_date: "20240115" (optional)
- start_date: "20240101"
- end_date: "20240131"

Returns: Margin data with fields: trade_date, ts_code, rzye (margin balance), rqye (short balance), rzmre (margin buy), rqmcl (short sell volume), rzche (margin repayment), rqchl (short covering)`,
    apiName: 'margin',
    fields: [
      'trade_date',
      'ts_code',
      'rzye',
      'rqye',
      'rzmre',
      'rqmcl',
      'rzche',
      'rqchl',
    ],
    cacheStrategy: CacheStrategy.HISTORICAL,
    validate: (input: any) => {
      if (input.ts_code) {
        validateStockCode(input.ts_code);
      }
      if (input.trade_date) {
        validateDate(input.trade_date);
      }
      if (input.start_date && input.end_date) {
        validateDateRange(input.start_date, input.end_date);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
      startDate: 'start_date',
      endDate: 'end_date',
    },
  },

  {
    name: 'get_cn_block_trades',
    description: `Fetches block trade (large transaction) data for Chinese A-share stocks.

When to Use:
- Identify large institutional transactions
- Track significant ownership changes
- Analyze block trade pricing vs market price
- Monitor institutional trading activity

When NOT to Use:
- For regular trading volume (use get_cn_stock_price instead)
- For small transactions (block trades are typically large)

Example:
- ts_code: "600519.SH" (optional)
- trade_date: "20240115" (optional)
- start_date: "20240101"
- end_date: "20240131"

Returns: Block trade data with fields: ts_code, trade_date, price, vol, amount, buyer, seller`,
    apiName: 'block_trade',
    fields: [
      'ts_code',
      'trade_date',
      'price',
      'vol',
      'amount',
      'buyer',
      'seller',
    ],
    cacheStrategy: CacheStrategy.HISTORICAL,
    validate: (input: any) => {
      if (input.ts_code) {
        validateStockCode(input.ts_code);
      }
      if (input.trade_date) {
        validateDate(input.trade_date);
      }
      if (input.start_date && input.end_date) {
        validateDateRange(input.start_date, input.end_date);
      }
    },
    parameterNames: {
      stockCode: 'ts_code',
      startDate: 'start_date',
      endDate: 'end_date',
    },
  },

  {
    name: 'get_cn_limit_list',
    description: `Fetches daily limit up/down list for Chinese A-share stocks.

When to Use:
- Identify stocks hitting daily price limits (±10% or ±20%)
- Track market momentum and extreme moves
- Analyze limit-up/limit-down patterns
- Monitor consecutive limit days

When NOT to Use:
- For normal price movements (use get_cn_stock_price instead)
- For stocks that didn't hit limits on the date

Example:
- trade_date: "20240115"
- limit_type: "U" (optional: U=limit up, D=limit down)

Returns: Limit list with fields: trade_date, ts_code, name, close, pct_chg, amount, limit_type (U/D), times (consecutive limit days)`,
    apiName: 'limit_list',
    fields: [
      'trade_date',
      'ts_code',
      'name',
      'close',
      'pct_chg',
      'amount',
      'limit_type',
      'times',
    ],
    cacheStrategy: CacheStrategy.HISTORICAL,
    validate: (input: any) => {
      validateDate(input.trade_date);
    },
  },

  // ============================================================================
  // Weekly / Monthly Adjusted Price Tools
  // ============================================================================

  {
    name: 'get_cn_stock_week_month_adj',
    description: `Fetches weekly or monthly OHLCV price data (with forward/backward adjusted prices) for a Chinese A-share stock.

When to Use:
- Analyze medium-to-long term price trends using weekly or monthly bars
- Compare adjusted (复权) vs unadjusted prices over time
- Calculate weekly/monthly returns and volatility
- Build swing-trading or position-trading indicators

When NOT to Use:
- For daily price data (use get_cn_stock_price or get_cn_stock_prices instead)
- For intraday data (not available in Tushare)
- For valuation metrics like PE/PB (use get_cn_stock_basic instead)

Example:
- ts_code: "000001.SZ" (Ping An Bank)
- freq: "week" (required: "week" for weekly, "month" for monthly)
- start_date: "20240101"
- end_date: "20241231"

Returns: Array of price records with fields: ts_code, trade_date, freq, open, high, low, close, pre_close, open_qfq, high_qfq, low_qfq, close_qfq, open_hfq, high_hfq, low_hfq, close_hfq, vol, amount, change, pct_chg`,
    apiName: 'stk_week_month_adj',
    fields: [
      'ts_code',
      'trade_date',
      'freq',
      'open',
      'high',
      'low',
      'close',
      'pre_close',
      'open_qfq',
      'high_qfq',
      'low_qfq',
      'close_qfq',
      'open_hfq',
      'high_hfq',
      'low_hfq',
      'close_hfq',
      'vol',
      'amount',
      'change',
      'pct_chg',
    ],
    cacheStrategy: CacheStrategy.HISTORICAL,
    validate: (input: any) => {
      if (input.ts_code) validateStockCode(input.ts_code);
      if (input.trade_date) validateDate(input.trade_date);
      if (input.start_date && input.end_date) validateDateRange(input.start_date, input.end_date);
    },
    parameterNames: {
      stockCode: 'ts_code',
      startDate: 'start_date',
      endDate: 'end_date',
    },
  },

  // ============================================================================
  // Reference Data Tools
  // ============================================================================

  {
    name: 'get_cn_stock_list',
    description: `Fetches the complete list of Chinese A-share stocks with basic information.

When to Use:
- Search for stock codes by company name
- Get list of all tradable A-share stocks
- Filter stocks by exchange (SSE, SZSE, BSE) or status
- Resolve ambiguous company names to stock codes

When NOT to Use:
- For detailed company information (use other tools with ts_code)
- For real-time trading status (this is reference data)
- For Hong Kong stocks (use get_hk_stock_list instead, if available)

Example:
- list_status: "L" (optional: L=listed, D=delisted, P=paused)
- exchange: "SSE" (optional: SSE=Shanghai, SZSE=Shenzhen, BSE=Beijing)

Returns: Stock list with fields: ts_code, symbol, name, area, industry, market, list_date, and more`,
    apiName: 'stock_basic',
    fields: [
      'ts_code',
      'symbol',
      'name',
      'area',
      'industry',
      'market',
      'list_date',
      'exchange',
      'curr_type',
      'list_status',
    ],
    cacheStrategy: CacheStrategy.REFERENCE,
  },

  {
    name: 'get_cn_trade_calendar',
    description: `Fetches the trading calendar for Chinese stock exchanges.

When to Use:
- Check if a specific date is a trading day
- Get list of trading days in a date range
- Plan data collection around market holidays
- Calculate trading day differences

When NOT to Use:
- For intraday trading hours (this only shows trading days)
- For Hong Kong market calendar (this is mainland China only)

Example:
- exchange: "SSE" (optional: SSE, SZSE, BSE)
- start_date: "20240101"
- end_date: "20241231"

Returns: Calendar with fields: exchange, cal_date, is_open (1=trading day, 0=holiday), pretrade_date`,
    apiName: 'trade_cal',
    fields: [
      'exchange',
      'cal_date',
      'is_open',
      'pretrade_date',
    ],
    cacheStrategy: CacheStrategy.REFERENCE,
    validate: (input: any) => {
      if (input.start_date && input.end_date) {
        validateDateRange(input.start_date, input.end_date);
      }
    },
    parameterNames: {
      startDate: 'start_date',
      endDate: 'end_date',
    },
  },
];


// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validate all tool configurations at module load time
 * Ensures configs follow naming conventions and include required sections
 */
function validateConfigurations(): void {
  const errors: string[] = [];

  for (const config of TOOL_CONFIGS) {
    // Validate naming convention: {action}_{market}_{data_type}
    if (!config.name.match(/^(get|list|search)_(cn|hk)_[a-z_]+$/)) {
      errors.push(
        `Tool "${config.name}" does not follow naming convention: {action}_{market}_{data_type}`
      );
    }

    // Validate description includes required sections
    if (!config.description.includes('When to Use')) {
      errors.push(`Tool "${config.name}" description missing "When to Use" section`);
    }

    if (!config.description.includes('When NOT to Use')) {
      errors.push(`Tool "${config.name}" description missing "When NOT to Use" section`);
    }

    // Validate description includes examples
    if (!config.description.includes('Example:')) {
      errors.push(`Tool "${config.name}" description missing input examples`);
    }

    // Validate parameter naming for stock codes
    if (config.description.toLowerCase().includes('ts_code') && config.parameterNames?.stockCode) {
      if (config.parameterNames.stockCode !== 'ts_code') {
        errors.push(
          `Tool "${config.name}" stock code parameter must be named "ts_code", got "${config.parameterNames.stockCode}"`
        );
      }
    }

    // Validate parameter naming for date ranges
    if (config.description.toLowerCase().includes('start_date') && config.parameterNames?.startDate) {
      if (config.parameterNames.startDate !== 'start_date') {
        errors.push(
          `Tool "${config.name}" start date parameter must be named "start_date", got "${config.parameterNames.startDate}"`
        );
      }
    }

    if (config.description.toLowerCase().includes('end_date') && config.parameterNames?.endDate) {
      if (config.parameterNames.endDate !== 'end_date') {
        errors.push(
          `Tool "${config.name}" end date parameter must be named "end_date", got "${config.parameterNames.endDate}"`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Tool configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}

// Run validation at module load time
validateConfigurations();
