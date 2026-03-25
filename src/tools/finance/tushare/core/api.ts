/**
 * Unified API Client for Tushare
 *
 * Provides a single, robust interface for all Tushare API interactions with:
 * - Retry logic with exponential backoff
 * - Rate limit handling
 * - Concurrent request control via global semaphore
 * - Response transformation from tabular to object format
 * - Caching integration
 * - Metrics tracking
 */

import type {
  TushareRequest,
  TushareResponse,
  TushareRawResponse,
  RequestOptions,
} from '../types/api.js';
import type { CacheManager } from '../types/cache.js';
import type { MetricsTracker } from './metrics.js';
import { CacheStrategy } from '../types/api.js';
import { ErrorHandler, TushareError, type ErrorContext } from './error.js';
import { determineTTL } from './cache.js';
import { validateApiResponseArray } from '../utils/response-validation.js';
import { splitByYear, spansMultipleYears } from '../utils/date.js';
import type { DateYYYYMMDD } from '../types/common.js';

// ============================================================================
// Semaphore for Concurrency Control
// ============================================================================

/**
 * Simple semaphore implementation for limiting concurrent operations
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquire a permit (wait if none available)
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }
}

/**
 * GLOBAL SINGLETON SEMAPHORE
 *
 * CRITICAL: This must be a global singleton shared across all API client instances.
 * When the router calls 10 tools in parallel, and each tool makes API requests,
 * this ensures the total concurrent requests to Tushare never exceeds 5.
 *
 * Without a global singleton, each tool instance would create its own semaphore,
 * defeating the purpose of rate limiting.
 */
export const GLOBAL_TUSHARE_SEMAPHORE = new Semaphore(5);

// ============================================================================
// API Client Interface
// ============================================================================

/**
 * Tushare API client interface
 */
export interface TushareApiClient {
  /**
   * Make a single API call
   */
  call<T>(request: TushareRequest): Promise<TushareResponse<T>>;

  /**
   * Make multiple API calls in parallel (respecting semaphore limit)
   */
  callBatch<T>(requests: TushareRequest[]): Promise<TushareResponse<T>[]>;

  /**
   * Fetch a multi-year date range in parallel by splitting into per-year requests.
   * Falls back to a single call when the range fits within one calendar year.
   * Results are merged and sorted by date descending (Requirement 8.8).
   */
  callMultiYear<T extends Record<string, unknown>>(
    request: TushareRequest,
    startDate: DateYYYYMMDD,
    endDate: DateYYYYMMDD
  ): Promise<TushareResponse<T[]>>;
}

// ============================================================================
// API Client Implementation
// ============================================================================

/**
 * Default request options
 */
const DEFAULT_OPTIONS: Required<RequestOptions> = {
  cacheable: true,
  cacheStrategy: CacheStrategy.CURRENT_DAY,
  timeout: 30000,
  retries: 3,
};

/**
 * Tushare API client implementation
 */
export class TushareApiClientImpl implements TushareApiClient {
  private readonly baseUrl = 'https://api.tushare.pro';
  private readonly token: string;
  private readonly cache: CacheManager;
  private readonly errorHandler: ErrorHandler;
  private readonly metrics: MetricsTracker;
  private readonly semaphore: Semaphore = GLOBAL_TUSHARE_SEMAPHORE;

  constructor(
    token: string,
    cache: CacheManager,
    errorHandler: ErrorHandler,
    metrics: MetricsTracker
  ) {
    this.token = token;
    this.cache = cache;
    this.errorHandler = errorHandler;
    this.metrics = metrics;
  }

  /**
   * Make a single API call with caching, retry logic, and metrics tracking
   */
  async call<T>(request: TushareRequest): Promise<TushareResponse<T>> {
    const options = { ...DEFAULT_OPTIONS, ...request.options };
    const startTime = Date.now();

    // Check if token is set before attempting API call
    if (!this.token) {
      throw new TushareError(
        'TUSHARE_API_KEY environment variable is not set',
        'MISSING_TOKEN',
        'Set the TUSHARE_API_KEY environment variable with your API token from https://tushare.pro'
      );
    }

    // 1. Check cache
    if (options.cacheable) {
      const cacheKey = this.generateCacheKey(request);
      const cached = this.cache.get<T>(cacheKey);

      if (cached !== null) {
        const duration = Date.now() - startTime;
        this.metrics.recordApiCall(request.apiName, duration, true);

        return {
          data: cached,
          sourceUrls: ['https://tushare.pro/document/2'],
          metadata: {
            cached: true,
            responseTime: duration,
          },
        };
      }
    }

    // 2. Make API call with retry logic
    let lastError: any;
    for (let attempt = 0; attempt < options.retries; attempt++) {
      try {
        // Acquire semaphore slot
        await this.semaphore.acquire();

        try {
          // Make HTTP request
          const data = await this.makeRequest<T>(request, options.timeout);

          // Release semaphore
          this.semaphore.release();

          // 3. Update cache
          if (options.cacheable) {
            const cacheKey = this.generateCacheKey(request);
            const ttl = determineTTL(options.cacheStrategy, request.params);
            this.cache.set(cacheKey, data, ttl);
          }

          // 4. Track metrics
          const duration = Date.now() - startTime;
          this.metrics.recordApiCall(request.apiName, duration, false);

          return {
            data,
            sourceUrls: ['https://tushare.pro/document/2'],
            metadata: {
              cached: false,
              responseTime: duration,
            },
          };
        } catch (error) {
          // Release semaphore on error
          this.semaphore.release();
          throw error;
        }
      } catch (error: any) {
        lastError = error;

        const context: ErrorContext = {
          apiName: request.apiName,
          params: request.params,
          attempt: attempt + 1,
        };

        // Check if we should retry
        if (!this.errorHandler.shouldRetry(error, attempt + 1)) {
          // Track error
          const errorType = this.errorHandler.classifyError(error);
          this.metrics.recordError(request.apiName, errorType);

          // Throw formatted error
          this.errorHandler.handleApiError(error, context);
        }

        // Wait before retry
        const delay = this.errorHandler.getRetryDelay(attempt, error);
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    const context: ErrorContext = {
      apiName: request.apiName,
      params: request.params,
      attempt: options.retries,
    };

    const errorType = this.errorHandler.classifyError(lastError);
    this.metrics.recordError(request.apiName, errorType);
    this.errorHandler.handleApiError(lastError, context);
  }

  /**
   * Make multiple API calls in parallel (respecting semaphore limit)
   */
  async callBatch<T>(requests: TushareRequest[]): Promise<TushareResponse<T>[]> {
    // Execute all requests in parallel
    // The semaphore will automatically limit concurrency to 5
    const promises = requests.map((request) => this.call<T>(request));
    return Promise.all(promises);
  }

  /**
   * Fetch a multi-year date range in parallel by splitting into per-year requests.
   *
   * When start_date and end_date span more than one calendar year, the range is
   * split into per-year sub-requests that are executed in parallel (subject to the
   * global semaphore). Results are merged and sorted by the first date-like field
   * found in each row, descending (most recent first).
   *
   * Falls back to a single call when the range fits within one calendar year.
   * Requirement 8.8.
   */
  async callMultiYear<T extends Record<string, unknown>>(
    request: TushareRequest,
    startDate: DateYYYYMMDD,
    endDate: DateYYYYMMDD
  ): Promise<TushareResponse<T[]>> {
    // Single-year fast path — no splitting needed
    if (!spansMultipleYears(startDate, endDate)) {
      return this.call<T[]>({
        ...request,
        params: { ...request.params, start_date: startDate, end_date: endDate },
      });
    }

    const yearRanges = splitByYear(startDate, endDate);

    // Build one request per year
    const yearRequests: TushareRequest[] = yearRanges.map(({ start, end }) => ({
      ...request,
      params: { ...request.params, start_date: start, end_date: end },
    }));

    // Execute all year-requests in parallel; semaphore limits concurrency globally
    const responses = await this.callBatch<T[]>(yearRequests);

    // Merge all rows from all year responses
    const allRows: T[] = [];
    for (const resp of responses) {
      if (Array.isArray(resp.data)) {
        allRows.push(...resp.data);
      }
    }

    // Sort merged rows by date descending (most recent first)
    const DATE_FIELDS = ['trade_date', 'end_date', 'ann_date', 'cal_date', 'f_ann_date'];
    allRows.sort((a, b) => {
      for (const field of DATE_FIELDS) {
        const av = a[field] as string | undefined;
        const bv = b[field] as string | undefined;
        if (av && bv) return bv.localeCompare(av);
      }
      return 0;
    });

    // Combine metadata from all responses
    const totalResponseTime = responses.reduce(
      (sum, r) => sum + (r.metadata?.responseTime ?? 0),
      0
    );
    const anyCached = responses.every((r) => r.metadata?.cached === true);

    return {
      data: allRows,
      sourceUrls: responses[0]?.sourceUrls ?? ['https://tushare.pro/document/2'],
      metadata: {
        cached: anyCached,
        responseTime: totalResponseTime,
      },
    };
  }

  /**
   * Make HTTP request to Tushare API
   */
  private async makeRequest<T>(request: TushareRequest, timeout: number): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_name: request.apiName,
          token: this.token,
          params: request.params,
          fields: request.fields?.join(','),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check HTTP status
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse JSON response
      let rawResponse: TushareRawResponse;
      try {
        rawResponse = await response.json();
      } catch (error) {
        throw new TushareError(
          `Invalid JSON response from ${request.apiName}`,
          'INVALID_JSON',
          'The API response format may have changed'
        );
      }

      // Check Tushare API error code
      if (rawResponse.code !== 0) {
        throw new TushareError(
          rawResponse.msg || 'Unknown API error',
          `API_ERROR_${rawResponse.code}`,
          undefined,
          { code: rawResponse.code }
        );
      }

      // Transform response
      return this.transformResponse<T>(rawResponse, request.apiName);
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        throw new TushareError(
          `Request timeout after ${timeout}ms`,
          'TIMEOUT',
          'Check your internet connection or increase timeout',
          { timeout, apiName: request.apiName }
        );
      }

      throw error;
    }
  }

  /**
   * Transform Tushare tabular response to object array.
   * Preserves all original field names exactly, then validates and coerces
   * each row against the registered schema for the given apiName.
   */
  private transformResponse<T>(raw: TushareRawResponse, apiName: string): T {
    // Handle empty response
    if (!raw.data || !raw.data.fields || !raw.data.items) {
      return [] as T;
    }

    const { fields, items } = raw.data;

    // Handle empty items
    if (items.length === 0) {
      return [] as T;
    }

    // Transform each row to object (preserving original field names)
    const rows: Record<string, unknown>[] = items.map((row) => {
      const obj: Record<string, unknown> = {};
      fields.forEach((field, index) => {
        obj[field] = row[index];
      });
      return obj;
    });

    // Validate schema and coerce numeric fields (Requirements 13.5, 13.6, 13.7)
    const validated = validateApiResponseArray(apiName, rows);

    return validated as T;
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(request: TushareRequest): string {
    const paramsStr = JSON.stringify(request.params, Object.keys(request.params).sort());
    const fieldsStr = request.fields ? request.fields.sort().join(',') : 'all';
    return `tushare:${request.apiName}:${paramsStr}:${fieldsStr}`;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
