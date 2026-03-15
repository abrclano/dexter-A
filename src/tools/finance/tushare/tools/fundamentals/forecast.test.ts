/**
 * Tests for get_cn_forecast tool
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { mockTushareApi, buildEmptyResponse, buildErrorResponse } from '../../__tests__/mocks';
import { forecastFixture } from '../../__tests__/fixtures';
import { getCnForecast } from './index';

describe('get_cn_forecast', () => {
  let restore: () => void;

  afterEach(() => {
    restore?.();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test('returns forecast list when queried by stock code', async () => {
    restore = mockTushareApi((apiName) => {
      expect(apiName).toBe('forecast');
      return forecastFixture;
    });

    const raw = await getCnForecast.invoke({ ts_code: '000005.SZ' });
    const result = JSON.parse(raw);

    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBeGreaterThan(0);

    const first = result.data[0];
    expect(first.ts_code).toBe('000005.SZ');
    expect(first.ann_date).toBe('20190131');
    expect(first.end_date).toBe('20181231');
    expect(first.type).toBe('预增');
    expect(typeof first.p_change_min).toBe('number');
    expect(typeof first.p_change_max).toBe('number');
  });

  test('returns multiple records when queried by announcement date', async () => {
    restore = mockTushareApi(() => forecastFixture);

    const raw = await getCnForecast.invoke({ ann_date: '20190131' });
    const result = JSON.parse(raw);

    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBe(2);
  });

  test('result contains all expected fields', async () => {
    restore = mockTushareApi(() => forecastFixture);

    const raw = await getCnForecast.invoke({ ts_code: '000005.SZ' });
    const result = JSON.parse(raw);
    const record = result.data[0];

    const expectedFields = [
      'ts_code', 'ann_date', 'end_date', 'type',
      'p_change_min', 'p_change_max',
      'net_profit_min', 'net_profit_max',
      'last_parent_net', 'first_ann_date',
      'summary', 'change_reason',
    ];
    for (const field of expectedFields) {
      expect(record).toHaveProperty(field);
    }
  });

  test('forwards period and type params to the API', async () => {
    restore = mockTushareApi((apiName, params) => {
      expect(apiName).toBe('forecast');
      expect(params['period']).toBe('20181231');
      expect(params['type']).toBe('预增');
      return forecastFixture;
    });

    const raw = await getCnForecast.invoke({ period: '20181231', type: '预增' });
    const result = JSON.parse(raw);
    expect(result.data).toBeInstanceOf(Array);
  });

  test('returns empty array when no records found', async () => {
    restore = mockTushareApi(() =>
      buildEmptyResponse([
        'ts_code', 'ann_date', 'end_date', 'type',
        'p_change_min', 'p_change_max', 'net_profit_min', 'net_profit_max',
        'last_parent_net', 'first_ann_date', 'summary', 'change_reason',
      ])
    );

    const raw = await getCnForecast.invoke({ ts_code: '000001.SZ' });
    const result = JSON.parse(raw);
    expect(result.data).toEqual([]);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  test('throws on invalid stock code', async () => {
    restore = mockTushareApi(() => forecastFixture);
    await expect(getCnForecast.invoke({ ts_code: 'INVALID' })).rejects.toThrow();
  });

  test('throws on invalid announcement date format', async () => {
    restore = mockTushareApi(() => forecastFixture);
    await expect(getCnForecast.invoke({ ann_date: '2019-01-31' })).rejects.toThrow();
  });

  test('throws on invalid period format', async () => {
    restore = mockTushareApi(() => forecastFixture);
    await expect(getCnForecast.invoke({ period: '181231' })).rejects.toThrow();
  });

  // ── API error handling ──────────────────────────────────────────────────────

  test('returns error string when API responds with non-zero code', async () => {
    // LangChain tool() wrapper catches errors and returns them as a string result
    restore = mockTushareApi(() => buildErrorResponse(2002, 'Insufficient points (requires 2000)'));
    const raw = await getCnForecast.invoke({ ts_code: '000005.SZ' });
    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(0);
  });
});
