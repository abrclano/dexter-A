# Tushare Module

[English](./README.en.md) | [中文](./README.zh.md)

A-share market data integration module powered by the [Tushare Pro](https://tushare.pro) API, providing the `cn_market_search` tool for the Dexter agent.

## Supported APIs

### Price Data

| Tool | Tushare API | Description |
|------|-------------|-------------|
| `get_cn_stock_price` | `daily` | Latest daily OHLCV for a single stock |
| `get_cn_stock_prices` | `daily` | Historical daily OHLCV over a date range |
| `get_cn_stock_basic` | `daily_basic` | Daily valuation metrics (PE, PB, market cap, turnover rate, etc.) |
| `get_cn_stock_week_month_adj` | `stk_week_month_adj` | Weekly/monthly OHLCV with forward/backward adjusted prices |

### Financial Statements

| Tool | Tushare API | Description |
|------|-------------|-------------|
| `get_cn_income` | `income` | Income statement (revenue, profit, EPS, etc.) |
| `get_cn_balance` | `balancesheet` | Balance sheet (assets, liabilities, equity, etc.) |
| `get_cn_cashflow` | `cashflow` | Cash flow statement (operating/investing/financing) |
| `get_cn_indicators` | `fina_indicator` | Financial ratios (ROE, ROA, gross margin, debt ratio, etc.) |

### Market Data

| Tool | Tushare API | Description |
|------|-------------|-------------|
| `get_cn_northbound_flow` | `moneyflow_hsgt` | Northbound capital flow via Hong Kong Stock Connect |
| `get_cn_margin_data` | `margin` | Margin trading data (margin balance, short balance, etc.) |
| `get_cn_block_trades` | `block_trade` | Block trades (large institutional transactions) |
| `get_cn_limit_list` | `limit_list` | Daily limit-up/limit-down list with consecutive count |

### Disclosure & Events

| Tool | Tushare API | Description |
|------|-------------|-------------|
| `get_cn_forecast` | `forecast` | Earnings forecasts (profit increase/decrease/turnaround, etc.) |
| `get_cn_express` | `express` | Earnings express reports (preliminary results before full filing) |

### Reference Data

| Tool | Tushare API | Description |
|------|-------------|-------------|
| `get_cn_stock_list` | `stock_basic` | A-share stock list (code, name, industry, listing date, etc.) |
| `get_cn_trade_calendar` | `trade_cal` | Trading calendar (check if a date is a trading day) |

## Directory Structure

```
tushare/
├── core/           # Core infrastructure (API client, cache, error handling, factory, metrics)
├── config/         # Tool configuration (tools.config.ts)
├── tools/          # Tool implementations
│   ├── price/      # Price data (daily bars, valuation metrics)
│   ├── fundamentals/ # Financial statements (income, balance sheet, cash flow, indicators)
│   ├── market/     # Market data (northbound flow, margin, block trades, limit list)
│   ├── reference/  # Reference data (stock list, trade calendar)
│   └── router.ts   # cn_market_search routing tool
├── types/          # TypeScript type definitions
├── utils/          # Utility functions (date, validation, formatting)
├── scripts/        # Helper scripts
└── __tests__/      # Tests and fixtures
```

## Quick Start

Set your API key in `.env`:

```
TUSHARE_API_KEY=your-tushare-api-key
```

Once Dexter starts, the `cn_market_search` tool is automatically registered. You can query it in natural language:

```
What is the latest price of Kweichow Moutai?
Analyze CATL's financials over the past three years
Show northbound capital flow for the past week
```

## Running Tests

```bash
# Run all tests (no API key needed — uses built-in fixtures)
bun test src/tools/finance/tushare

# Run a single test file
bun test src/tools/finance/tushare/__tests__/core.test.ts
```

### Regenerating API Fixtures

Tests use stub fixtures by default and require no network access. To refresh fixtures with real API data:

```bash
TUSHARE_API_KEY=your-key bun run src/tools/finance/tushare/scripts/generate-fixtures.ts
```

Generated files are saved to `__tests__/fixtures/raw/` and auto-loaded by `__tests__/fixtures.ts`.

## Extension Guide

### Adding a field to an existing tool

To add `turnover_rate` to `get_cn_stock_price`:

**1. Add the field name in `config/tools.config.ts`:**

```typescript
{
  name: 'get_cn_stock_price',
  fields: [
    'ts_code', 'trade_date', 'open', 'high', 'low', 'close',
    'pre_close', 'change', 'pct_chg', 'vol', 'amount',
    'turnover_rate',  // new
  ],
}
```

**2. Add the type in `types/price.ts`:**

```typescript
interface DailyPrice {
  turnover_rate?: number;  // turnover rate (%)
}
```

The factory automatically includes the new field in API requests and responses.

### Adding a new tool

To add `get_cn_stock_holder` (top 10 shareholders):

**1. Add a config entry to `TOOL_CONFIGS` in `config/tools.config.ts`:**

```typescript
{
  name: 'get_cn_stock_holder',
  description: `Fetches top 10 shareholders for a Chinese A-share company. ...`,
  apiName: 'top10_holders',
  fields: ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio'],
  cacheStrategy: CacheStrategy.FINANCIAL,
  validate: (input: any) => {
    validateStockCode(input.ts_code);
    if (input.period) validateDate(input.period);
  },
},
```

**2. Add types under `types/`, export from the relevant `tools/` subdirectory, and re-export from `index.ts`.**

**3. Add a fixture entry in `scripts/generate-fixtures.ts`.**

The tool will be automatically picked up by the `cn_market_search` router on next startup.

## Cache Strategies

| Strategy | TTL | Use Case |
|----------|-----|----------|
| `HISTORICAL` | Permanent (past dates) / 5 min (today) | Historical prices, past financials |
| `CURRENT_DAY` | 5 minutes | Today's quotes, valuation metrics |
| `FINANCIAL` | 24 hours | Financial statements, indicators |
| `REFERENCE` | 7 days | Stock list, trade calendar |
| `NO_CACHE` | No cache | Data requiring maximum freshness |

## Stock Code Format

| Exchange | Format | Example |
|----------|--------|---------|
| Shanghai (SSE) | `XXXXXX.SH` | `600519.SH` |
| Shenzhen (SZSE) | `XXXXXX.SZ` | `000858.SZ` |
| Beijing (BSE) | `XXXXXX.BJ` | `430047.BJ` |

All dates use `YYYYMMDD` format, e.g. `20240115`.
