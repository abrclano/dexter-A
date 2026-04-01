/**
 * Eastmoney Financial News Search Tool (mx-search)
 * Searches financial news, announcements, and research reports.
 */

import { makeEastmoneyRequest, isSuccessResponse, saveResultToFile } from './client.js';

export interface SearchItem {
  title?: string;
  content?: string;
  date?: string;
  insName?: string;
  informationType?: string;
  rating?: string;
  entityFullName?: string;
  [key: string]: unknown;
}

interface NewsApiResponse {
  data?: {
    llmSearchResponse?: {
      data?: SearchItem[];
    };
  };
}

export async function queryEastmoneyNews(query: string): Promise<{
  success: boolean;
  data?: SearchItem[];
  summary?: string;
  error?: string;
}> {
  const response = await makeEastmoneyRequest<NewsApiResponse>('/api/claw/news-search', { query });

  if (!isSuccessResponse(response)) {
    return { success: false, error: response.message || response.msg || 'API error' };
  }

  const items =
    (response.data as NewsApiResponse)?.data?.llmSearchResponse?.data ?? [];

  if (items.length === 0) {
    return { success: false, error: '未找到相关资讯，请到东方财富妙想AI查询' };
  }

  const textContent = formatNewsOutput(items, query);
  saveResultToFile('mx_search', query, textContent, 'txt');
  saveResultToFile('mx_search', query, items, 'json');

  return { success: true, data: items, summary: textContent };
}

const TYPE_MAP: Record<string, string> = {
  REPORT: '研报',
  NEWS: '新闻',
  ANNOUNCEMENT: '公告',
};

function formatNewsOutput(items: SearchItem[], query: string): string {
  const lines = [
    '📰 东方财富金融资讯搜索结果',
    `查询: "${query}"`,
    '='.repeat(80),
    `共找到 ${items.length} 条相关资讯:\n`,
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push(`--- ${i + 1}. ${item.title ?? '无标题'} ---`);

    const meta: string[] = [];
    if (item.entityFullName) meta.push(`证券: ${item.entityFullName}`);
    if (item.insName) meta.push(`机构: ${item.insName}`);
    if (item.date) meta.push(`日期: ${String(item.date).split(' ')[0]}`);
    if (item.informationType) meta.push(`类型: ${TYPE_MAP[item.informationType] ?? item.informationType}`);
    if (item.rating) meta.push(`评级: ${item.rating}`);

    if (meta.length) lines.push(meta.join(' | '));
    if (item.content) lines.push('\n' + item.content);
    lines.push('');
  }

  lines.push('='.repeat(80));
  return lines.join('\n');
}
