# EastMoney MX Module

[English](./README.md) | [中文](./README.zh.md)

This module integrates [EastMoney MX (妙想)](https://marketing.dfcfs.com/views/finskillshub/) — East Money's institutional-grade financial data platform — into Dexter as a set of LangChain tools.

## Setup

Add your API key to `.env`:

```
MX_APIKEY=your-eastmoney-mx-api-key
```

All five tools are automatically enabled when `MX_APIKEY` is present.

Optionally override the base URL (defaults to `https://mkapi2.dfcfs.com/finskillshub`):

```
MX_API_URL=https://your-custom-endpoint
```

## Tools

### `eastmoney_mx_data`

Query structured market and fundamental data for Chinese A-shares.

- Real-time prices, PE/PB ratios, market cap, turnover rate
- Revenue, net profit, assets, liabilities
- Shareholder structure, executive information
- Sector and index data

```
"贵州茅台最新价"
"宁德时代市盈率和市净率"
"BYD主要股东结构"
```

### `eastmoney_mx_search`

Search financial news, company announcements, and research reports.

- Real-time market news and company disclosures
- Analyst research reports with ratings
- Government policy and regulatory updates

```
"立讯精密最新研报"
"A股今日大跌原因"
"新能源汽车行业政策"
```

### `eastmoney_mx_select_stock`

Screen A-shares, funds, and ETFs using natural language criteria. Supports pagination.

```
"市盈率低于20的半导体股票"
"今日涨幅超2%的股票"
"股息率大于3%的蓝筹股"
```

| Parameter  | Type   | Default | Description                  |
|------------|--------|---------|------------------------------|
| `keyword`  | string | —       | Natural language filter      |
| `pageNo`   | number | 1       | Page number                  |
| `pageSize` | number | 20      | Results per page (max 100)   |

### `eastmoney_mx_selfselect`

Manage your personal EastMoney watchlist.

| Action   | Description                        |
|----------|------------------------------------|
| `query`  | List all stocks in your watchlist  |
| `add`    | Add a stock by name or code        |
| `remove` | Remove a stock by name or code     |

```
"查看我的自选股"
"把贵州茅台加入自选"
"删除宁德时代自选"
```

### `eastmoney_mx_stock_simulator`

Simulated A-share trading with virtual capital — no real funds involved.

| Action      | Description                              |
|-------------|------------------------------------------|
| `positions` | Query current holdings                   |
| `balance`   | Check available funds and total assets   |
| `orders`    | View order history (filterable)          |
| `trade`     | Buy or sell with limit or market price   |
| `cancel`    | Cancel a specific order or all pending   |

```
"买入100股贵州茅台，限价500元"
"查询我的持仓"
"撤销所有委托"
"账户余额"
```

## Output

Results are saved to `.dexter/mx_data/` as both `.json` and `.txt` files for debugging and history.

## File Structure

```
src/tools/finance/eastmoney/
├── client.ts                    # HTTP client, file saving, response helpers
├── eastmoney-data.ts            # mx-data: structured financial data
├── eastmoney-search.ts          # mx-search: news and research reports
├── eastmoney-select-stock.ts    # mx-select-stock: stock screening
├── eastmoney-selfselect.ts      # mx-selfselect: watchlist management
├── eastmoney-stock-simulator.ts # mx-stock-simulator: simulated trading
├── index.ts                     # Public exports
└── tools/
    └── router.ts                # LangChain tool definitions and descriptions
```
