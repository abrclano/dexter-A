/**
 * API request/response types for Tushare module
 */

import type { DateYYYYMMDD, TsCode } from './common.js';

// ============================================================================
// Cache Strategy
// ============================================================================

/**
 * Cache strategy for different data types
 */
export enum CacheStrategy {
  /** Indefinite TTL for historical data (dates before today) */
  HISTORICAL = 'historical',
  /** 5 minutes TTL for current day data */
  CURRENT_DAY = 'current_day',
  /** 24 hours TTL for financial statements */
  FINANCIAL = 'financial',
  /** 7 days TTL for reference data */
  REFERENCE = 'reference',
  /** No caching */
  NO_CACHE = 'no_cache',
}

// ============================================================================
// Request/Response Interfaces
// ============================================================================

/**
 * Tushare API request structure
 */
export interface TushareRequest {
  /** Tushare API endpoint name (e.g., 'daily', 'income', 'balancesheet') */
  apiName: string;
  /** Request parameters (stock code, dates, etc.) */
  params: Record<string, string | number | undefined>;
  /** Optional field list to return (if not specified, returns all fields) */
  fields?: string[];
  /** Request options */
  options?: RequestOptions;
}

/**
 * Request options for API calls
 */
export interface RequestOptions {
  /** Whether this request is cacheable */
  cacheable?: boolean;
  /** Cache strategy to use */
  cacheStrategy?: CacheStrategy;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retries */
  retries?: number;
}

/**
 * Tushare API response structure
 */
export interface TushareResponse<T> {
  /** Response data */
  data: T;
  /** Source URLs for documentation */
  sourceUrls: string[];
  /** Optional metadata */
  metadata?: ResponseMetadata;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Whether response was served from cache */
  cached?: boolean;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Whether data was truncated */
  truncated?: boolean;
  /** Total count before truncation */
  totalCount?: number;
}

/**
 * Raw Tushare API response format (tabular)
 */
export interface TushareRawResponse {
  /** Request ID */
  request_id: string;
  /** Response code (0 = success) */
  code: number;
  /** Response message */
  msg: string | null;
  /** Response data in tabular format */
  data: {
    /** Field names */
    fields: string[];
    /** Data rows */
    items: Array<Array<string | number | null>>;
  } | null;
}
