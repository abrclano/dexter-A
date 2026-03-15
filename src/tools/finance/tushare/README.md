# Tushare Module

A股市场数据集成模块，基于 [Tushare Pro](https://tushare.pro) API，为 Dexter agent 提供 `cn_market_search` 工具。

## 目录结构

```
tushare/
├── core/           # 核心基础设施（API 客户端、缓存、错误处理、工厂、指标）
├── config/         # 工具配置（tools.config.ts）
├── tools/          # 各类工具实现
│   ├── price/      # 价格数据（日线、估值指标）
│   ├── fundamentals/ # 财务报表（利润表、资产负债表、现金流、财务指标）
│   ├── market/     # 市场数据（北向资金、融资融券、大宗交易、涨跌停）
│   ├── reference/  # 参考数据（股票列表、交易日历）
│   └── router.ts   # cn_market_search 路由工具
├── types/          # TypeScript 类型定义
├── utils/          # 工具函数（日期、验证、格式化）
├── scripts/        # 辅助脚本
└── __tests__/      # 测试与 fixtures
```

## 快速开始

在 `.env` 中设置 API key：

```
TUSHARE_API_KEY=your-tushare-api-key
```

启动 Dexter 后，agent 会自动注册 `cn_market_search` 工具，可以直接用自然语言查询：

```
贵州茅台最近的股价是多少？
分析宁德时代过去三年的财务状况
北向资金最近一周的流入情况
```

## 运行测试

```bash
# 运行所有测试（无需 API key，使用内置 fixtures）
bun test src/tools/finance/tushare

# 运行单个测试文件
bun test src/tools/finance/tushare/__tests__/core.test.ts
```

### 生成真实 API fixtures

测试默认使用内置的 stub fixtures，无需网络请求。如果需要用真实 API 数据更新 fixtures：

```bash
TUSHARE_API_KEY=your-key bun run src/tools/finance/tushare/scripts/generate-fixtures.ts
```

生成的文件保存在 `__tests__/fixtures/raw/`，会被 `__tests__/fixtures.ts` 自动加载。

## 新增接口字段

### 场景一：给现有工具增加字段

以给 `get_cn_stock_price` 增加 `turnover_rate`（换手率）为例：

**1. 在 `config/tools.config.ts` 的对应配置里添加字段名：**

```typescript
{
  name: 'get_cn_stock_price',
  fields: [
    'ts_code', 'trade_date', 'open', 'high', 'low', 'close',
    'pre_close', 'change', 'pct_chg', 'vol', 'amount',
    'turnover_rate',  // 新增
  ],
  // ...其余配置不变
}
```

**2. 在 `types/price.ts` 的对应接口里添加类型：**

```typescript
interface DailyPrice {
  // ...已有字段
  turnover_rate?: number;  // 换手率（%）
}
```

完成。工厂会自动将新字段包含在 API 请求和响应中。

### 场景二：新增一个完整工具

以新增 `get_cn_stock_holder`（十大股东）为例：

**1. 在 `config/tools.config.ts` 的 `TOOL_CONFIGS` 数组中添加配置：**

```typescript
{
  name: 'get_cn_stock_holder',
  description: `获取A股上市公司十大股东信息。

When to Use:
- 查询主要股东持股比例
- 分析股权结构变化

When NOT to Use:
- 实时持仓数据（Tushare 仅提供定期披露数据）

Example:
- ts_code: "600519.SH"
- period: "20231231"`,
  apiName: 'top10_holders',
  fields: ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio'],
  cacheStrategy: CacheStrategy.FINANCIAL,
  validate: (input: any) => {
    validateStockCode(input.ts_code);
    if (input.period) validateDate(input.period);
  },
},
```

**2. 在 `types/` 下添加对应类型（可选，放入已有文件或新建）：**

```typescript
// types/reference.ts
interface StockHolder {
  ts_code: TsCode;
  ann_date: DateYYYYMMDD;
  end_date: DateYYYYMMDD;
  holder_name: string;
  hold_amount: number;
  hold_ratio: number;
}
```

**3. 在 `tools/reference/index.ts` 中导出新工具：**

```typescript
import { factory } from '../../core/factory.js';
import { TOOL_CONFIGS } from '../../config/tools.config.js';

const holderConfig = TOOL_CONFIGS.find(c => c.name === 'get_cn_stock_holder')!;
export const getCnStockHolder = factory.createTool(holderConfig);
```

**4. 在 `index.ts` 中导出：**

```typescript
export { getCnStockHolder } from './tools/reference/index.js';
```

**5. 在 `scripts/generate-fixtures.ts` 的 `fixtures` 数组中添加对应条目：**

```typescript
{
  filename: 'top10_holders.json',
  apiName: 'top10_holders',
  params: { ts_code: SAMPLE_STOCK, period: '20231231' },
  fields: ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio'],
},
```

This ensures `bun run src/tools/finance/tushare/scripts/generate-fixtures.ts` regenerates a real API fixture for the new endpoint alongside all existing ones.

工具会在下次启动时自动被 `cn_market_search` 路由器识别并使用。

## 缓存策略

| 策略 | TTL | 适用场景 |
|------|-----|---------|
| `HISTORICAL` | 永久（历史日期）/ 5分钟（当日） | 历史价格、历史财报 |
| `CURRENT_DAY` | 5 分钟 | 当日行情、估值指标 |
| `FINANCIAL` | 24 小时 | 财务报表、财务指标 |
| `REFERENCE` | 7 天 | 股票列表、交易日历 |
| `NO_CACHE` | 不缓存 | 实时性要求极高的数据 |

## 股票代码格式

| 市场 | 格式 | 示例 |
|------|------|------|
| 上交所 | `XXXXXX.SH` | `600519.SH` |
| 深交所 | `XXXXXX.SZ` | `000858.SZ` |
| 北交所 | `XXXXXX.BJ` | `430047.BJ` |

日期格式统一使用 `YYYYMMDD`，例如 `20240115`。
