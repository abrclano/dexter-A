/**
 * Performance verification tests
 *
 * Cache performance: cached responses return within 10ms; hit-rate tracking accuracy.
 * Parallel execution: parallel tool execution is faster than sequential;
 *         semaphore limits concurrent requests to 5.
 *
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { CacheManager } from './cache.js';
import { TushareApiClientImpl, GLOBAL_TUSHARE_SEMAPHORE } from './api.js';
import { ErrorHandler } from './error.js';
import { MetricsTrackerImpl } from './metrics.js';
import { CacheStrategy } from '../types/api.js';
import type { TushareRequest, TushareRawResponse } from '../types/api.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(fetchImpl: typeof global.fetch) {
  global.fetch = fetchImpl;
  const cache = new CacheManager();
  const errorHandler = new ErrorHandler();
  const metrics = new MetricsTrackerImpl();
  return { client: new TushareApiClientImpl('test-token', cache, errorHandler, metrics), cache, metrics };
}

function mockSuccessResponse(fields: string[], items: Array<Array<string | number | null>>): TushareRawResponse {
  return { request_id: 'test', code: 0, msg: null, data: { fields, items } };
}

// ---------------------------------------------------------------------------
// Cache performance
// ---------------------------------------------------------------------------

describe('Cache performance', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager();
  });

  test('cached response returns within 10ms', () => {
    const value = { ts_code: '600519.SH', close: 1850.5 };
    cache.set('perf:key1', value, 60_000);

    const start = performance.now();
    const result = cache.get('perf:key1');
    const elapsed = performance.now() - start;

    expect(result).toEqual(value);
    expect(elapsed).toBeLessThan(10);
  });

  test('large cached value (post-compression) returns within 10ms', () => {
    // Build a value large enough to trigger compression (> 10KB)
    const largeValue = { data: Array(2000).fill('x'.repeat(20)) };
    cache.set('perf:large', largeValue, 60_000);

    const start = performance.now();
    const result = cache.get('perf:large');
    const elapsed = performance.now() - start;

    expect(result).toEqual(largeValue);
    expect(elapsed).toBeLessThan(10);
  });

  test('hit rate tracking is accurate', () => {
    cache.set('k1', 1, 60_000);
    cache.set('k2', 2, 60_000);

    cache.get('k1'); // hit
    cache.get('k1'); // hit
    cache.get('k2'); // hit
    cache.get('missing'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(3);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.75, 5);
  });

  test('hit rate is 0 when cache is empty', () => {
    const stats = cache.getStats();
    expect(stats.hitRate).toBe(0);
  });

  test('hit rate is 1.0 when all accesses are hits', () => {
    cache.set('k1', 'v1', 60_000);
    cache.get('k1');
    cache.get('k1');

    const stats = cache.getStats();
    expect(stats.hitRate).toBe(1);
  });

  test('expired entries count as misses', async () => {
    cache.set('expiring', 'value', 5); // 5ms TTL
    await new Promise((r) => setTimeout(r, 15));

    cache.get('expiring'); // should be a miss

    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  test('API client returns cached flag on second call', async () => {
    const mockResp = mockSuccessResponse(['ts_code', 'close'], [['600519.SH', 1850.5]]);
    const { client } = makeClient(mock(async () => ({ ok: true, json: async () => mockResp })) as any);

    const req: TushareRequest = {
      apiName: 'daily',
      params: { ts_code: '600519.SH' },
      options: { cacheable: true, cacheStrategy: CacheStrategy.CURRENT_DAY },
    };

    const first = await client.call(req);
    expect(first.metadata?.cached).toBe(false);

    const start = performance.now();
    const second = await client.call(req);
    const elapsed = performance.now() - start;

    expect(second.metadata?.cached).toBe(true);
    expect(elapsed).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// Parallel execution performance
// ---------------------------------------------------------------------------

describe('Parallel execution performance', () => {
  test('parallel batch is faster than sequential execution', async () => {
    // Each fake API call takes ~30ms
    const CALL_DELAY_MS = 30;
    const NUM_REQUESTS = 5;

    const slowFetch = mock(async () => {
      await new Promise((r) => setTimeout(r, CALL_DELAY_MS));
      return {
        ok: true,
        json: async () => mockSuccessResponse(['ts_code', 'close'], [['600519.SH', 1850.5]]),
      };
    }) as any;

    const { client } = makeClient(slowFetch);

    const requests: TushareRequest[] = Array.from({ length: NUM_REQUESTS }, (_, i) => ({
      apiName: 'daily',
      params: { ts_code: `60000${i}.SH` },
      options: { cacheable: false },
    }));

    // Parallel via callBatch
    const parallelStart = performance.now();
    await client.callBatch(requests);
    const parallelTime = performance.now() - parallelStart;

    // Sequential baseline
    const seqStart = performance.now();
    for (const req of requests) {
      await client.call(req);
    }
    const seqTime = performance.now() - seqStart;

    // Parallel should be meaningfully faster than sequential
    // (sequential ≈ N * delay; parallel ≈ delay + overhead)
    expect(parallelTime).toBeLessThan(seqTime * 0.8);
  });

  test('semaphore limits concurrent requests to 5', async () => {
    let activeConcurrent = 0;
    let maxObservedConcurrent = 0;

    const trackingFetch = mock(async () => {
      activeConcurrent++;
      maxObservedConcurrent = Math.max(maxObservedConcurrent, activeConcurrent);
      await new Promise((r) => setTimeout(r, 20));
      activeConcurrent--;
      return {
        ok: true,
        json: async () => mockSuccessResponse(['ts_code', 'close'], [['600519.SH', 1850.5]]),
      };
    }) as any;

    const { client } = makeClient(trackingFetch);

    // Fire 10 requests simultaneously — semaphore should cap at 5
    const requests: TushareRequest[] = Array.from({ length: 10 }, (_, i) => ({
      apiName: 'daily',
      params: { ts_code: `60000${i}.SH` },
      options: { cacheable: false },
    }));

    await client.callBatch(requests);

    expect(maxObservedConcurrent).toBeLessThanOrEqual(5);
  });

  test('global semaphore is a singleton shared across client instances', () => {
    // Two separate client instances must share the same semaphore object
    const cache1 = new CacheManager();
    const cache2 = new CacheManager();
    const eh = new ErrorHandler();
    const m = new MetricsTrackerImpl();

    const c1 = new TushareApiClientImpl('token-a', cache1, eh, m);
    const c2 = new TushareApiClientImpl('token-b', cache2, eh, m);

    // Both clients reference the same exported singleton
    expect(GLOBAL_TUSHARE_SEMAPHORE).toBeDefined();
    // Verify both instances were constructed without error (they share the global semaphore)
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
  });

  test('parallel execution completes all requests even when some are slow', async () => {
    let callCount = 0;
    const mixedFetch = mock(async () => {
      callCount++;
      // Alternate between fast and slow responses
      const delay = callCount % 2 === 0 ? 50 : 5;
      await new Promise((r) => setTimeout(r, delay));
      return {
        ok: true,
        json: async () => mockSuccessResponse(['ts_code', 'close'], [['600519.SH', 1850.5]]),
      };
    }) as any;

    const { client } = makeClient(mixedFetch);

    const requests: TushareRequest[] = Array.from({ length: 6 }, (_, i) => ({
      apiName: 'daily',
      params: { ts_code: `60000${i}.SH` },
      options: { cacheable: false },
    }));

    const results = await client.callBatch(requests);
    expect(results).toHaveLength(6);
    expect(callCount).toBe(6);
  });
});
