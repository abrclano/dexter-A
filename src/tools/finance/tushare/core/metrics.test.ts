import { describe, test, expect, beforeEach } from 'bun:test';
import { MetricsTrackerImpl } from './metrics';

describe('MetricsTracker', () => {
  let tracker: MetricsTrackerImpl;

  beforeEach(() => {
    tracker = new MetricsTrackerImpl();
  });

  describe('recordApiCall', () => {
    test('tracks API call counts', () => {
      tracker.recordApiCall('daily', 100, false);
      tracker.recordApiCall('daily', 150, false);
      tracker.recordApiCall('income', 200, false);

      const metrics = tracker.getMetrics();
      expect(metrics.apiCalls.total).toBe(3);
      expect(metrics.apiCalls.byApi['daily']).toBe(2);
      expect(metrics.apiCalls.byApi['income']).toBe(1);
    });

    test('tracks cache hits and misses', () => {
      tracker.recordApiCall('daily', 100, false); // miss
      tracker.recordApiCall('daily', 5, true); // hit
      tracker.recordApiCall('daily', 5, true); // hit
      tracker.recordApiCall('income', 200, false); // miss

      const metrics = tracker.getMetrics();
      expect(metrics.cache.hits).toBe(2);
      expect(metrics.cache.misses).toBe(2);
      expect(metrics.cache.hitRate).toBe(0.5);
    });

    test('tracks durations only for non-cached calls', () => {
      tracker.recordApiCall('daily', 100, false);
      tracker.recordApiCall('daily', 5, true); // cached, should not affect durations
      tracker.recordApiCall('daily', 200, false);

      const metrics = tracker.getMetrics();
      expect(metrics.performance.byApi['daily'].count).toBe(2);
    });

    test('detects slow calls (> 5 seconds)', () => {
      tracker.recordApiCall('daily', 3000, false);
      tracker.recordApiCall('daily', 6000, false); // slow
      tracker.recordApiCall('daily', 7500, false); // slow

      const metrics = tracker.getMetrics();
      expect(metrics.performance.byApi['daily'].slowCalls).toBe(2);
    });
  });

  describe('recordError', () => {
    test('tracks errors by type', () => {
      tracker.recordError('daily', 'NETWORK_ERROR');
      tracker.recordError('income', 'NETWORK_ERROR');
      tracker.recordError('daily', 'RATE_LIMIT');

      const metrics = tracker.getMetrics();
      expect(metrics.errors.total).toBe(3);
      expect(metrics.errors.byType['NETWORK_ERROR']).toBe(2);
      expect(metrics.errors.byType['RATE_LIMIT']).toBe(1);
    });

    test('tracks errors by API', () => {
      tracker.recordError('daily', 'NETWORK_ERROR');
      tracker.recordError('daily', 'RATE_LIMIT');
      tracker.recordError('income', 'NETWORK_ERROR');

      const metrics = tracker.getMetrics();
      expect(metrics.errors.byApi['daily']).toBe(2);
      expect(metrics.errors.byApi['income']).toBe(1);
    });
  });

  describe('recordCacheEviction', () => {
    test('tracks cache evictions', () => {
      tracker.recordCacheEviction(5);
      tracker.recordCacheEviction(3);

      const metrics = tracker.getMetrics();
      expect(metrics.cache.evictions).toBe(8);
    });
  });

  describe('percentile calculation', () => {
    test('calculates p50, p95, p99 correctly', () => {
      // Record 100 API calls with varying durations
      for (let i = 1; i <= 100; i++) {
        tracker.recordApiCall('daily', i * 10, false);
      }

      const metrics = tracker.getMetrics();
      
      // p50 should be around 500ms (50th percentile of 10-1000ms)
      expect(metrics.performance.p50).toBeGreaterThanOrEqual(490);
      expect(metrics.performance.p50).toBeLessThanOrEqual(510);

      // p95 should be around 950ms (95th percentile)
      expect(metrics.performance.p95).toBeGreaterThanOrEqual(940);
      expect(metrics.performance.p95).toBeLessThanOrEqual(960);

      // p99 should be around 990ms (99th percentile)
      expect(metrics.performance.p99).toBeGreaterThanOrEqual(980);
      expect(metrics.performance.p99).toBeLessThanOrEqual(1000);
    });

    test('calculates per-API percentiles', () => {
      // Record calls for different APIs
      tracker.recordApiCall('daily', 100, false);
      tracker.recordApiCall('daily', 200, false);
      tracker.recordApiCall('daily', 300, false);
      
      tracker.recordApiCall('income', 500, false);
      tracker.recordApiCall('income', 600, false);

      const metrics = tracker.getMetrics();
      
      expect(metrics.performance.byApi['daily'].count).toBe(3);
      expect(metrics.performance.byApi['daily'].p50).toBe(200);
      
      expect(metrics.performance.byApi['income'].count).toBe(2);
      // For 2 items, p50 index is floor(2 * 0.5) = 1, so it's the second item (600)
      expect(metrics.performance.byApi['income'].p50).toBe(600);
    });

    test('handles empty durations array', () => {
      const metrics = tracker.getMetrics();
      
      expect(metrics.performance.p50).toBe(0);
      expect(metrics.performance.p95).toBe(0);
      expect(metrics.performance.p99).toBe(0);
    });

    test('handles single duration', () => {
      tracker.recordApiCall('daily', 100, false);

      const metrics = tracker.getMetrics();
      
      expect(metrics.performance.p50).toBe(100);
      expect(metrics.performance.p95).toBe(100);
      expect(metrics.performance.p99).toBe(100);
    });
  });

  describe('resetMetrics', () => {
    test('resets all metrics to initial state', () => {
      // Record various metrics
      tracker.recordApiCall('daily', 100, false);
      tracker.recordApiCall('daily', 200, true);
      tracker.recordError('daily', 'NETWORK_ERROR');
      tracker.recordCacheEviction(5);

      // Verify metrics are recorded
      let metrics = tracker.getMetrics();
      expect(metrics.apiCalls.total).toBeGreaterThan(0);
      expect(metrics.cache.hits).toBeGreaterThan(0);
      expect(metrics.errors.total).toBeGreaterThan(0);
      expect(metrics.cache.evictions).toBeGreaterThan(0);

      // Reset
      tracker.resetMetrics();

      // Verify all metrics are cleared
      metrics = tracker.getMetrics();
      expect(metrics.apiCalls.total).toBe(0);
      expect(metrics.cache.hits).toBe(0);
      expect(metrics.cache.misses).toBe(0);
      expect(metrics.cache.hitRate).toBe(0);
      expect(metrics.cache.evictions).toBe(0);
      expect(metrics.errors.total).toBe(0);
      expect(metrics.performance.p50).toBe(0);
      expect(metrics.performance.p95).toBe(0);
      expect(metrics.performance.p99).toBe(0);
    });
  });

  describe('cache hit rate calculation', () => {
    test('calculates hit rate correctly', () => {
      tracker.recordApiCall('daily', 100, false); // miss
      tracker.recordApiCall('daily', 5, true); // hit
      tracker.recordApiCall('daily', 5, true); // hit
      tracker.recordApiCall('daily', 5, true); // hit

      const metrics = tracker.getMetrics();
      expect(metrics.cache.hitRate).toBe(0.75); // 3 hits out of 4 total
    });

    test('handles zero cache accesses', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.cache.hitRate).toBe(0);
    });

    test('handles all cache misses', () => {
      tracker.recordApiCall('daily', 100, false);
      tracker.recordApiCall('income', 200, false);

      const metrics = tracker.getMetrics();
      expect(metrics.cache.hitRate).toBe(0);
    });

    test('handles all cache hits', () => {
      tracker.recordApiCall('daily', 5, true);
      tracker.recordApiCall('income', 5, true);

      const metrics = tracker.getMetrics();
      expect(metrics.cache.hitRate).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    test('tracks comprehensive metrics for realistic usage', () => {
      // Simulate realistic API usage
      tracker.recordApiCall('daily', 150, false);
      tracker.recordApiCall('daily', 5, true);
      tracker.recordApiCall('daily', 5, true);
      tracker.recordApiCall('income', 300, false);
      tracker.recordApiCall('income', 5, true);
      tracker.recordApiCall('balancesheet', 250, false);
      
      tracker.recordError('daily', 'NETWORK_ERROR');
      tracker.recordError('income', 'RATE_LIMIT');
      
      tracker.recordCacheEviction(2);

      const metrics = tracker.getMetrics();

      // Verify API calls
      expect(metrics.apiCalls.total).toBe(6);
      expect(metrics.apiCalls.byApi['daily']).toBe(3);
      expect(metrics.apiCalls.byApi['income']).toBe(2);
      expect(metrics.apiCalls.byApi['balancesheet']).toBe(1);

      // Verify cache stats
      expect(metrics.cache.hits).toBe(3);
      expect(metrics.cache.misses).toBe(3);
      expect(metrics.cache.hitRate).toBe(0.5);
      expect(metrics.cache.evictions).toBe(2);

      // Verify performance stats
      expect(metrics.performance.byApi['daily'].count).toBe(1);
      expect(metrics.performance.byApi['income'].count).toBe(1);
      expect(metrics.performance.byApi['balancesheet'].count).toBe(1);

      // Verify error stats
      expect(metrics.errors.total).toBe(2);
      expect(metrics.errors.byType['NETWORK_ERROR']).toBe(1);
      expect(metrics.errors.byType['RATE_LIMIT']).toBe(1);
      expect(metrics.errors.byApi['daily']).toBe(1);
      expect(metrics.errors.byApi['income']).toBe(1);
    });
  });
});
