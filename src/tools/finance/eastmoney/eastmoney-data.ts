/**
 * Eastmoney Financial Data Tool (mx-data)
 * Queries structured market / fundamental data via Eastmoney's query API.
 */

import { makeEastmoneyRequest, isSuccessResponse, saveResultToFile } from './client.js';

export interface DataTableDTO {
  code: string;
  entityName: string;
  title: string;
  table?: Record<string, unknown>;
  nameMap?: Record<string, string>;
  indicatorOrder?: string[];
  field?: Record<string, unknown>;
  fieldSet?: Array<Record<string, unknown>>;
}

interface QueryApiResponse {
  data?: {
    searchDataResultDTO?: {
      dataTableDTOList?: DataTableDTO[];
    };
  };
}

export async function queryEastmoneyFinancialData(toolQuery: string): Promise<{
  success: boolean;
  data?: DataTableDTO[];
  summary?: string;
  error?: string;
}> {
  const response = await makeEastmoneyRequest<QueryApiResponse>('/api/claw/query', { toolQuery });

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  const dataTableDTOList =
    (response.data as QueryApiResponse)?.data?.searchDataResultDTO?.dataTableDTOList ?? [];

  if (dataTableDTOList.length === 0) {
    return { success: false, error: '暂无数据，请到东方财富妙想AI查询' };
  }

  const summary = formatDataOutput(dataTableDTOList);
  saveResultToFile('mx_data', toolQuery, summary, 'txt');
  saveResultToFile('mx_data', toolQuery, dataTableDTOList, 'json');

  return { success: true, data: dataTableDTOList, summary };
}

function formatDataOutput(tables: DataTableDTO[]): string {
  const lines: string[] = ['📊 东方财富金融数据查询结果', '='.repeat(80)];

  for (const t of tables) {
    lines.push(`\n【${t.title ?? '数据表'}】`);
    lines.push(`代码: ${t.code}  名称: ${t.entityName}`);
    lines.push('-'.repeat(80));

    if (t.table && t.nameMap && t.indicatorOrder) {
      const headLabel = t.nameMap['headNameSub'] ?? '时间';
      const cols = t.indicatorOrder.map((k) => t.nameMap![k] ?? k);
      lines.push([headLabel, ...cols].join(' | '));
      lines.push('-'.repeat(80));

      const headNames = (t.table['headName'] as unknown[]) ?? [];
      for (let i = 0; i < headNames.length; i++) {
        const row: string[] = [String(headNames[i])];
        for (const indicator of t.indicatorOrder) {
          const col = t.table[indicator] as unknown[] | undefined;
          row.push(col ? String(col[i] ?? '-') : '-');
        }
        lines.push(row.join(' | '));
      }
    }
  }

  lines.push('\n' + '='.repeat(80));
  return lines.join('\n');
}
