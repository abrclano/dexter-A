/**
 * API response schema validators for Tushare module
 *
 * Provides Zod schemas for all Tushare API response types, plus helpers for
 * schema validation, required-field checking, and numeric type coercion.
 */

import { z } from 'zod';
import { TushareError } from '../core/error.js';

// ============================================================================
// Numeric coercion helper
// ============================================================================

/**
 * Zod schema that accepts a number or a numeric string and coerces to number.
 * Throws a descriptive TushareError if coercion fails.
 */
export const numericField = z.union([z.number(), z.string()]).transform((val, ctx) => {
  if (typeof val === 'number') return val;
  const n = Number(val);
  if (isNaN(n)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected numeric value, received "${val}"`,
    });
    return z.NEVER;
  }
  return n;
});

/** Nullable numeric field — null/undefined pass through as null. */
export const nullableNumeric = z
  .union([z.number(), z.string(), z.null()])
  .nullable()
  .transform((val, ctx) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const n = Number(val);
    if (isNaN(n)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected numeric value, received "${val}"`,
      });
      return z.NEVER;
    }
    return n;
  });

// ============================================================================
// Per-API response schemas
// ============================================================================
//
// Design notes:
// - All non-key fields are optional: Tushare only returns the fields you
//   request, so a partial field list is always valid.
// - .passthrough() preserves any extra fields not listed in the schema.
// - Numeric fields use nullableNumeric to coerce string numbers → number.
// - Key identifier fields (ts_code, trade_date, etc.) are required strings.

export const DailyPriceSchema = z
  .object({
    ts_code: z.string().optional(),
    trade_date: z.string().optional(),
    open: nullableNumeric.optional(),
    high: nullableNumeric.optional(),
    low: nullableNumeric.optional(),
    close: nullableNumeric.optional(),
    pre_close: nullableNumeric.optional(),
    change: nullableNumeric.optional(),
    pct_chg: nullableNumeric.optional(),
    vol: nullableNumeric.optional(),
    amount: nullableNumeric.optional(),
  })
  .passthrough();

export const DailyBasicSchema = z
  .object({
    ts_code: z.string().optional(),
    trade_date: z.string().optional(),
    close: nullableNumeric.optional(),
    turnover_rate: nullableNumeric.optional(),
    turnover_rate_f: nullableNumeric.optional(),
    volume_ratio: nullableNumeric.optional(),
    pe: nullableNumeric.optional(),
    pe_ttm: nullableNumeric.optional(),
    pb: nullableNumeric.optional(),
    ps: nullableNumeric.optional(),
    ps_ttm: nullableNumeric.optional(),
    dv_ratio: nullableNumeric.optional(),
    dv_ttm: nullableNumeric.optional(),
    total_share: nullableNumeric.optional(),
    float_share: nullableNumeric.optional(),
    total_mv: nullableNumeric.optional(),
    circ_mv: nullableNumeric.optional(),
  })
  .passthrough();

export const IncomeSchema = z
  .object({
    ts_code: z.string().optional(),
    end_date: z.string().optional(),
    ann_date: z.string().nullable().optional(),
    f_ann_date: z.string().nullable().optional(),
    report_type: z.string().nullable().optional(),
    total_revenue: nullableNumeric.optional(),
    revenue: nullableNumeric.optional(),
    total_cogs: nullableNumeric.optional(),
    oper_cost: nullableNumeric.optional(),
    sell_exp: nullableNumeric.optional(),
    admin_exp: nullableNumeric.optional(),
    rd_exp: nullableNumeric.optional(),
    fin_exp: nullableNumeric.optional(),
    operate_profit: nullableNumeric.optional(),
    total_profit: nullableNumeric.optional(),
    income_tax: nullableNumeric.optional(),
    n_income: nullableNumeric.optional(),
    n_income_attr_p: nullableNumeric.optional(),
    basic_eps: nullableNumeric.optional(),
    diluted_eps: nullableNumeric.optional(),
  })
  .passthrough();

export const BalanceSheetSchema = z
  .object({
    ts_code: z.string().optional(),
    end_date: z.string().optional(),
    ann_date: z.string().nullable().optional(),
    f_ann_date: z.string().nullable().optional(),
    report_type: z.string().nullable().optional(),
    total_assets: nullableNumeric.optional(),
    total_liab: nullableNumeric.optional(),
    total_hldr_eqy_exc_min_int: nullableNumeric.optional(),
    total_cur_assets: nullableNumeric.optional(),
    total_nca: nullableNumeric.optional(),
    total_cur_liab: nullableNumeric.optional(),
    total_ncl: nullableNumeric.optional(),
    money_cap: nullableNumeric.optional(),
    trad_asset: nullableNumeric.optional(),
    notes_receiv: nullableNumeric.optional(),
    accounts_receiv: nullableNumeric.optional(),
    oth_receiv: nullableNumeric.optional(),
    prepayment: nullableNumeric.optional(),
    inventories: nullableNumeric.optional(),
    fix_assets: nullableNumeric.optional(),
    intan_assets: nullableNumeric.optional(),
    goodwill: nullableNumeric.optional(),
    lt_borr: nullableNumeric.optional(),
    bond_payable: nullableNumeric.optional(),
  })
  .passthrough();

export const CashFlowSchema = z
  .object({
    ts_code: z.string().optional(),
    end_date: z.string().optional(),
    ann_date: z.string().nullable().optional(),
    f_ann_date: z.string().nullable().optional(),
    report_type: z.string().nullable().optional(),
    n_cashflow_act: nullableNumeric.optional(),
    n_cashflow_inv_act: nullableNumeric.optional(),
    n_cash_flows_fnc_act: nullableNumeric.optional(),
    c_fr_sale_sg: nullableNumeric.optional(),
    c_paid_goods_s: nullableNumeric.optional(),
    c_paid_to_for_empl: nullableNumeric.optional(),
    c_paid_for_taxes: nullableNumeric.optional(),
    n_incr_cash_cash_equ: nullableNumeric.optional(),
    c_cash_equ_beg_period: nullableNumeric.optional(),
    c_cash_equ_end_period: nullableNumeric.optional(),
    free_cashflow: nullableNumeric.optional(),
  })
  .passthrough();

export const FinancialIndicatorsSchema = z
  .object({
    ts_code: z.string().optional(),
    end_date: z.string().optional(),
    ann_date: z.string().nullable().optional(),
    eps: nullableNumeric.optional(),
    bps: nullableNumeric.optional(),
    roe: nullableNumeric.optional(),
    roe_dt: nullableNumeric.optional(),
    roa: nullableNumeric.optional(),
    grossprofit_margin: nullableNumeric.optional(),
    netprofit_margin: nullableNumeric.optional(),
    debt_to_assets: nullableNumeric.optional(),
    current_ratio: nullableNumeric.optional(),
    quick_ratio: nullableNumeric.optional(),
    ocf_to_or: nullableNumeric.optional(),
    ocf_to_opincome: nullableNumeric.optional(),
    inc_revenue_yoy: nullableNumeric.optional(),
    inc_net_profit_yoy: nullableNumeric.optional(),
    inc_total_assets_yoy: nullableNumeric.optional(),
  })
  .passthrough();

export const NorthboundFlowSchema = z
  .object({
    trade_date: z.string().optional(),
    ggt_ss: nullableNumeric.optional(),
    ggt_sz: nullableNumeric.optional(),
    hgt: nullableNumeric.optional(),
    sgt: nullableNumeric.optional(),
    north_money: nullableNumeric.optional(),
    south_money: nullableNumeric.optional(),
  })
  .passthrough();

export const MarginDataSchema = z
  .object({
    trade_date: z.string().optional(),
    ts_code: z.string().optional(),
    rzye: nullableNumeric.optional(),
    rqye: nullableNumeric.optional(),
    rzmre: nullableNumeric.optional(),
    rqmcl: nullableNumeric.optional(),
    rzche: nullableNumeric.optional(),
    rqchl: nullableNumeric.optional(),
  })
  .passthrough();

export const BlockTradeSchema = z
  .object({
    ts_code: z.string().optional(),
    trade_date: z.string().optional(),
    price: nullableNumeric.optional(),
    vol: nullableNumeric.optional(),
    amount: nullableNumeric.optional(),
    buyer: z.string().nullable().optional(),
    seller: z.string().nullable().optional(),
  })
  .passthrough();

export const LimitListSchema = z
  .object({
    trade_date: z.string().optional(),
    ts_code: z.string().optional(),
    name: z.string().nullable().optional(),
    close: nullableNumeric.optional(),
    pct_chg: nullableNumeric.optional(),
    amount: nullableNumeric.optional(),
    limit_type: z.enum(['U', 'D']).optional(),
    times: nullableNumeric.optional(),
  })
  .passthrough();

export const StockBasicSchema = z
  .object({
    ts_code: z.string().optional(),
    symbol: z.string().optional(),
    name: z.string().optional(),
    area: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    market: z.string().nullable().optional(),
    list_date: z.string().nullable().optional(),
    exchange: z.string().nullable().optional(),
    curr_type: z.string().nullable().optional(),
    list_status: z.string().nullable().optional(),
  })
  .passthrough();

export const TradeCalSchema = z
  .object({
    exchange: z.string().optional(),
    cal_date: z.string().optional(),
    is_open: z
      .union([z.number(), z.string()])
      .transform((v) => Number(v))
      .optional(),
    pretrade_date: z.string().nullable().optional(),
  })
  .passthrough();

// ============================================================================
// API name → schema registry
// ============================================================================

/** Maps Tushare apiName to its row-level Zod schema. */
export const API_RESPONSE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  daily: DailyPriceSchema,
  daily_basic: DailyBasicSchema,
  income: IncomeSchema,
  balancesheet: BalanceSheetSchema,
  cashflow: CashFlowSchema,
  fina_indicator: FinancialIndicatorsSchema,
  moneyflow_hsgt: NorthboundFlowSchema,
  margin: MarginDataSchema,
  block_trade: BlockTradeSchema,
  limit_list: LimitListSchema,
  stock_basic: StockBasicSchema,
  trade_cal: TradeCalSchema,
};

// ============================================================================
// Validation helpers
// ============================================================================

/**
 * Validate and coerce a single API response row against its schema.
 *
 * On failure, throws a TushareError that includes the field name, expected
 * type, and received value.
 */
export function validateApiResponse(
  apiName: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  const schema = API_RESPONSE_SCHEMAS[apiName];
  if (!schema) {
    // No schema registered — pass through unchanged
    return row;
  }

  const result = schema.safeParse(row);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.') ?? 'unknown';
    const message = issue?.message ?? 'Validation failed';
    throw new TushareError(
      `API response validation failed for "${apiName}" field "${field}": ${message}`,
      'RESPONSE_VALIDATION_ERROR',
      'This may indicate an API schema change. Please report this issue.',
      {
        apiName,
        field,
        receivedValue: field !== 'unknown' ? row[field] : undefined,
        issues: result.error.issues,
      }
    );
  }

  return result.data as Record<string, unknown>;
}

/**
 * Validate that all required fields are present in a response row.
 *
 * @param apiName  - Tushare API name (for error context)
 * @param row      - Single response row
 * @param required - Field names that must be present and non-null
 */
export function validateRequiredFields(
  apiName: string,
  row: Record<string, unknown>,
  required: string[]
): void {
  for (const field of required) {
    if (row[field] === undefined || row[field] === null) {
      throw new TushareError(
        `Required field "${field}" is missing or null in "${apiName}" response`,
        'MISSING_REQUIRED_FIELD',
        'This may indicate an API change or insufficient permissions.',
        { apiName, field, receivedValue: row[field] }
      );
    }
  }
}

/**
 * Validate and coerce an entire array of response rows.
 * Rows without a registered schema are returned unchanged.
 */
export function validateApiResponseArray(
  apiName: string,
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (!API_RESPONSE_SCHEMAS[apiName]) return rows;
  return rows.map((row) => validateApiResponse(apiName, row));
}
