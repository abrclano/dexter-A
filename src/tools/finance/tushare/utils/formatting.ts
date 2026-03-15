/**
 * Output formatting utilities for Tushare tools.
 *
 * Provides standardized formatting for all tool results to ensure consistent
 * structure with data, sourceUrls, and metadata fields across every tool.
 */

import type { ResponseMetadata } from '../types/api.js';

// ============================================================================
// Types
// ============================================================================

/** Standardized tool result structure returned by all Tushare tools. */
export interface ToolResult<T = unknown> {
  data: T;
  sourceUrls: string[];
  metadata?: ResponseMetadata & {
    /** Human-readable note appended when data was truncated */
    note?: string;
  };
}

// ============================================================================
// Core formatter
// ============================================================================

/**
 * Wrap raw data into the standardized ToolResult envelope.
 *
 * Ensures every tool response has the same top-level shape so callers can
 * reliably destructure `data`, `sourceUrls`, and `metadata`.
 */
export function formatToolResult<T>(
  data: T,
  sourceUrls: string[],
  metadata?: ResponseMetadata & { note?: string }
): ToolResult<T> {
  return {
    data,
    sourceUrls,
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

// ============================================================================
// Time-series helpers
// ============================================================================

/** Fields that are treated as date columns for sort purposes. */
const DATE_FIELDS = ['trade_date', 'ann_date', 'f_ann_date', 'end_date', 'cal_date'] as const;

/**
 * Sort an array of records by date in descending order (most recent first).
 *
 * Tries each field in DATE_FIELDS in order and uses the first one found.
 * Records without a recognised date field are left in their original order.
 */
export function sortTimeSeriesData(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (rows.length === 0) return rows;

  // Find which date field is present
  const dateField = DATE_FIELDS.find((f) => f in rows[0]!);
  if (!dateField) return rows;

  return [...rows].sort((a, b) => {
    const da = String(a[dateField] ?? '');
    const db = String(b[dateField] ?? '');
    // YYYYMMDD strings sort correctly as plain strings
    return db.localeCompare(da);
  });
}

// ============================================================================
// Null-value normalisation
// ============================================================================

/**
 * Normalise null/undefined values in a row to `null` for consistent output.
 *
 * Tushare sometimes returns `null`, empty string `""`, or the string `"None"`
 * for missing values. This function converts all of those to `null` so
 * consumers always see a single sentinel.
 */
export function handleNullValues(
  row: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === '' || value === 'None') {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Apply null-value normalisation to every row in an array.
 */
export function normaliseRows(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map(handleNullValues);
}
