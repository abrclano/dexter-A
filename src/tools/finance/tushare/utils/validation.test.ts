/**
 * Tests for validation utilities
 */

import { describe, test, expect } from 'bun:test';
import {
  StockCodeValidator,
  DateValidator,
  DateRangeValidator,
  validateStockCode,
  validateDate,
  validateDateRange,
} from './validation';
import { TushareError } from '../types/error';
import { TsCode, DateYYYYMMDD } from '../types/common';

// ============================================================================
// Stock Code Validator Tests
// ============================================================================

describe('StockCodeValidator', () => {
  const validator = new StockCodeValidator();

  describe('validate', () => {
    test('accepts valid A-share codes (Shanghai)', () => {
      expect(String(validator.validate('600519.SH'))).toBe('600519.SH');
      expect(String(validator.validate('600000.SH'))).toBe('600000.SH');
      expect(String(validator.validate('601398.SH'))).toBe('601398.SH');
    });

    test('accepts valid A-share codes (Shenzhen)', () => {
      expect(String(validator.validate('000001.SZ'))).toBe('000001.SZ');
      expect(String(validator.validate('000858.SZ'))).toBe('000858.SZ');
      expect(String(validator.validate('002594.SZ'))).toBe('002594.SZ');
    });

    test('accepts valid A-share codes (Beijing)', () => {
      expect(String(validator.validate('430047.BJ'))).toBe('430047.BJ');
      expect(String(validator.validate('835185.BJ'))).toBe('835185.BJ');
    });

    test('accepts valid HK stock codes', () => {
      expect(String(validator.validate('00700.HK'))).toBe('00700.HK');
      expect(String(validator.validate('09988.HK'))).toBe('09988.HK');
      expect(String(validator.validate('01810.HK'))).toBe('01810.HK');
    });

    test('sanitizes by trimming whitespace', () => {
      expect(String(validator.validate('  600519.SH  '))).toBe('600519.SH');
      expect(String(validator.validate('\t00700.HK\n'))).toBe('00700.HK');
    });

    test('sanitizes by converting to uppercase', () => {
      expect(String(validator.validate('600519.sh'))).toBe('600519.SH');
      expect(String(validator.validate('00700.hk'))).toBe('00700.HK');
      expect(String(validator.validate('000001.sz'))).toBe('000001.SZ');
    });

    test('throws error for non-string input', () => {
      expect(() => validator.validate(123)).toThrow(TushareError);
      expect(() => validator.validate(null)).toThrow(TushareError);
      expect(() => validator.validate(undefined)).toThrow(TushareError);
      expect(() => validator.validate({})).toThrow(TushareError);
    });

    test('throws error with correct code for non-string', () => {
      try {
        validator.validate(123);
      } catch (error) {
        expect(error).toBeInstanceOf(TushareError);
        expect((error as TushareError).code).toBe('INVALID_TYPE');
        expect((error as TushareError).suggestion).toContain('600519.SH');
      }
    });

    test('throws error for invalid format - missing exchange', () => {
      expect(() => validator.validate('600519')).toThrow(TushareError);
    });

    test('throws error for invalid format - wrong digit count', () => {
      expect(() => validator.validate('60051.SH')).toThrow(TushareError);
      expect(() => validator.validate('6005199.SH')).toThrow(TushareError);
      expect(() => validator.validate('0070.HK')).toThrow(TushareError);
      expect(() => validator.validate('007000.HK')).toThrow(TushareError);
    });

    test('throws error for invalid format - wrong exchange code', () => {
      expect(() => validator.validate('600519.SS')).toThrow(TushareError);
      expect(() => validator.validate('600519.CN')).toThrow(TushareError);
      expect(() => validator.validate('00700.HG')).toThrow(TushareError);
    });

    test('throws error with suggestion for invalid stock code', () => {
      try {
        validator.validate('INVALID');
      } catch (error) {
        expect(error).toBeInstanceOf(TushareError);
        expect((error as TushareError).code).toBe('INVALID_STOCK_CODE');
        expect((error as TushareError).suggestion).toContain('get_cn_stock_list');
        expect((error as TushareError).suggestion).toContain('get_hk_stock_list');
      }
    });

    test('includes context in error', () => {
      try {
        validator.validate('INVALID');
      } catch (error) {
        expect((error as TushareError).context).toBeDefined();
        expect((error as TushareError).context?.field).toBe('ts_code');
        expect((error as TushareError).context?.received).toBe('INVALID');
      }
    });
  });

  describe('sanitize', () => {
    test('trims whitespace', () => {
      expect(String(validator.sanitize('  600519.SH  ' as TsCode))).toBe('600519.SH');
    });

    test('converts to uppercase', () => {
      expect(String(validator.sanitize('600519.sh' as TsCode))).toBe('600519.SH');
    });

    test('handles already clean input', () => {
      expect(String(validator.sanitize('600519.SH' as TsCode))).toBe('600519.SH');
    });
  });
});

// ============================================================================
// Date Validator Tests
// ============================================================================

describe('DateValidator', () => {
  const validator = new DateValidator();

  describe('validate', () => {
    test('accepts valid dates', () => {
      expect(String(validator.validate('20240101'))).toBe('20240101');
      expect(String(validator.validate('20231231'))).toBe('20231231');
      expect(String(validator.validate('20200229'))).toBe('20200229'); // Leap year
      expect(String(validator.validate('19900101'))).toBe('19900101');
    });

    test('sanitizes by trimming whitespace', () => {
      expect(String(validator.validate('  20240101  '))).toBe('20240101');
      expect(String(validator.validate('\t20231231\n'))).toBe('20231231');
    });

    test('throws error for non-string input', () => {
      expect(() => validator.validate(20240101)).toThrow(TushareError);
      expect(() => validator.validate(null)).toThrow(TushareError);
      expect(() => validator.validate(undefined)).toThrow(TushareError);
    });

    test('throws error with correct code for non-string', () => {
      try {
        validator.validate(20240101);
      } catch (error) {
        expect(error).toBeInstanceOf(TushareError);
        expect((error as TushareError).code).toBe('INVALID_TYPE');
        expect((error as TushareError).suggestion).toContain('YYYYMMDD');
      }
    });

    test('throws error for wrong format - with hyphens', () => {
      expect(() => validator.validate('2024-01-01')).toThrow(TushareError);
    });

    test('throws error for wrong format - with slashes', () => {
      expect(() => validator.validate('2024/01/01')).toThrow(TushareError);
    });

    test('throws error for wrong length', () => {
      expect(() => validator.validate('2024011')).toThrow(TushareError);
      expect(() => validator.validate('202401011')).toThrow(TushareError);
    });

    test('throws error for invalid month', () => {
      expect(() => validator.validate('20240001')).toThrow(TushareError);
      expect(() => validator.validate('20241301')).toThrow(TushareError);
    });

    test('throws error for invalid day', () => {
      expect(() => validator.validate('20240100')).toThrow(TushareError);
      expect(() => validator.validate('20240132')).toThrow(TushareError);
    });

    test('throws error for invalid calendar date', () => {
      expect(() => validator.validate('20240230')).toThrow(TushareError); // Feb 30
      expect(() => validator.validate('20240431')).toThrow(TushareError); // Apr 31
      expect(() => validator.validate('20230229')).toThrow(TushareError); // Non-leap year
    });

    test('throws error with suggestion for invalid date', () => {
      try {
        validator.validate('2024-01-01');
      } catch (error) {
        expect(error).toBeInstanceOf(TushareError);
        expect((error as TushareError).code).toBe('INVALID_DATE_FORMAT');
        expect((error as TushareError).suggestion).toContain('YYYYMMDD');
        expect((error as TushareError).suggestion).toContain('20240101');
      }
    });

    test('includes context in error', () => {
      try {
        validator.validate('INVALID');
      } catch (error) {
        expect((error as TushareError).context).toBeDefined();
        expect((error as TushareError).context?.field).toBe('date');
        expect((error as TushareError).context?.received).toBe('INVALID');
        expect((error as TushareError).context?.expectedFormat).toBe('YYYYMMDD');
      }
    });
  });

  describe('sanitize', () => {
    test('trims whitespace', () => {
      expect(String(validator.sanitize('  20240101  ' as DateYYYYMMDD))).toBe('20240101');
    });

    test('handles already clean input', () => {
      expect(String(validator.sanitize('20240101' as DateYYYYMMDD))).toBe('20240101');
    });
  });
});

// ============================================================================
// Date Range Validator Tests
// ============================================================================

describe('DateRangeValidator', () => {
  const validator = new DateRangeValidator();

  describe('validate', () => {
    test('accepts valid date range - same date', () => {
      expect(() => validator.validate('20240101', '20240101')).not.toThrow();
    });

    test('accepts valid date range - start before end', () => {
      expect(() => validator.validate('20240101', '20240131')).not.toThrow();
      expect(() => validator.validate('20230101', '20231231')).not.toThrow();
      expect(() => validator.validate('20200101', '20241231')).not.toThrow();
    });

    test('throws error when start is after end', () => {
      expect(() => validator.validate('20240131', '20240101')).toThrow(TushareError);
      expect(() => validator.validate('20241231', '20240101')).toThrow(TushareError);
    });

    test('throws error with correct code for invalid range', () => {
      try {
        validator.validate('20240131', '20240101');
      } catch (error) {
        expect(error).toBeInstanceOf(TushareError);
        expect((error as TushareError).code).toBe('INVALID_DATE_RANGE');
        expect((error as TushareError).suggestion).toContain('start_date');
        expect((error as TushareError).suggestion).toContain('end_date');
      }
    });

    test('includes both dates in error context', () => {
      try {
        validator.validate('20240131', '20240101');
      } catch (error) {
        expect((error as TushareError).context).toBeDefined();
        expect((error as TushareError).context?.startDate).toBe('20240131');
        expect((error as TushareError).context?.endDate).toBe('20240101');
      }
    });

    test('validates individual dates first', () => {
      expect(() => validator.validate('INVALID', '20240101')).toThrow(TushareError);
      expect(() => validator.validate('20240101', 'INVALID')).toThrow(TushareError);
      expect(() => validator.validate('2024-01-01', '20240131')).toThrow(TushareError);
    });

    test('handles dates across years', () => {
      expect(() => validator.validate('20231201', '20240131')).not.toThrow();
      expect(() => validator.validate('20240131', '20231201')).toThrow(TushareError);
    });

    test('handles dates across months', () => {
      expect(() => validator.validate('20240131', '20240201')).not.toThrow();
      expect(() => validator.validate('20240201', '20240131')).toThrow(TushareError);
    });
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('validateStockCode helper', () => {
  test('validates and returns TsCode', () => {
    expect(String(validateStockCode('600519.SH'))).toBe('600519.SH');
    expect(String(validateStockCode('00700.HK'))).toBe('00700.HK');
  });

  test('sanitizes input', () => {
    expect(String(validateStockCode('  600519.sh  '))).toBe('600519.SH');
  });

  test('throws TushareError for invalid input', () => {
    expect(() => validateStockCode('INVALID')).toThrow(TushareError);
  });
});

describe('validateDate helper', () => {
  test('validates and returns DateYYYYMMDD', () => {
    expect(String(validateDate('20240101'))).toBe('20240101');
    expect(String(validateDate('20231231'))).toBe('20231231');
  });

  test('sanitizes input', () => {
    expect(String(validateDate('  20240101  '))).toBe('20240101');
  });

  test('throws TushareError for invalid input', () => {
    expect(() => validateDate('2024-01-01')).toThrow(TushareError);
    expect(() => validateDate('INVALID')).toThrow(TushareError);
  });
});

describe('validateDateRange helper', () => {
  test('validates valid date ranges', () => {
    expect(() => validateDateRange('20240101', '20240131')).not.toThrow();
    expect(() => validateDateRange('20240101', '20240101')).not.toThrow();
  });

  test('throws TushareError for invalid range', () => {
    expect(() => validateDateRange('20240131', '20240101')).toThrow(TushareError);
  });

  test('throws TushareError for invalid dates', () => {
    expect(() => validateDateRange('INVALID', '20240101')).toThrow(TushareError);
    expect(() => validateDateRange('20240101', 'INVALID')).toThrow(TushareError);
  });
});
