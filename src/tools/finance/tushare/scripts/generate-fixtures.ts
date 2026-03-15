/**
 * Fixture generation script for Tushare API tests.
 *
 * Makes real Tushare API calls and saves raw JSON responses to
 * src/tools/finance/tushare/__tests__/fixtures/raw/
 *
 * Usage:
 *   bun run src\tools\finance\tushare\scripts\generate-fixtures.ts
 *
 * Requires TUSHARE_API_KEY to be set in the environment.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TOKEN = process.env['TUSHARE_API_KEY'];
if (!TOKEN) {
  console.error('Error: TUSHARE_API_KEY environment variable is not set.');
  process.exit(1);
}

const BASE_URL = 'https://api.tushare.pro';
const OUT_DIR = join(
  import.meta.dir,
  '../__tests__/fixtures/raw'
);

mkdirSync(OUT_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callApi(
  apiName: string,
  params: Record<string, string | number | undefined>,
  fields?: string[]
): Promise<unknown> {
  const body = {
    api_name: apiName,
    token: TOKEN,
    params,
    fields: fields?.join(','),
  };

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${apiName}`);
  }

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`Tushare error ${json.code}: ${json.msg} (api: ${apiName})`);
  }

  return json;
}

function save(filename: string, data: unknown): void {
  const path = join(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ ${filename}`);
}

// ── Fixture definitions ───────────────────────────────────────────────────────

// Reference stock used for most per-stock endpoints
const SAMPLE_STOCK = '600519.SH'; // Kweichow Moutai
const SAMPLE_DATE = '20240115';
const SAMPLE_START = '20240101';
const SAMPLE_END = '20240131';

const fixtures: Array<{
  filename: string;
  apiName: string;
  params: Record<string, string | number | undefined>;
  fields?: string[];
}> = [
    // Price data
    {
      filename: 'daily.json',
      apiName: 'daily',
      params: { ts_code: SAMPLE_STOCK, start_date: SAMPLE_START, end_date: SAMPLE_END },
      fields: ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount'],
    },
    // Valuation metrics
    {
      filename: 'daily_basic.json',
      apiName: 'daily_basic',
      params: { ts_code: SAMPLE_STOCK, trade_date: SAMPLE_DATE },
      fields: ['ts_code', 'trade_date', 'close', 'turnover_rate', 'turnover_rate_f', 'volume_ratio', 'pe', 'pe_ttm', 'pb', 'ps', 'ps_ttm', 'dv_ratio', 'dv_ttm', 'total_share', 'float_share', 'total_mv', 'circ_mv'],
    },
    // Income statement
    {
      filename: 'income.json',
      apiName: 'income',
      params: { ts_code: SAMPLE_STOCK, period: '20231231', report_type: '1' },
      fields: ['ts_code', 'ann_date', 'f_ann_date', 'end_date', 'report_type', 'total_revenue', 'revenue', 'total_cogs', 'oper_cost', 'sell_exp', 'admin_exp', 'rd_exp', 'fin_exp', 'operate_profit', 'total_profit', 'income_tax', 'n_income', 'n_income_attr_p', 'basic_eps', 'diluted_eps'],
    },
    // Balance sheet
    {
      filename: 'balancesheet.json',
      apiName: 'balancesheet',
      params: { ts_code: SAMPLE_STOCK, period: '20231231', report_type: '1' },
      fields: ['ts_code', 'ann_date', 'f_ann_date', 'end_date', 'report_type', 'total_assets', 'total_liab', 'total_hldr_eqy_exc_min_int', 'total_cur_assets', 'total_nca', 'total_cur_liab', 'total_ncl', 'money_cap', 'accounts_receiv', 'inventories', 'fix_assets', 'intan_assets', 'goodwill', 'lt_borr', 'bond_payable'],
    },
    // Cash flow statement
    {
      filename: 'cashflow.json',
      apiName: 'cashflow',
      params: { ts_code: SAMPLE_STOCK, period: '20231231', report_type: '1' },
      fields: ['ts_code', 'ann_date', 'f_ann_date', 'end_date', 'report_type', 'n_cashflow_act', 'n_cashflow_inv_act', 'n_cash_flows_fnc_act', 'c_fr_sale_sg', 'c_paid_goods_s', 'c_paid_to_for_empl', 'c_paid_for_taxes', 'n_incr_cash_cash_equ', 'c_cash_equ_beg_period', 'c_cash_equ_end_period', 'free_cashflow'],
    },
    // Financial indicators
    {
      filename: 'fina_indicator.json',
      apiName: 'fina_indicator',
      params: { ts_code: SAMPLE_STOCK, period: '20231231' },
      fields: ['ts_code', 'ann_date', 'end_date', 'eps', 'bps', 'roe', 'roe_dt', 'roa', 'grossprofit_margin', 'netprofit_margin', 'debt_to_assets', 'current_ratio', 'quick_ratio', 'ocf_to_or', 'ocf_to_opincome', 'inc_revenue_yoy', 'inc_net_profit_yoy', 'inc_total_assets_yoy'],
    },
    // Northbound flow
    {
      filename: 'moneyflow_hsgt.json',
      apiName: 'moneyflow_hsgt',
      params: { start_date: SAMPLE_START, end_date: SAMPLE_END },
      fields: ['trade_date', 'ggt_ss', 'ggt_sz', 'hgt', 'sgt', 'north_money', 'south_money'],
    },
    // Margin data
    {
      filename: 'margin.json',
      apiName: 'margin',
      params: { ts_code: SAMPLE_STOCK, start_date: SAMPLE_START, end_date: SAMPLE_END },
      fields: ['trade_date', 'ts_code', 'rzye', 'rqye', 'rzmre', 'rqmcl', 'rzche', 'rqchl'],
    },
    // Block trades
    {
      filename: 'block_trade.json',
      apiName: 'block_trade',
      params: { ts_code: SAMPLE_STOCK, start_date: SAMPLE_START, end_date: SAMPLE_END },
      fields: ['ts_code', 'trade_date', 'price', 'vol', 'amount', 'buyer', 'seller'],
    },
    // Limit list
    {
      filename: 'limit_list.json',
      apiName: 'limit_list',
      params: { trade_date: SAMPLE_DATE },
      fields: ['trade_date', 'ts_code', 'name', 'close', 'pct_chg', 'amount', 'limit_type', 'times'],
    },
    // Stock list
    {
      filename: 'stock_basic.json',
      apiName: 'stock_basic',
      params: { list_status: 'L', exchange: 'SSE' },
      fields: ['ts_code', 'symbol', 'name', 'area', 'industry', 'market', 'list_date', 'exchange', 'curr_type', 'list_status'],
    },
    // Trade calendar
    {
      filename: 'trade_cal.json',
      apiName: 'trade_cal',
      params: { exchange: 'SSE', start_date: SAMPLE_START, end_date: SAMPLE_END },
      fields: ['exchange', 'cal_date', 'is_open', 'pretrade_date'],
    },
    // Weekly/monthly adjusted prices
    {
      filename: 'stk_week_month_adj.json',
      apiName: 'stk_week_month_adj',
      params: { ts_code: SAMPLE_STOCK, freq: 'week', start_date: SAMPLE_START, end_date: SAMPLE_END },
      fields: [
        'ts_code', 'trade_date', 'freq',
        'open', 'high', 'low', 'close', 'pre_close',
        'open_qfq', 'high_qfq', 'low_qfq', 'close_qfq',
        'open_hfq', 'high_hfq', 'low_hfq', 'close_hfq',
        'vol', 'amount', 'change', 'pct_chg',
      ],
    },
    // Earnings forecast
    {
      filename: 'forecast.json',
      apiName: 'forecast',
      params: { ts_code: SAMPLE_STOCK, start_date: '20190101', end_date: '20191231' },
      fields: ['ts_code', 'ann_date', 'end_date', 'type', 'p_change_min', 'p_change_max', 'net_profit_min', 'net_profit_max', 'last_parent_net', 'first_ann_date', 'summary', 'change_reason'],
    },
  ];

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`Generating fixtures → ${OUT_DIR}\n`);

let passed = 0;
let failed = 0;

for (const { filename, apiName, params, fields } of fixtures) {
  try {
    const data = await callApi(apiName, params, fields);
    save(filename, data);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${filename}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log(`\nDone: ${passed} succeeded, ${failed} failed.`);
if (failed > 0) process.exit(1);
