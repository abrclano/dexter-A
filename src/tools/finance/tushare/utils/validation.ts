/**
 * Validation and sanitization utilities for Tushare module
 * Provides validators for stock codes, dates, and date ranges
 */

import { TsCode, DateYYYYMMDD, isTsCode, isDateYYYYMMDD } from '../types/common';
import { TushareError } from '../types/error';

// ============================================================================
// Validator Interface
// ============================================================================

/**
 * Generic validator interface
 */
interface Validator<T> {
  validate(value: unknown): T;
  sanitize(value: T): T;
}

// ============================================================================
// Stock Code Validator
// ============================================================================

/**
 * Validator for Tushare stock codes (ts_code)
 * 
 * Valid formats:
 * - A-shares: 6 digits + .SH/.SZ/.BJ (e.g., 600519.SH, 000001.SZ, 688001.SH)
 * - HK stocks: 5 digits + .HK (e.g., 00700.HK)
 */
export class StockCodeValidator implements Validator<TsCode> {
  /**
   * Validate stock code format
   * @throws {TushareError} If stock code is invalid
   */
  validate(value: unknown): TsCode {
    if (typeof value !== 'string') {
      throw new TushareError(
        'Stock code must be a string',
        'INVALID_TYPE',
        'Provide a valid stock code like 600519.SH or 00700.HK',
        { field: 'ts_code', received: value, expectedType: 'string' }
      );
    }

    const sanitized = this.sanitize(value as any);

    if (!isTsCode(sanitized)) {
      throw new TushareError(
        `Invalid stock code format: '${value}'`,
        'INVALID_STOCK_CODE',
        'Use format: 6-digit + .SH/.SZ/.BJ for A-shares (e.g., 600519.SH), or 5-digit + .HK for HK stocks (e.g., 00700.HK). Use get_cn_stock_list or get_hk_stock_list to find codes.',
        { field: 'ts_code', received: value, pattern: /^(\d{6}\.(SH|SZ|BJ)|\d{5}\.HK)$/ }
      );
    }

    return sanitized;
  }

  /**
   * Sanitize stock code by trimming whitespace and converting to uppercase
   */
  sanitize(value: TsCode): TsCode {
    return value.trim().toUpperCase() as TsCode;
  }
}

// ============================================================================
// Date Validator
// ============================================================================

/**
 * Validator for dates in YYYYMMDD format
 * 
 * Valid format: YYYYMMDD (no hyphens)
 * Examples: 20240101, 20231231
 */
export class DateValidator implements Validator<DateYYYYMMDD> {
  /**
   * Validate date format and calendar validity
   * @throws {TushareError} If date is invalid
   */
  validate(value: unknown): DateYYYYMMDD {
    if (typeof value !== 'string') {
      throw new TushareError(
        'Date must be a string',
        'INVALID_TYPE',
        'Provide date in YYYYMMDD format, e.g., 20240101',
        { field: 'date', received: value, expectedType: 'string' }
      );
    }

    const sanitized = this.sanitize(value as any);

    if (!isDateYYYYMMDD(sanitized)) {
      throw new TushareError(
        `Invalid date format: '${value}'`,
        'INVALID_DATE_FORMAT',
        'Use YYYYMMDD format without hyphens, e.g., 20240101. Ensure the date is a valid calendar date.',
        { field: 'date', received: value, expectedFormat: 'YYYYMMDD' }
      );
    }

    return sanitized;
  }

  /**
   * Sanitize date by trimming whitespace
   */
  sanitize(value: DateYYYYMMDD): DateYYYYMMDD {
    return value.trim() as DateYYYYMMDD;
  }
}

// ============================================================================
// Date Range Validator
// ============================================================================

/**
 * Validator for date ranges
 * Ensures start_date <= end_date
 */
export class DateRangeValidator {
  private dateValidator = new DateValidator();

  /**
   * Validate date range
   * @throws {TushareError} If date range is invalid
   */
  validate(startDate: unknown, endDate: unknown): void {
    // First validate individual dates
    const validatedStartDate = this.dateValidator.validate(startDate);
    const validatedEndDate = this.dateValidator.validate(endDate);

    // Parse dates for comparison
    const start = this.parseDate(validatedStartDate);
    const end = this.parseDate(validatedEndDate);

    if (start > end) {
      throw new TushareError(
        `Invalid date range: start_date (${validatedStartDate}) is after end_date (${validatedEndDate})`,
        'INVALID_DATE_RANGE',
        'Ensure start_date is before or equal to end_date',
        {
          startDate: validatedStartDate,
          endDate: validatedEndDate,
        }
      );
    }
  }

  /**
   * Parse YYYYMMDD date string to Date object
   */
  private parseDate(dateStr: DateYYYYMMDD): Date {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate stock code
 * @throws {TushareError} If stock code is invalid
 */
export function validateStockCode(code: unknown): TsCode {
  return new StockCodeValidator().validate(code);
}

/**
 * Validate date in YYYYMMDD format
 * @throws {TushareError} If date is invalid
 */
export function validateDate(date: unknown): DateYYYYMMDD {
  return new DateValidator().validate(date);
}

/**
 * Validate date range (start_date <= end_date)
 * @throws {TushareError} If date range is invalid
 */
export function validateDateRange(startDate: unknown, endDate: unknown): void {
  new DateRangeValidator().validate(startDate, endDate);
}
