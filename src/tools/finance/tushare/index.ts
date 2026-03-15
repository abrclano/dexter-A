/**
 * Public API for the Tushare module.
 *
 * Exports individual tools, the router, core utilities, and types.
 * Internal implementation details (core/, config/) are intentionally hidden.
 */

// ── Individual tools ──────────────────────────────────────────────────────────

// Price tools
export { getCnStockPrice, getCnStockPrices } from './tools/price/daily.js';
export { getCnStockBasic } from './tools/price/basic.js';

// Fundamental tools
export { getCnIncome, getCnBalance, getCnCashflow, getCnIndicators, getCnForecast, getCnExpress } from './tools/fundamentals/index.js';

// Market data tools
export {
  getCnNorthboundFlow,
  getCnMarginData,
  getCnBlockTrades,
  getCnLimitList,
} from './tools/market/index.js';

// Reference data tools
export { getCnStockList, getCnTradeCalendar } from './tools/reference/index.js';

// ── Router ────────────────────────────────────────────────────────────────────

export { createCnMarketSearch, CN_MARKET_SEARCH_DESCRIPTION } from './tools/router.js';

// ── Validators ────────────────────────────────────────────────────────────────

export {
  validateStockCode,
  validateDate,
  validateDateRange,
  StockCodeValidator,
  DateValidator,
  DateRangeValidator,
} from './utils/validation.js';

// ── Formatters ────────────────────────────────────────────────────────────────

export {
  formatToolResult,
  sortTimeSeriesData,
  handleNullValues,
  normaliseRows,
} from './utils/formatting.js';

export type { ToolResult } from './utils/formatting.js';

// ── Date utilities ────────────────────────────────────────────────────────────

export {
  getTodayBeijing,
  getTodayBeijingFormatted,
  parseDate,
  formatDate,
  isHistoricalDate,
} from './utils/date.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  TsCode,
  DateYYYYMMDD,
  DateRange,
  PaginationParams,
  ReportType,
  FinancialReport,
} from './types/common.js';

export { isTsCode, isDateYYYYMMDD } from './types/common.js';

export type {
  TushareRequest,
  TushareResponse,
  RequestOptions,
  ResponseMetadata,
  TushareRawResponse,
} from './types/api.js';

export { CacheStrategy } from './types/api.js';

export type { CacheEntry, CacheStats, CacheManager } from './types/cache.js';

export type { TushareApiError, ErrorContext } from './types/error.js';
export { TushareError, ErrorType } from './types/error.js';

export type { ToolConfig, FieldDefinition } from './types/tool-config.js';
