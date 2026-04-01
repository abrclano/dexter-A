/**
 * Eastmoney Intelligent Stock Selection Tool (mx-select-stock)
 * Filters stocks based on natural language criteria.
 */

import { makeEastmoneyRequest, isSuccessResponse, saveResultToFile } from './client.js';

interface Column {
  key?: string;
  field?: string;
  title?: string;
  displayName?: string;
  dateMsg?: string;
}

interface SelectStockInner {
  securityCount?: number;
  partialResults?: string;
  /** May be a plain string like "条件A 且 条件B" */
  totalCondition?: string | { describe?: string };
  parserText?: string;
  /** Some API versions return structured data instead of partialResults */
  result?: {
    total?: number;
    columns?: Column[];
    dataList?: Array<Record<string, unknown>>;
  };
}

interface SelectStockApiResponse {
  data?: {
    data?: SelectStockInner;
  };
}

export async function querySelectStock(
  keyword: string,
  pageNo = 1,
  pageSize = 20
): Promise<{
  success: boolean;
  rows?: Array<Record<string, string>>;
  total?: number;
  summary?: string;
  error?: string;
}> {
  const response = await makeEastmoneyRequest<SelectStockApiResponse>('/api/claw/stock-screen', {
    keyword,
    pageNo,
    pageSize,
  });

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  // Response shape: { status:0, data: { data: { securityCount, partialResults, ... } } }
  const inner = (response.data as SelectStockApiResponse['data'])?.data;
  if (!inner) {
    return { success: false, error: 'Invalid API response structure' };
  }

  const total = inner.securityCount ?? inner.result?.total ?? 0;

  let rows: Array<Record<string, string>>;

  if (inner.result?.dataList?.length) {
    const columns = inner.result.columns ?? [];
    const colMap = buildColumnMap(columns);
    const colOrder = columns.map((c) => c.key ?? c.field ?? '').filter(Boolean);
    rows = inner.result.dataList.map((row) => toStringRow(row, colMap, colOrder));
  } else if (inner.partialResults) {
    rows = parseMarkdownTable(inner.partialResults);
  } else {
    return { success: false, error: '未找到符合条件的股票，请到东方财富妙想AI查询' };
  }

  if (!rows.length) {
    return { success: false, error: '未找到符合条件的股票，请到东方财富妙想AI查询' };
  }

  const parserText =
    typeof inner.totalCondition === 'string'
      ? inner.totalCondition
      : (inner.totalCondition as { describe?: string } | undefined)?.describe ?? inner.parserText;

  const summary = formatOutput(rows, keyword, total, parserText);
  saveResultToFile('mx_select_stock', keyword, summary, 'txt');
  saveResultToFile('mx_select_stock', keyword, inner, 'json');

  return { success: true, rows, total, summary };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildColumnMap(columns: Column[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const col of columns) {
    const key = col.key ?? col.field ?? '';
    const name = col.displayName ?? col.title ?? key;
    if (key) map[key] = col.dateMsg ? `${name} ${col.dateMsg}` : name;
  }
  return map;
}

function toStringRow(
  row: Record<string, unknown>,
  colMap: Record<string, string>,
  colOrder: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of colOrder) {
    if (!(key in row)) continue;
    const val = row[key];
    result[colMap[key] ?? key] =
      val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
  }
  return result;
}

/** Parse a Markdown pipe table into row objects keyed by header name */
function parseMarkdownTable(markdown: string): Array<Record<string, string>> {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return [];

  const splitCells = (line: string) =>
    line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);

  const headers = splitCells(lines[0]);
  if (!headers.length) return [];

  let dataStart = 1;
  if (dataStart < lines.length && /^[\s|:-]+$/.test(lines[dataStart])) {
    dataStart = 2;
  }

  return lines.slice(dataStart).map((line) => {
    let cells = splitCells(line);
    while (cells.length < headers.length) cells.push('');
    cells = cells.slice(0, headers.length);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}

function formatOutput(
  rows: Array<Record<string, string>>,
  keyword: string,
  total: number,
  parserText?: string
): string {
  const lines = ['🔍 智能选股结果', '='.repeat(100), `查询: ${keyword}`, `符合条件: ${total} 只`];
  if (parserText) lines.push(`条件解析: ${parserText}`);
  lines.push('');

  const headers = Object.keys(rows[0]);
  const maxCols = Math.min(headers.length, 8);
  lines.push(headers.slice(0, maxCols).join(' | '));
  lines.push('-'.repeat(100));

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    lines.push(
      headers.slice(0, maxCols).map((h) => (rows[i][h] ?? '').substring(0, 20)).join(' | ')
    );
  }

  if (rows.length > 20) lines.push(`... (共 ${rows.length} 行，仅显示前20行)`);
  lines.push('='.repeat(100));
  return lines.join('\n');
}
