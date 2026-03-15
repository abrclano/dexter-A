/**
 * Common types for Tushare module
 * Provides branded types for type safety and common interfaces
 */

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Tushare stock code (ts_code)
 * Format: 6 digits + .SH/.SZ/.BJ for A-shares, 5 digits + .HK for HK stocks
 * Examples: 600519.SH, 000001.SZ, 688001.SH, 00700.HK
 */
export type TsCode = string & { readonly __brand: 'TsCode' };

/**
 * Date in YYYYMMDD format (no hyphens)
 * Examples: 20240101, 20231231
 */
export type DateYYYYMMDD = string & { readonly __brand: 'DateYYYYMMDD' };

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TsCode
 * Validates stock code format
 */
export function isTsCode(value: string): value is TsCode {
  return /^(\d{6}\.(SH|SZ|BJ)|\d{5}\.HK)$/.test(value);
}

/**
 * Type guard for DateYYYYMMDD
 * Validates date format and calendar validity
 */
export function isDateYYYYMMDD(value: string): value is DateYYYYMMDD {
  if (!/^\d{8}$/.test(value)) {
    return false;
  }

  const year = parseInt(value.substring(0, 4), 10);
  const month = parseInt(value.substring(4, 6), 10);
  const day = parseInt(value.substring(6, 8), 10);

  // Basic validation
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Check if date is valid
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// ============================================================================
// Common Interfaces
// ============================================================================

/**
 * Date range for querying time series data
 */
export interface DateRange {
  startDate: DateYYYYMMDD;
  endDate: DateYYYYMMDD;
}

/**
 * Pagination parameters for large result sets
 */
export interface PaginationParams {
  offset?: number;
  limit?: number;
}

/**
 * Financial report type
 * 1: Consolidated, 2: Consolidated Adjusted, 3: Consolidated Adjusted (old)
 * 4: Parent Company, 5: Parent Adjusted, 11: Consolidated (IFRS), 12: Parent (IFRS)
 */
export interface ReportType {
  type: '1' | '2' | '3' | '4' | '5' | '11' | '12';
  description: string;
}

/**
 * Discriminated union for financial report types
 */
export type FinancialReport =
  | { reportType: '1'; name: 'Consolidated' }
  | { reportType: '2'; name: 'Consolidated Adjusted' }
  | { reportType: '3'; name: 'Consolidated Adjusted (Old)' }
  | { reportType: '4'; name: 'Parent Company' }
  | { reportType: '5'; name: 'Parent Adjusted' }
  | { reportType: '11'; name: 'Consolidated (IFRS)' }
  | { reportType: '12'; name: 'Parent (IFRS)' };
