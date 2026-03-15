import { describe, test, expect } from 'bun:test';
import { ToolConfigSchema, validateToolConfig, validateToolConfigs } from './tool-config.js';
import { CacheStrategy } from './api.js';

describe('ToolConfigSchema', () => {
  describe('valid configurations', () => {
    test('accepts minimal valid config', () => {
      const config = {
        name: 'get_cn_stock_price',
        description: 'Fetches stock price. When to Use: for price data. When NOT to Use: for fundamentals. Example: ts_code=600519.SH',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      };

      const result = ToolConfigSchema.parse(config);
      expect(result.name).toBe('get_cn_stock_price');
    });

    test('accepts config with all optional fields', () => {
      const config = {
        name: 'get_cn_stock_prices',
        description: 'Fetches historical prices. When to Use: for time series. When NOT to Use: for single date. Example: ts_code=600519.SH, start_date=20240101',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.HISTORICAL,
        fields: ['ts_code', 'trade_date', 'close'],
        returnSingle: false,
        fieldMappings: { old_name: 'new_name' },
        parameterNames: {
          stockCode: 'ts_code',
          startDate: 'start_date',
          endDate: 'end_date',
        },
      };

      const result = ToolConfigSchema.parse(config);
      expect(result.fields).toEqual(['ts_code', 'trade_date', 'close']);
    });

    test('accepts config with function returnSingle', () => {
      const config = {
        name: 'get_cn_stock_basic',
        description: 'Fetches valuation metrics. When to Use: for PE/PB ratios. When NOT to Use: for price history. Example: ts_code=600519.SH',
        apiName: 'daily_basic',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
        returnSingle: (input: any) => !!input.ts_code,
      };

      const result = ToolConfigSchema.parse(config);
      expect(typeof result.returnSingle).toBe('function');
    });
  });

  describe('naming convention validation', () => {
    test('accepts valid naming patterns', () => {
      const validNames = [
        'get_cn_stock_price',
        'get_hk_daily_price',
        'list_cn_stocks',
        'search_cn_companies',
      ];

      for (const name of validNames) {
        const config = {
          name,
          description: 'Test tool. When to Use: testing. When NOT to Use: production. Example: test=true',
          apiName: 'test',
          cacheStrategy: CacheStrategy.NO_CACHE,
        };

        expect(() => ToolConfigSchema.parse(config)).not.toThrow();
      }
    });

    test('rejects invalid naming patterns', () => {
      const invalidNames = [
        'getCnStockPrice', // camelCase
        'get_stock_price', // missing market
        'cn_stock_price', // missing action
        'get-cn-stock-price', // hyphens instead of underscores
        'GET_CN_STOCK_PRICE', // uppercase
      ];

      for (const name of invalidNames) {
        const config = {
          name,
          description: 'Test tool. When to Use: testing. When NOT to Use: production. Example: test=true',
          apiName: 'test',
          cacheStrategy: CacheStrategy.NO_CACHE,
        };

        expect(() => ToolConfigSchema.parse(config)).toThrow();
      }
    });
  });

  describe('description validation', () => {
    test('rejects description without "When to Use" section', () => {
      const config = {
        name: 'get_cn_stock_price',
        description: 'Fetches stock price. When NOT to Use: for fundamentals. Example: ts_code=600519.SH',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });

    test('rejects description without "When NOT to Use" section', () => {
      const config = {
        name: 'get_cn_stock_price',
        description: 'Fetches stock price. When to Use: for price data. Example: ts_code=600519.SH',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });

    test('rejects description without examples', () => {
      const config = {
        name: 'get_cn_stock_price',
        description: 'Fetches stock price. When to Use: for price data. When NOT to Use: for fundamentals.',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });

    test('rejects description that is too short', () => {
      const config = {
        name: 'get_cn_stock_price',
        description: 'Short',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });
  });

  describe('required fields validation', () => {
    test('rejects config missing name', () => {
      const config = {
        description: 'Test tool. When to Use: testing. When NOT to Use: production. Example: test=true',
        apiName: 'test',
        cacheStrategy: CacheStrategy.NO_CACHE,
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });

    test('rejects config missing description', () => {
      const config = {
        name: 'get_cn_stock_price',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });

    test('rejects config missing apiName', () => {
      const config = {
        name: 'get_cn_stock_price',
        description: 'Test tool. When to Use: testing. When NOT to Use: production. Example: test=true',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });

    test('rejects config missing cacheStrategy', () => {
      const config = {
        name: 'get_cn_stock_price',
        description: 'Test tool. When to Use: testing. When NOT to Use: production. Example: test=true',
        apiName: 'daily',
      };

      expect(() => ToolConfigSchema.parse(config)).toThrow();
    });
  });
});

describe('validateToolConfig', () => {
  test('returns validated config for valid input', () => {
    const config = {
      name: 'get_cn_stock_price',
      description: 'Fetches stock price. When to Use: for price data. When NOT to Use: for fundamentals. Example: ts_code=600519.SH',
      apiName: 'daily',
      cacheStrategy: CacheStrategy.CURRENT_DAY,
    };

    const result = validateToolConfig(config);
    expect(result.name).toBe('get_cn_stock_price');
  });

  test('throws descriptive error for invalid input', () => {
    const config = {
      name: 'invalid-name',
      description: 'Too short',
      apiName: 'daily',
      cacheStrategy: 'INVALID',
    };

    expect(() => validateToolConfig(config)).toThrow();
  });
});

describe('validateToolConfigs', () => {
  test('validates array of configs', () => {
    const configs = [
      {
        name: 'get_cn_stock_price',
        description: 'Fetches stock price. When to Use: for price data. When NOT to Use: for fundamentals. Example: ts_code=600519.SH',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      },
      {
        name: 'get_cn_stock_prices',
        description: 'Fetches historical prices. When to Use: for time series. When NOT to Use: for single date. Example: ts_code=600519.SH',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.HISTORICAL,
      },
    ];

    const result = validateToolConfigs(configs);
    expect(result).toHaveLength(2);
  });

  test('throws error with index for invalid config', () => {
    const configs = [
      {
        name: 'get_cn_stock_price',
        description: 'Fetches stock price. When to Use: for price data. When NOT to Use: for fundamentals. Example: ts_code=600519.SH',
        apiName: 'daily',
        cacheStrategy: CacheStrategy.CURRENT_DAY,
      },
      {
        name: 'invalid-name',
        description: 'Too short',
        apiName: 'daily',
        cacheStrategy: 'INVALID',
      },
    ];

    expect(() => validateToolConfigs(configs)).toThrow(/index 1/);
  });
});
