/**
 * Eastmoney Stock Simulator Trading Tool (mx-stock-simulator)
 * Supports position queries, buy/sell, cancel orders, order history, and balance queries.
 */

import { makeEastmoneyRequest, isSuccessResponse, saveResultToFile, formatCurrency } from './client.js';

export type TradeType = 'buy' | 'sell';
export type CancelType = 'order' | 'all';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Position {
  secCode?: string;
  secName?: string;
  count?: number;
  availCount?: number;
  price?: number;
  priceDec?: number;
  costPrice?: number;
  costPriceDec?: number;
  value?: number;
  dayProfit?: number;
  profit?: number;
}

interface Order {
  id?: string;
  secCode?: string;
  secName?: string;
  drt?: number;
  price?: number;
  priceDec?: number;
  count?: number;
  status?: number;
  time?: number;
}

interface PositionsData {
  totalAssets?: number;
  totalProfit?: number;
  currencyUnit?: number;
  posList?: Position[];
}

interface BalanceData {
  totalAssets?: number;
  availBalance?: number;
  frozenMoney?: number;
  totalPosValue?: number;
  totalPosPct?: number;
  currencyUnit?: number;
}

interface OrdersData {
  currencyUnit?: number;
  orders?: Order[];
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function queryPositions(): Promise<{
  success: boolean;
  data?: PositionsData;
  summary?: string;
  error?: string;
}> {
  const response = await makeEastmoneyRequest<PositionsData>('/api/claw/mockTrading/positions', {});

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  const data = response.data as PositionsData | undefined;
  if (!data) return { success: false, error: 'No data returned from API' };

  const summary = formatPositionsOutput(data);
  saveResultToFile('mx_stock_simulator', '持仓查询', summary, 'txt');
  saveResultToFile('mx_stock_simulator', '持仓查询', response, 'json');

  return { success: true, data, summary };
}

export async function executeTrade(params: {
  type: TradeType;
  stockCode: string;
  price?: number;
  quantity: number;
  useMarketPrice?: boolean;
}): Promise<{ success: boolean; data?: unknown; message?: string; error?: string }> {
  const { type, stockCode, price, quantity, useMarketPrice = false } = params;

  const payload: Record<string, unknown> = { type, stockCode, quantity, useMarketPrice };
  if (!useMarketPrice && price != null) payload.price = price;

  const response = await makeEastmoneyRequest('/api/claw/mockTrading/trade', payload);

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'Trade failed' };
  }

  return {
    success: true,
    data: response.data,
    message: `${type === 'buy' ? '买入' : '卖出'} ${stockCode} ${quantity}股 委托已提交`,
  };
}

export async function cancelOrder(params: {
  type: CancelType;
  orderId?: string;
  stockCode?: string;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { type, orderId, stockCode } = params;

  if (type === 'order' && (!orderId || !stockCode)) {
    return { success: false, error: 'orderId and stockCode are required when type is "order"' };
  }

  const payload: Record<string, unknown> = { type };
  if (type === 'order') {
    payload.orderId = orderId;
    payload.stockCode = stockCode;
  }

  const response = await makeEastmoneyRequest('/api/claw/mockTrading/cancel', payload);

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'Cancel failed' };
  }

  return { success: true, data: response.data };
}

export async function queryOrders(params?: {
  fltOrderDrt?: number;
  fltOrderStatus?: number;
}): Promise<{ success: boolean; data?: OrdersData; summary?: string; error?: string }> {
  const response = await makeEastmoneyRequest<OrdersData>('/api/claw/mockTrading/orders', {
    fltOrderDrt: params?.fltOrderDrt ?? 0,
    fltOrderStatus: params?.fltOrderStatus ?? 0,
  });

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  const data = response.data as OrdersData | undefined;
  if (!data) return { success: false, error: 'No data returned from API' };

  const summary = formatOrdersOutput(data);
  saveResultToFile('mx_stock_simulator', '委托查询', summary, 'txt');
  saveResultToFile('mx_stock_simulator', '委托查询', response, 'json');

  return { success: true, data, summary };
}

export async function queryBalance(): Promise<{
  success: boolean;
  data?: BalanceData;
  summary?: string;
  error?: string;
}> {
  const response = await makeEastmoneyRequest<BalanceData>('/api/claw/mockTrading/balance', {});

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  const data = response.data as BalanceData | undefined;
  if (!data) return { success: false, error: 'No data returned from API' };

  const summary = formatBalanceOutput(data);
  saveResultToFile('mx_stock_simulator', '资金查询', summary, 'txt');
  saveResultToFile('mx_stock_simulator', '资金查询', response, 'json');

  return { success: true, data, summary };
}

// ── Formatters ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, string> = {
  1: '未报', 2: '已报', 3: '部成', 4: '已成',
  5: '部成待撤', 6: '已报待撤', 7: '部撤', 8: '已撤',
  9: '废单', 10: '撤单失败',
};

const DIR_MAP: Record<number, string> = { 1: '买入', 2: '卖出' };

function formatPositionsOutput(data: PositionsData): string {
  const unit = data.currencyUnit ?? 1000;
  const positions = data.posList ?? [];
  const lines = ['📊 当前持仓', '='.repeat(120)];

  if (!positions.length) {
    lines.push('暂无持仓');
  } else {
    lines.push(
      ['股票代码'.padEnd(10), '股票名称'.padEnd(10), '持仓(股)'.padEnd(10),
       '可用(股)'.padEnd(10), '现价(元)'.padEnd(10), '成本(元)'.padEnd(10),
       '市值(元)'.padEnd(12), '当日盈亏'.padEnd(12), '持仓盈亏'].join(' | ')
    );
    lines.push('-'.repeat(120));

    for (const p of positions) {
      const pDec = Math.pow(10, p.priceDec ?? 2);
      const cDec = Math.pow(10, p.costPriceDec ?? 2);
      lines.push(
        [
          String(p.secCode ?? '-').padEnd(10),
          String(p.secName ?? '-').padEnd(10),
          String(p.count ?? 0).padEnd(10),
          String(p.availCount ?? 0).padEnd(10),
          ((p.price ?? 0) / pDec).toFixed(2).padEnd(10),
          ((p.costPrice ?? 0) / cDec).toFixed(2).padEnd(10),
          formatCurrency(p.value, unit).padEnd(12),
          formatCurrency(p.dayProfit, unit).padEnd(12),
          formatCurrency(p.profit, unit),
        ].join(' | ')
      );
    }
    lines.push('-'.repeat(120));
  }

  if (data.totalAssets) lines.push(`总资产: ${formatCurrency(data.totalAssets, unit)} 元`);
  if (data.totalProfit != null) lines.push(`总盈亏: ${formatCurrency(data.totalProfit, unit)} 元`);
  lines.push(`共 ${positions.length} 只持仓股票`);
  return lines.join('\n');
}

function formatBalanceOutput(data: BalanceData): string {
  const unit = data.currencyUnit ?? 1000;
  return [
    '📊 账户资金信息',
    '='.repeat(60),
    `总资产:   ${formatCurrency(data.totalAssets, unit)} 元`,
    `可用资金: ${formatCurrency(data.availBalance, unit)} 元`,
    `冻结资金: ${formatCurrency(data.frozenMoney, unit)} 元`,
    `持仓市值: ${formatCurrency(data.totalPosValue, unit)} 元`,
    `仓位比例: ${data.totalPosPct ?? '-'}%`,
    '='.repeat(60),
  ].join('\n');
}

function formatOrdersOutput(data: OrdersData): string {
  const orders = data.orders ?? [];
  const lines = ['📋 委托记录', '='.repeat(100)];

  if (!orders.length) {
    lines.push('暂无委托记录');
  } else {
    lines.push(
      ['订单ID'.padEnd(14), '方向'.padEnd(4), '股票'.padEnd(6),
       '名称'.padEnd(8), '价格'.padEnd(8), '数量'.padEnd(8), '状态'.padEnd(6), '委托时间'].join(' | ')
    );
    lines.push('-'.repeat(100));

    for (const o of orders) {
      const pDec = Math.pow(10, o.priceDec ?? 2);
      const time = o.time
        ? new Date(o.time * 1000).toISOString().replace('T', ' ').substring(0, 19)
        : '-';
      lines.push(
        [
          String(o.id ?? '').padEnd(14),
          (DIR_MAP[o.drt ?? 0] ?? '-').padEnd(4),
          String(o.secCode ?? '').padEnd(6),
          String(o.secName ?? '').padEnd(8),
          ((o.price ?? 0) / pDec).toFixed(2).padEnd(8),
          String(o.count ?? 0).padEnd(8),
          (STATUS_MAP[o.status ?? 0] ?? '-').padEnd(6),
          time,
        ].join(' | ')
      );
    }
  }

  lines.push(`共 ${orders.length} 条委托记录`);
  return lines.join('\n');
}
