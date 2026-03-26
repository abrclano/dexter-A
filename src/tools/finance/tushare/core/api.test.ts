/**
 * Tests for Tushare API Client
 */

import { describe, test, expect, beforeEach, mock, jest } from 'bun:test';
import { TushareApiClientImpl, GLOBAL_TUSHARE_SEMAPHORE } from './api.js';
import { CacheManager } from './cache.js';
import { ErrorHandler } from './error.js';
import { MetricsTrackerImpl } from './metrics.js';
import type { TushareRequest, TushareRawResponse } from '../types/api.js';
import { CacheStrategy } from '../types/api.js';
import { logger } from '../../../../utils/logger.js';

describe('TushareApiClient', () => {
  let cache: CacheManager;
  let errorHandler: ErrorHandler;
  let metrics: MetricsTrackerImpl;
  let client: TushareApiClientImpl;

  beforeEach(() => {
    cache = new CacheManager();
    errorHandler = new ErrorHandler();
    metrics = new MetricsTrackerImpl();
    client = new TushareApiClientImpl('test-token', cache, errorHandler, metrics);
  });

  describe('constructor', () => {
    test('should call logger.warn if token is missing', () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      new TushareApiClientImpl('', cache, errorHandler, metrics);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[TUSHARE API] call without key'));
    });

    test('should create client with valid token', () => {
      expect(client).toBeDefined();
    });
  });

  describe('response transformation', () => {
    test('should transform tabular response to object array', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 0,
        msg: null,
        data: {
          fields: ['ts_code', 'trade_date', 'close', 'pct_chg'],
          items: [
            ['600519.SH', '20240115', 1850.5, 2.5],
            ['600519.SH', '20240116', 1900.0, 2.67],
          ],
        },
      };

      // Mock fetch
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const request: TushareRequest = {
        apiName: 'daily',
        params: { ts_code: '600519.SH' },
        options: { cacheable: false },
      };

      const response = await client.call(request);

      expect(response.data).toEqual([
        { ts_code: '600519.SH', trade_date: '20240115', close: 1850.5, pct_chg: 2.5 },
        { ts_code: '600519.SH', trade_date: '20240116', close: 1900.0, pct_chg: 2.67 },
      ]);
    });

    test('should handle empty response', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 0,
        msg: null,
        data: {
          fields: ['ts_code', 'trade_date', 'close'],
          items: [],
        },
      };

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const request: TushareRequest = {
        apiName: 'daily',
        params: { ts_code: '600519.SH' },
        options: { cacheable: false },
      };

      const response = await client.call(request);
      expect(response.data).toEqual([]);
    });

    test('should preserve all original field names', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 0,
        msg: null,
        data: {
          fields: ['ts_code', 'ann_date', 'f_ann_date', 'end_date', 'total_revenue'],
          items: [['600519.SH', '20240115', '20240115', '20231231', 50000000000]],
        },
      };

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const request: TushareRequest = {
        apiName: 'income',
        params: { ts_code: '600519.SH' },
        options: { cacheable: false },
      };

      const response = await client.call(request);

      expect(response.data).toEqual([
        {
          ts_code: '600519.SH',
          ann_date: '20240115',
          f_ann_date: '20240115',
          end_date: '20231231',
          total_revenue: 50000000000,
        },
      ]);
    });
  });

  describe('caching', () => {
    test('should cache successful responses', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 0,
        msg: null,
        data: {
          fields: ['ts_code', 'close'],
          items: [['600519.SH', 1850.5]],
        },
      };

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const request: TushareRequest = {
        apiName: 'daily',
        params: { ts_code: '600519.SH' },
        options: {
          cacheable: true,
          cacheStrategy: CacheStrategy.CURRENT_DAY,
        },
      };

      // First call - should hit API
      const response1 = await client.call(request);
      expect(response1.metadata?.cached).toBe(false);

      // Second call - should hit cache
      const response2 = await client.call(request);
      expect(response2.metadata?.cached).toBe(true);
      expect(response2.data).toEqual(response1.data);
    });

    test('should not cache when cacheable is false', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 0,
        msg: null,
        data: {
          fields: ['ts_code', 'close'],
          items: [['600519.SH', 1850.5]],
        },
      };

      let callCount = 0;
      global.fetch = mock(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => mockResponse,
        };
      }) as any;

      const request: TushareRequest = {
        apiName: 'daily',
        params: { ts_code: '600519.SH' },
        options: { cacheable: false },
      };

      await client.call(request);
      await client.call(request);

      expect(callCount).toBe(2);
    });
  });

  describe('error handling', () => {
    test('should throw error for API error code', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 40001,
        msg: 'Invalid token',
        data: null,
      };

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const request: TushareRequest = {
        apiName: 'daily',
        params: { ts_code: '600519.SH' },
        options: { retries: 1 },
      };

      await expect(client.call(request)).rejects.toThrow();
    });

    test('should throw error for HTTP error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })) as any;

      const request: TushareRequest = {
        apiName: 'daily',
        params: { ts_code: '600519.SH' },
        options: { retries: 1 },
      };

      await expect(client.call(request)).rejects.toThrow();
    });
  });

  describe('batch calls', () => {
    test('should execute multiple requests in parallel', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 0,
        msg: null,
        data: {
          fields: ['ts_code', 'close'],
          items: [['600519.SH', 1850.5]],
        },
      };

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const requests: TushareRequest[] = [
        {
          apiName: 'daily',
          params: { ts_code: '600519.SH' },
          options: { cacheable: false },
        },
        {
          apiName: 'daily',
          params: { ts_code: '000001.SZ' },
          options: { cacheable: false },
        },
      ];

      const responses = await client.callBatch(requests);

      expect(responses).toHaveLength(2);
      expect(responses[0].data).toBeDefined();
      expect(responses[1].data).toBeDefined();
    });
  });

  describe('metrics tracking', () => {
    test('should track API calls', async () => {
      const mockResponse: TushareRawResponse = {
        request_id: 'test-123',
        code: 0,
        msg: null,
        data: {
          fields: ['ts_code', 'close'],
          items: [['600519.SH', 1850.5]],
        },
      };

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as any;

      const request: TushareRequest = {
        apiName: 'daily',
        params: { ts_code: '600519.SH' },
        options: { cacheable: false },
      };

      await client.call(request);

      const metricsData = metrics.getMetrics();
      expect(metricsData.apiCalls.total).toBe(1);
      expect(metricsData.apiCalls.byApi['daily']).toBe(1);
    });
  });

  describe('global semaphore', () => {
    test('should export global semaphore singleton', () => {
      expect(GLOBAL_TUSHARE_SEMAPHORE).toBeDefined();
    });
  });
});
