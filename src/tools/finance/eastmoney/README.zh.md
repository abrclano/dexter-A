# 东方财富妙想（EastMoney MX）模块

[English](./README.md) | [中文](./README.zh.md)

本模块将[东方财富妙想（EastMoney MX）](https://marketing.dfcfs.com/views/finskillshub/)——东方财富机构级金融数据平台——集成为一组 LangChain 工具，供 Dexter 调用。

## 配置

在 `.env` 中添加 API Key：

```
MX_APIKEY=your-eastmoney-mx-api-key
```

`MX_APIKEY` 存在时，五个工具将自动启用。

可选：覆盖默认接口地址（默认为 `https://mkapi2.dfcfs.com/finskillshub`）：

```
MX_API_URL=https://your-custom-endpoint
```

## 工具说明

### `eastmoney_mx_data`

查询 A 股结构化行情与基本面数据。

- 实时价格、市盈率、市净率、市值、换手率
- 营收、净利润、资产、负债
- 股东结构、高管信息
- 行业及指数数据

```
"贵州茅台最新价"
"宁德时代市盈率和市净率"
"BYD主要股东结构"
```

### `eastmoney_mx_search`

搜索金融新闻、公司公告和研究报告。

- 实时市场新闻与公司公告
- 分析师研报及评级
- 政策法规与宏观解读

```
"立讯精密最新研报"
"A股今日大跌原因"
"新能源汽车行业政策"
```

### `eastmoney_mx_select_stock`

通过自然语言条件筛选 A 股、基金和 ETF，支持分页。

```
"市盈率低于20的半导体股票"
"今日涨幅超2%的股票"
"股息率大于3%的蓝筹股"
```

| 参数         | 类型   | 默认值 | 说明                     |
|--------------|--------|--------|--------------------------|
| `keyword`    | string | —      | 自然语言筛选条件         |
| `pageNo`     | number | 1      | 页码                     |
| `pageSize`   | number | 20     | 每页数量（最大 100）     |

### `eastmoney_mx_selfselect`

管理东方财富账户的个人自选股列表。

| 操作     | 说明                   |
|----------|------------------------|
| `query`  | 查看自选股列表         |
| `add`    | 按名称或代码添加自选股 |
| `remove` | 按名称或代码删除自选股 |

```
"查看我的自选股"
"把贵州茅台加入自选"
"删除宁德时代自选"
```

### `eastmoney_mx_stock_simulator`

A 股模拟交易，使用虚拟资金，不涉及真实资产。

| 操作        | 说明                           |
|-------------|--------------------------------|
| `positions` | 查询当前持仓                   |
| `balance`   | 查看可用资金和总资产           |
| `orders`    | 查看委托记录（支持筛选）       |
| `trade`     | 限价或市价买入/卖出            |
| `cancel`    | 撤销指定委托或全部委托         |

```
"买入100股贵州茅台，限价500元"
"查询我的持仓"
"撤销所有委托"
"账户余额"
```

## 输出

查询结果以 `.json` 和 `.txt` 两种格式保存至 `.dexter/mx_data/`，便于调试和历史追踪。

## 文件结构

```
src/tools/finance/eastmoney/
├── client.ts                    # HTTP 客户端、文件保存、响应工具函数
├── eastmoney-data.ts            # mx-data：结构化金融数据
├── eastmoney-search.ts          # mx-search：新闻与研报搜索
├── eastmoney-select-stock.ts    # mx-select-stock：选股筛选
├── eastmoney-selfselect.ts      # mx-selfselect：自选股管理
├── eastmoney-stock-simulator.ts # mx-stock-simulator：模拟交易
├── index.ts                     # 公共导出
└── tools/
    └── router.ts                # LangChain 工具定义与描述
```
