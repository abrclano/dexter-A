/**
 * Price tools: get_cn_stock_basic
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

const [getCnStockBasic] = factory.createTools(
  TOOL_CONFIGS.filter((c) => c.name === 'get_cn_stock_basic')
) as [DynamicStructuredTool];

export { getCnStockBasic };
