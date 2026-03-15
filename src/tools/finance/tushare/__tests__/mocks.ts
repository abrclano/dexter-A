/**
 * Mock utilities for Tushare module tests.
 *
 * Provides:
 * - mockTushareApi()  — intercepts fetch() to return fixture data
 * - Mock builders for CacheManager, MetricsTracker, and ErrorHandler
 * - Response builder helpers for constructing raw Tushare payloads
 */

import type { TushareRawResponse } from '../types/api.js';
import type { CacheManager as ICacheManager, CacheStats } from '../types/cache.js';
import type { MetricsTracker, Metrics } from '../core/metrics.js';

// ── Raw response builder ──────────────────────────────────────────────────────

/**
 * Build a successful TushareRawResponse from field names and row data.
 */
export function buildRawResponse(
  fields: string[],
  items: Array<Array<string | number | null>>
): TushareRawResponse {
  return {
    request_id: 'mock-request-id',
    code: 0,
    msg: null,
    data: { fields, items },
  };
}

/**
 * Build a failed TushareRawResponse with an error code and message.
 */
export function buildErrorResponse(code: number, msg: string): TushareRawResponse {
  return {
    request_id: 'mock-request-id',
    code,
    msg,
    data: null,
  };
}

/**
 * Build an empty-data TushareRawResponse (valid response, no rows).
 */
export function buildEmptyResponse(fields: string[]): TushareRawResponse {
  return buildRawResponse(fields, []);
}

// ── fetch() interceptor ───────────────────────────────────────────────────────

type ApiHandler = (
  apiName: string,
  params: Record<string, unknown>
) => TushareRawResponse | Promise<TushareRawResponse>;

/**
 * Replace the global fetch() with a mock that routes Tushare API calls to
 * the provided handler.  Returns a restore function — call it in afterEach.
 *
 * Usage:
 * ```ts
 * const restore = mockTushareApi((apiName) => {
 *   if (apiName === 'daily') return dailyFixture;
 *   return buildEmptyResponse([]);
 * });
 * afterEach(restore);
 * ```
 */
export function mockTushareApi(handler: ApiHandler): () => void {
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Only intercept calls to the Tushare endpoint
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('tushare.pro')) {
      return originalFetch(input, init);
    }

    const body = JSON.parse((init?.body as string) ?? '{}') as {
      api_name?: string;
      params?: Record<string, unknown>;
    };

    const apiName = body.api_name ?? '';
    const params = body.params ?? {};

    const rawResponse = await handler(apiName, params);

    return new Response(JSON.stringify(rawResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Create a fetch mock that always throws a network error.
 * Useful for testing retry logic.
 */
export function mockNetworkError(message = 'Network error'): () => void {
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('tushare.pro')) return originalFetch(input);
    throw new Error(message);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Create a fetch mock that returns an HTTP error status.
 */
export function mockHttpError(status: number, statusText = 'Error'): () => void {
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('tushare.pro')) return originalFetch(input);
    return new Response(null, { status, statusText });
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

// ── Mock CacheManager ─────────────────────────────────────────────────────────

/**
 * In-memory mock CacheManager that records all interactions.
 * Useful for verifying cache hit/miss behaviour without real TTL logic.
 */
export class MockCacheManager implements ICacheManager {
  private store = new Map<string, unknown>();
  public getCalls: string[] = [];
  public setCalls: Array<{ key: string; ttl: number }> = [];
  public invalidateCalls: string[] = [];

  get<T>(key: string): T | null {
    this.getCalls.push(key);
    return (this.store.get(key) as T) ?? null;
  }

  set<T>(key: string, value: T, ttl: number): void {
    this.setCalls.push({ key, ttl });
    if (ttl !== 0) this.store.set(key, value);
  }

  invalidate(pattern: string): void {
    this.invalidateCalls.push(pattern);
    const regex = new RegExp(pattern);
    for (const key of this.store.keys()) {
      if (regex.test(key)) this.store.delete(key);
    }
  }

  getStats(): CacheStats {
    return { hits: 0, misses: 0, hitRate: 0, size: 0, evictions: 0, entryCount: this.store.size };
  }

  clear(): void {
    this.store.clear();
    this.getCalls = [];
    this.setCalls = [];
    this.invalidateCalls = [];
  }

  /** Seed the cache with a pre-existing value (bypasses TTL). */
  seed<T>(key: string, value: T): void {
    this.store.set(key, value);
  }
}

// ── Mock MetricsTracker ───────────────────────────────────────────────────────

/**
 * No-op MetricsTracker that records calls for assertion in tests.
 */
export class MockMetricsTracker implements MetricsTracker {
  public apiCalls: Array<{ apiName: string; duration: number; cached: boolean }> = [];
  public errors: Array<{ apiName: string; errorType: string }> = [];
  public evictions: number[] = [];

  recordApiCall(apiName: string, duration: number, cached: boolean): void {
    this.apiCalls.push({ apiName, duration, cached });
  }

  recordError(apiName: string, errorType: string): void {
    this.errors.push({ apiName, errorType });
  }

  recordCacheEviction(count: number): void {
    this.evictions.push(count);
  }

  getMetrics(): Metrics {
    return {
      apiCalls: { total: this.apiCalls.length, byApi: {} },
      cache: { hits: 0, misses: 0, hitRate: 0, evictions: 0 },
      performance: { p50: 0, p95: 0, p99: 0, byApi: {} },
      errors: { total: this.errors.length, byType: {}, byApi: {} },
    };
  }

  resetMetrics(): void {
    this.apiCalls = [];
    this.errors = [];
    this.evictions = [];
  }
}
