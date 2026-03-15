/**
 * Tests for get_cn_stock_week_month_adj tool
 *
 * Covers: happy path (week/month), validation errors, empty results,
 * cache behaviour, and API error handling.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { getCnStockWeekMonthAdj } from './daily.js';
import { mockTushareApi, buildRawResponse, buildErrorResponse, buildEmptyResponse } from '../../__tests__/mocks.js';
import { stkWeekMonthAdjFixture } from '../../__tests__/fixtures.js';

const FIELDS = [
  'ts_code', 'trade_date', 'freq',
  'open', 'high', 'low', 'close', 'pre_close',
  'open_qfq', 'high_qfq', 'low_qfq', 'close_qfq',
  'open_hfq', 'high_hfq', 'low_hfq', 'close_hfq',
  'vol', 'amount', 'change', 'pct_chg',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseResult(raw: unknown): { data: unknown[] } {
  const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return JSON.parse(str) as { data: unknown[] };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('get_cn_stock_week_month_adj', () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test('returns weekly adjusted prices from fixture', async () => {
    restore = mockTushareApi((apiName) => {
      expect(apiName).toBe('stk_week_month_adj');
      return stkWeekMonthAdjFixture;
    });

    const raw = await getCnStockWeekMonthAdj.invoke({
      ts_code: '000001.SZ',
      freq: 'week',
      start_date: '20250101',
      end_date: '20250117',
    });

    const result = parseResult(raw);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBeGreaterThan(0);

    const first = result.data[0] as Record<string, unknown>;
    expect(first['ts_code']).toBe('000001.SZ');
    expect(first['freq']).toBe('week');
    expect(typeof first['close_qfq']).toBe('number');
    expect(typeof first['close_hfq']).toBe('number');
  });

  test('returns monthly adjusted prices', async () => {
    restore = mockTushareApi((apiName, params) => {
      expect(apiName).toBe('stk_week_month_adj');
      expect(params['freq']).toBe('month');
      return buildRawResponse(FIELDS, [
        ['600519.SH', '20241231', 'month', 1600.0, 1750.0, 1580.0, 1710.0, 1620.0,
          1600.0, 1750.0, 1580.0, 1710.0, 200000.0, 220000.0, 198000.0, 214000.0,
          5000000.0, 8500000000.0, 90.0, 0.056],
      ]);
    });

    const raw = await getCnStockWeekMonthAdj.invoke({
      ts_code: '600519.SH',
      freq: 'month',
      start_date: '20241201',
      end_date: '20241231',
    });

    const result = parseResult(raw);
    const first = result.data[0] as Record<string, unknown>;
    expect(first['freq']).toBe('month');
    expect(first['ts_code']).toBe('600519.SH');
  });

  test('works with only ts_code and freq (no date range)', async () => {
    restore = mockTushareApi(() => stkWeekMonthAdjFixture);

    const raw = await getCnStockWeekMonthAdj.invoke({
      ts_code: '000001.SZ',
      freq: 'week',
    });

    const result = parseResult(raw);
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('works with trade_date instead of date range', async () => {
    restore = mockTushareApi((_, params) => {
      expect(params['trade_date']).toBe('20250117');
      return stkWeekMonthAdjFixture;
    });

    const raw = await getCnStockWeekMonthAdj.invoke({
      ts_code: '000001.SZ',
      freq: 'week',
      trade_date: '20250117',
    });

    const result = parseResult(raw);
    expect(Array.isArray(result.data)).toBe(true);
  });

  // ── Empty results ───────────────────────────────────────────────────────────

  test('handles empty result set gracefully', async () => {
    restore = mockTushareApi(() => buildEmptyResponse(FIELDS));

    const raw = await getCnStockWeekMonthAdj.invoke({
      ts_code: '000001.SZ',
      freq: 'week',
      start_date: '20200101',
      end_date: '20200107',
    });

    const result = parseResult(raw);
    expect(result.data).toEqual([]);
  });

  // ── Validation errors ───────────────────────────────────────────────────────

  test('rejects invalid stock code', async () => {
    await expect(
      getCnStockWeekMonthAdj.invoke({ ts_code: 'INVALID', freq: 'week' })
    ).rejects.toThrow();
  });

  test('rejects invalid trade_date format', async () => {
    await expect(
      getCnStockWeekMonthAdj.invoke({ ts_code: '000001.SZ', freq: 'week', trade_date: '2025-01-17' })
    ).rejects.toThrow();
  });

  test('rejects invalid date range (start after end)', async () => {
    await expect(
      getCnStockWeekMonthAdj.invoke({
        ts_code: '000001.SZ',
        freq: 'week',
        start_date: '20250131',
        end_date: '20250101',
      })
    ).rejects.toThrow();
  });

  // ── API error handling ──────────────────────────────────────────────────────

  test('propagates API error response', async () => {
    restore = mockTushareApi(() => buildErrorResponse(2002, '权限不足'));

    // Use a unique code to avoid cache hits from earlier tests
    await expect(
      getCnStockWeekMonthAdj.invoke({ ts_code: '601398.SH', freq: 'week' })
    ).rejects.toThrow(/权限不足|2002/);
  });

  // ── Field completeness ──────────────────────────────────────────────────────

  test('result contains all expected adjusted price fields', async () => {
    restore = mockTushareApi(() => stkWeekMonthAdjFixture);

    const raw = await getCnStockWeekMonthAdj.invoke({
      ts_code: '000001.SZ',
      freq: 'week',
    });

    const result = parseResult(raw);
    const record = result.data[0] as Record<string, unknown>;

    const expectedFields = [
      'ts_code', 'trade_date', 'freq',
      'open', 'high', 'low', 'close',
      'open_qfq', 'close_qfq',
      'open_hfq', 'close_hfq',
      'vol', 'amount', 'pct_chg',
    ];

    for (const field of expectedFields) {
      expect(record).toHaveProperty(field);
    }
  });
});
