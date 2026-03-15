/**
 * Metrics Tracker for Tushare API
 * 
 * Tracks API usage, performance, cache effectiveness, and error rates.
 * Provides observability for monitoring and optimization.
 */

/**
 * Performance statistics for API calls
 */
export interface PerformanceStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  slowCalls: number; // Calls > 5 seconds
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * Comprehensive metrics data
 */
export interface Metrics {
  apiCalls: {
    total: number;
    byApi: Record<string, number>;
  };
  cache: CacheStats;
  performance: {
    p50: number;
    p95: number;
    p99: number;
    byApi: Record<string, PerformanceStats>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byApi: Record<string, number>;
  };
}

/**
 * Metrics tracker interface
 */
export interface MetricsTracker {
  recordApiCall(apiName: string, duration: number, cached: boolean): void;
  recordError(apiName: string, errorType: string): void;
  recordCacheEviction(count: number): void;
  getMetrics(): Metrics;
  resetMetrics(): void;
}

/**
 * Implementation of metrics tracker
 */
export class MetricsTrackerImpl implements MetricsTracker {
  private apiCallCounts: Map<string, number> = new Map();
  private apiDurations: Map<string, number[]> = new Map();
  private allDurations: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;
  private errorCounts: Map<string, number> = new Map();
  private errorsByApi: Map<string, number> = new Map();

  /**
   * Record an API call with its duration and cache status
   */
  recordApiCall(apiName: string, duration: number, cached: boolean): void {
    // Track API call count
    const currentCount = this.apiCallCounts.get(apiName) || 0;
    this.apiCallCounts.set(apiName, currentCount + 1);

    // Track cache hit/miss
    if (cached) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    // Track duration (only for non-cached calls)
    if (!cached) {
      // Add to API-specific durations
      const apiDurations = this.apiDurations.get(apiName) || [];
      apiDurations.push(duration);
      this.apiDurations.set(apiName, apiDurations);

      // Add to all durations for global percentiles
      this.allDurations.push(duration);

      // Log slow calls (> 5 seconds)
      if (duration > 5000) {
        console.warn(
          `[Tushare Metrics] Slow API call detected: ${apiName} took ${duration}ms`
        );
      }
    }
  }

  /**
   * Record an error occurrence
   */
  recordError(apiName: string, errorType: string): void {
    // Track error by type
    const currentTypeCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, currentTypeCount + 1);

    // Track error by API
    const currentApiCount = this.errorsByApi.get(apiName) || 0;
    this.errorsByApi.set(apiName, currentApiCount + 1);
  }

  /**
   * Record cache eviction events
   */
  recordCacheEviction(count: number): void {
    this.cacheEvictions += count;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): Metrics {
    // Calculate total API calls
    const totalApiCalls = Array.from(this.apiCallCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    // Calculate cache hit rate
    const totalCacheAccess = this.cacheHits + this.cacheMisses;
    const hitRate = totalCacheAccess > 0 ? this.cacheHits / totalCacheAccess : 0;

    // Calculate global percentiles
    const globalPercentiles = this.calculatePercentiles(this.allDurations);

    // Calculate per-API performance stats
    const byApi: Record<string, PerformanceStats> = {};
    for (const [apiName, durations] of this.apiDurations.entries()) {
      const percentiles = this.calculatePercentiles(durations);
      const slowCalls = durations.filter((d) => d > 5000).length;

      byApi[apiName] = {
        count: durations.length,
        p50: percentiles.p50,
        p95: percentiles.p95,
        p99: percentiles.p99,
        slowCalls,
      };
    }

    // Calculate total errors
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      apiCalls: {
        total: totalApiCalls,
        byApi: Object.fromEntries(this.apiCallCounts),
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate,
        evictions: this.cacheEvictions,
      },
      performance: {
        p50: globalPercentiles.p50,
        p95: globalPercentiles.p95,
        p99: globalPercentiles.p99,
        byApi,
      },
      errors: {
        total: totalErrors,
        byType: Object.fromEntries(this.errorCounts),
        byApi: Object.fromEntries(this.errorsByApi),
      },
    };
  }

  /**
   * Reset all metrics (useful for testing and monitoring resets)
   */
  resetMetrics(): void {
    this.apiCallCounts.clear();
    this.apiDurations.clear();
    this.allDurations = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.errorCounts.clear();
    this.errorsByApi.clear();
  }

  /**
   * Calculate percentile statistics from duration array
   * Uses simple sorting algorithm for percentile calculation
   */
  private calculatePercentiles(durations: number[]): {
    p50: number;
    p95: number;
    p99: number;
  } {
    if (durations.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    // Sort durations in ascending order
    const sorted = [...durations].sort((a, b) => a - b);

    // Calculate percentile indices
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
    };
  }
}
