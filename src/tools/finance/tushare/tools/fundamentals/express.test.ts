/**
 * Tests for get_cn_express tool
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { mockTushareApi, buildEmptyResponse, buildErrorResponse } from '../../__tests__/mocks';
import { expressFixture } from '../../__tests__/fixtures';
import { getCnExpress } from './index';

const EXPRESS_FIELDS = [
  'ts_code', 'ann_date', 'end_date',
  'revenue', 'operate_profit', 'total_profit', 'n_income', 'total_assets',
  'total_hldr_eqy_exc_min_int', 'diluted_eps', 'diluted_roe',
  'yoy_net_profit', 'bps', 'yoy_sales', 'yoy_op', 'yoy_tp',
  'yoy_dedu_np', 'yoy_eps', 'yoy_roe', 'growth_assets', 'yoy_equity',
  'growth_bps', 'or_last_year', 'op_last_year', 'tp_last_year',
  'np_last_year', 'eps_last_year', 'open_net_assets', 'open_bps',
  'perf_summary', 'is_audit', 'remark',
];

describe('get_cn_express', () => {
  let restore: () => void;

  afterEach(() => {
    restore?.();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test('returns express records for a stock code', async () => {
    restore = mockTushareApi((apiName) => {
      expect(apiName).toBe('express');
      return expressFixture;
    });

    const raw = await getCnExpress.invoke({ ts_code: '603535.SH' });
    const result = JSON.parse(raw);

    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBeGreaterThan(0);

    const first = result.data[0];
    expect(typeof first.ts_code).toBe('string');
    expect(first.ann_date).toBeDefined();
    expect(first.end_date).toBeDefined();
    expect(typeof first.revenue).toBe('number');
    expect(typeof first.n_income).toBe('number');
  });

  test('forwards start_date and end_date params to the API', async () => {
    restore = mockTushareApi((apiName, params) => {
      expect(apiName).toBe('express');
      expect(params['ts_code']).toBe('600000.SH');
      expect(params['start_date']).toBe('20180101');
      expect(params['end_date']).toBe('20180701');
      return expressFixture;
    });

    const raw = await getCnExpress.invoke({
      ts_code: '600000.SH',
      start_date: '20180101',
      end_date: '20180701',
    });
    const result = JSON.parse(raw);
    expect(result.data).toBeInstanceOf(Array);
  });

  test('forwards period param to the API', async () => {
    restore = mockTushareApi((apiName, params) => {
      expect(apiName).toBe('express');
      expect(params['period']).toBe('20171231');
      return expressFixture;
    });

    const raw = await getCnExpress.invoke({ ts_code: '603535.SH', period: '20171231' });
    const result = JSON.parse(raw);
    expect(result.data).toBeInstanceOf(Array);
  });

  test('result contains all expected fields', async () => {
    restore = mockTushareApi(() => expressFixture);

    const raw = await getCnExpress.invoke({ ts_code: '603535.SH' });
    const result = JSON.parse(raw);
    const record = result.data[0];

    for (const field of EXPRESS_FIELDS) {
      expect(record).toHaveProperty(field);
    }
  });

  test('returns multiple records', async () => {
    restore = mockTushareApi(() => expressFixture);

    const raw = await getCnExpress.invoke({ ts_code: '603535.SH' });
    const result = JSON.parse(raw);

    expect(result.data.length).toBeGreaterThan(1);
  });

  test('returns empty array when no records found', async () => {
    restore = mockTushareApi(() => buildEmptyResponse(EXPRESS_FIELDS));

    const raw = await getCnExpress.invoke({ ts_code: '000001.SZ' });
    const result = JSON.parse(raw);
    expect(result.data).toEqual([]);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  test('throws on invalid stock code', async () => {
    restore = mockTushareApi(() => expressFixture);
    await expect(getCnExpress.invoke({ ts_code: 'INVALID' })).rejects.toThrow();
  });

  test('throws on invalid start_date format', async () => {
    restore = mockTushareApi(() => expressFixture);
    await expect(
      getCnExpress.invoke({ ts_code: '603535.SH', start_date: '2018-01-01' })
    ).rejects.toThrow();
  });

  test('throws on invalid period format', async () => {
    restore = mockTushareApi(() => expressFixture);
    await expect(
      getCnExpress.invoke({ ts_code: '603535.SH', period: '171231' })
    ).rejects.toThrow();
  });

  // ── API error handling ──────────────────────────────────────────────────────

  test('returns error string when API responds with non-zero code', async () => {
    restore = mockTushareApi(() => buildErrorResponse(2002, 'Insufficient points (requires 2000)'));
    const raw = await getCnExpress.invoke({ ts_code: '603535.SH' });
    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(0);
  });
});
