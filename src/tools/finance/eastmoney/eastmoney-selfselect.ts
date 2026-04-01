/**
 * Eastmoney Self-Selected Stocks Management Tool (mx-selfselect)
 * Query, add, or remove stocks from the user's Eastmoney watchlist.
 */

import { makeEastmoneyRequest, isSuccessResponse, saveResultToFile } from './client.js';

export type SelfSelectAction = 'query' | 'add' | 'remove';

interface SelfSelectStock {
  SECURITY_CODE?: string;
  SECURITY_SHORT_NAME?: string;
  NEWEST_PRICE?: number;
  CHG?: number;
  [key: string]: unknown;
}

// Response shape: { status:0, data: { allResults: { result: { columns, dataList } } } }
interface SelfSelectApiResponse {
  allResults?: {
    result?: {
      columns?: Array<{ key: string; title: string }>;
      dataList?: SelfSelectStock[];
    };
  };
}

export async function manageSelfSelect(
  action: SelfSelectAction,
  stockNameOrCode?: string
): Promise<{
  success: boolean;
  stocks?: SelfSelectStock[];
  message?: string;
  summary?: string;
  error?: string;
}> {
  if (action === 'query') {
    return querySelfSelectList();
  }

  if (!stockNameOrCode) {
    return { success: false, error: 'stockNameOrCode is required for add/remove actions' };
  }

  const query =
    action === 'add'
      ? `把${stockNameOrCode}添加到我的自选股列表`
      : `把${stockNameOrCode}从我的自选股列表删除`;

  const response = await makeEastmoneyRequest('/api/claw/self-select/manage', { query });

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  return {
    success: true,
    message: action === 'add'
      ? `✅ ${stockNameOrCode} 已添加到自选股列表`
      : `✅ ${stockNameOrCode} 已从自选股列表移除`,
  };
}

async function querySelfSelectList(): Promise<{
  success: boolean;
  stocks?: SelfSelectStock[];
  summary?: string;
  error?: string;
}> {
  const response = await makeEastmoneyRequest<SelfSelectApiResponse>(
    '/api/claw/self-select/get',
    {}
  );

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  const result = (response.data as SelfSelectApiResponse)?.allResults?.result;
  const stocks = result?.dataList ?? [];

  if (stocks.length === 0) {
    return { success: false, error: '自选股列表为空，请到东方财富App查询' };
  }

  const summary = formatSelfSelectOutput(stocks);
  saveResultToFile('mx_self_select', '我的自选股列表', summary, 'txt');
  saveResultToFile('mx_self_select', '我的自选股列表', stocks, 'json');

  return { success: true, stocks, summary };
}

function formatSelfSelectOutput(stocks: SelfSelectStock[]): string {
  const lines = [
    '📊 我的自选股列表',
    '='.repeat(60),
    ['股票代码'.padEnd(10), '股票名称'.padEnd(10), '最新价(元)'.padEnd(12), '涨跌幅(%)'].join(' | '),
    '-'.repeat(60),
  ];

  for (const s of stocks) {
    const chg = s.CHG != null ? `${s.CHG > 0 ? '+' : ''}${Number(s.CHG).toFixed(2)}%` : '-';
    lines.push(
      [
        String(s.SECURITY_CODE ?? '-').padEnd(10),
        String(s.SECURITY_SHORT_NAME ?? '-').padEnd(10),
        String(s.NEWEST_PRICE ?? '-').padEnd(12),
        chg,
      ].join(' | ')
    );
  }

  lines.push('-'.repeat(60));
  lines.push(`共 ${stocks.length} 只自选股`);
  return lines.join('\n');
}
