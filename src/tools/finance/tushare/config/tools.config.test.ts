import { describe, test, expect } from 'bun:test';
import { TOOL_CONFIGS, API_CONFIG, CACHE_CONFIG } from './tools.config.js';
import { CacheStrategy } from '../types/api.js';

describe('Tool Configurations', () => {
  describe('API_CONFIG', () => {
    test('should have correct structure', () => {
      expect(API_CONFIG.baseUrl).toBe('https://api.tushare.pro');
      expect(API_CONFIG.timeout).toBe(30000);
      expect(API_CONFIG.maxRetries).toBe(3);
      expect(API_CONFIG.maxConcurrent).toBe(5);
      expect(API_CONFIG.retryDelay.base).toBe(1000);
      expect(API_CONFIG.retryDelay.multiplier).toBe(2);
      expect(API_CONFIG.retryDelay.max).toBe(10000);
    });
  });

  describe('CACHE_CONFIG', () => {
    test('should have correct structure', () => {
      expect(CACHE_CONFIG.maxSize).toBe(100 * 1024 * 1024);
      expect(CACHE_CONFIG.strategies[CacheStrategy.HISTORICAL]).toBe(Infinity);
      expect(CACHE_CONFIG.strategies[CacheStrategy.CURRENT_DAY]).toBe(5 * 60 * 1000);
      expect(CACHE_CONFIG.strategies[CacheStrategy.FINANCIAL]).toBe(24 * 60 * 60 * 1000);
      expect(CACHE_CONFIG.strategies[CacheStrategy.REFERENCE]).toBe(7 * 24 * 60 * 60 * 1000);
      expect(CACHE_CONFIG.strategies[CacheStrategy.NO_CACHE]).toBe(0);
    });
  });

  describe('TOOL_CONFIGS', () => {
    test('should have all expected tools', () => {
      const toolNames = TOOL_CONFIGS.map((config) => config.name);
      
      // Price tools
      expect(toolNames).toContain('get_cn_stock_price');
      expect(toolNames).toContain('get_cn_stock_prices');
      expect(toolNames).toContain('get_cn_stock_basic');
      
      // Fundamental tools
      expect(toolNames).toContain('get_cn_income');
      expect(toolNames).toContain('get_cn_balance');
      expect(toolNames).toContain('get_cn_cashflow');
      expect(toolNames).toContain('get_cn_indicators');
      
      // Market data tools
      expect(toolNames).toContain('get_cn_northbound_flow');
      expect(toolNames).toContain('get_cn_margin_data');
      expect(toolNames).toContain('get_cn_block_trades');
      expect(toolNames).toContain('get_cn_limit_list');
      
      // Reference data tools
      expect(toolNames).toContain('get_cn_stock_list');
      expect(toolNames).toContain('get_cn_trade_calendar');
    });

    test('all tools should follow naming convention', () => {
      for (const config of TOOL_CONFIGS) {
        expect(config.name).toMatch(/^(get|list|search)_(cn|hk)_[a-z_]+$/);
      }
    });

    test('all tools should have "When to Use" section', () => {
      for (const config of TOOL_CONFIGS) {
        expect(config.description).toContain('When to Use');
      }
    });

    test('all tools should have "When NOT to Use" section', () => {
      for (const config of TOOL_CONFIGS) {
        expect(config.description).toContain('When NOT to Use');
      }
    });

    test('all tools should have examples', () => {
      for (const config of TOOL_CONFIGS) {
        expect(config.description).toContain('Example:');
      }
    });

    test('all tools with ts_code should use correct parameter name', () => {
      for (const config of TOOL_CONFIGS) {
        if (config.parameterNames?.stockCode) {
          expect(config.parameterNames.stockCode).toBe('ts_code');
        }
      }
    });

    test('all tools with date ranges should use correct parameter names', () => {
      for (const config of TOOL_CONFIGS) {
        if (config.parameterNames?.startDate) {
          expect(config.parameterNames.startDate).toBe('start_date');
        }
        if (config.parameterNames?.endDate) {
          expect(config.parameterNames.endDate).toBe('end_date');
        }
      }
    });

    test('all tools should have valid cache strategies', () => {
      const validStrategies = Object.values(CacheStrategy);
      for (const config of TOOL_CONFIGS) {
        expect(validStrategies).toContain(config.cacheStrategy);
      }
    });

    test('all tools should have apiName', () => {
      for (const config of TOOL_CONFIGS) {
        expect(config.apiName).toBeTruthy();
        expect(typeof config.apiName).toBe('string');
      }
    });
  });

  describe('Individual Tool Configurations', () => {
    test('get_cn_stock_price should have correct configuration', () => {
      const config = TOOL_CONFIGS.find((c) => c.name === 'get_cn_stock_price');
      expect(config).toBeDefined();
      expect(config?.apiName).toBe('daily');
      expect(config?.cacheStrategy).toBe(CacheStrategy.CURRENT_DAY);
      expect(config?.returnSingle).toBe(true);
      expect(config?.fields).toContain('ts_code');
      expect(config?.fields).toContain('trade_date');
      expect(config?.fields).toContain('close');
    });

    test('get_cn_stock_prices should have correct configuration', () => {
      const config = TOOL_CONFIGS.find((c) => c.name === 'get_cn_stock_prices');
      expect(config).toBeDefined();
      expect(config?.apiName).toBe('daily');
      expect(config?.cacheStrategy).toBe(CacheStrategy.HISTORICAL);
      expect(config?.returnSingle).toBeUndefined();
    });

    test('get_cn_income should have correct configuration', () => {
      const config = TOOL_CONFIGS.find((c) => c.name === 'get_cn_income');
      expect(config).toBeDefined();
      expect(config?.apiName).toBe('income');
      expect(config?.cacheStrategy).toBe(CacheStrategy.FINANCIAL);
    });

    test('get_cn_stock_list should have correct configuration', () => {
      const config = TOOL_CONFIGS.find((c) => c.name === 'get_cn_stock_list');
      expect(config).toBeDefined();
      expect(config?.apiName).toBe('stock_basic');
      expect(config?.cacheStrategy).toBe(CacheStrategy.REFERENCE);
    });
  });
});
