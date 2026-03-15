/**
 * Market data tools: get_cn_northbound_flow, get_cn_margin_data, get_cn_block_trades, get_cn_limit_list
 *
 * Generated via ToolFactory from TOOL_CONFIGS.
 */

import type { DynamicStructuredTool } from '@langchain/core/tools';
import { TushareApiClientImpl } from '../../core/api.js';
import { CacheManager } from '../../core/cache.js';
import { ErrorHandler } from '../../core/error.js';
import { MetricsTrackerImpl } from '../../core/metrics.js';
import { ToolFactory } from '../../core/factory.js';
import { TOOL_CONFIGS } from '../../config/tools.config.js';

const cache = new CacheManager();
const errorHandler = new ErrorHandler();
const metrics = new MetricsTrackerImpl();

function createApiClient(): TushareApiClientImpl {
  const token = process.env['TUSHARE_API_KEY'] ?? '';
  return new TushareApiClientImpl(token, cache, errorHandler, metrics);
}

const factory = new ToolFactory(createApiClient());

const MARKET_NAMES = [
  'get_cn_northbound_flow',
  'get_cn_margin_data',
  'get_cn_block_trades',
  'get_cn_limit_list',
];

const tools = factory.createTools(
  TOOL_CONFIGS.filter((c) => MARKET_NAMES.includes(c.name))
) as [DynamicStructuredTool, DynamicStructuredTool, DynamicStructuredTool, DynamicStructuredTool];

const [getCnNorthboundFlow, getCnMarginData, getCnBlockTrades, getCnLimitList] = tools;

export { getCnNorthboundFlow, getCnMarginData, getCnBlockTrades, getCnLimitList };
