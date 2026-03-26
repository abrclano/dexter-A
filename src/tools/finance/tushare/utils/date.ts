import type { DateYYYYMMDD } from '../types/common';

/**
 * Get current date in Beijing timezone (UTC+8)
 *
 * CRITICAL: Tushare uses Beijing time, so all date comparisons must use Beijing timezone
 * to avoid cache misses due to timezone differences.
 *
 * Example scenarios:
 * - Server time: 2024-01-15 23:00 UTC (still Jan 15 in UTC)
 * - Beijing time: 2024-01-16 07:00 CST (already Jan 16 in Beijing)
 * - Without this function: Would incorrectly treat Jan 16 data as "current day"
 * - With this function: Correctly treats Jan 16 data as "historical"
 *
 * @returns Date object representing today at 00:00:00 in Beijing timezone
 */
export function getTodayBeijing(): Date {
  const now = new Date();
  // Convert to Beijing time using Asia/Shanghai timezone
  const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  // Reset to start of day (00:00:00)
  beijingTime.setHours(0, 0, 0, 0);
  return beijingTime;
}

/**
 * Parse YYYYMMDD date string to Date object
 * Returns date at midnight (00:00:00) for consistent comparisons
 *
 * @param dateStr - Date string in YYYYMMDD format (e.g., "20240115")
 * @returns Date object at midnight
 * @throws Error if date string is invalid format
 */
export function parseDate(dateStr: DateYYYYMMDD): Date {
  if (dateStr.length !== 8) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYYMMDD format.`);
  }

  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);

  const date = new Date(year, month, day);

  // Validate that the date is valid (handles invalid dates like Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }

  return date;
}

/**
 * Format Date object to YYYYMMDD string
 *
 * @param date - Date object to format
 * @returns Date string in YYYYMMDD format
 */
export function formatDate(date: Date): DateYYYYMMDD {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}` as DateYYYYMMDD;
}

/**
 * Check if a date is before today (Beijing time)
 * Used to determine if data is historical and can be cached indefinitely
 *
 * @param dateStr - Date string in YYYYMMDD format
 * @returns true if date is before today (Beijing time), false otherwise
 */
export function isHistoricalDate(dateStr: DateYYYYMMDD): boolean {
  const date = parseDate(dateStr);
  const todayBeijing = getTodayBeijing();
  return date < todayBeijing;
}

/**
 * Get today's date in YYYYMMDD format (Beijing time)
 *
 * @returns Today's date string in YYYYMMDD format
 */
export function getTodayBeijingFormatted(): DateYYYYMMDD {
  return formatDate(getTodayBeijing());
}

/**
 * Split a date range into per-year sub-ranges.
 *
 * Used by the multi-year parallel fetching feature.
 * Each sub-range spans exactly one calendar year, clipped to the original
 * start/end boundaries.
 *
 * Example: "20220601" → "20241231" produces:
 *   [{ start: "20220601", end: "20221231" },
 *    { start: "20230101", end: "20231231" },
 *    { start: "20240101", end: "20241231" }]
 *
 * @param startDate - Range start in YYYYMMDD format
 * @param endDate   - Range end in YYYYMMDD format
 * @returns Array of { start, end } pairs, one per calendar year
 */
export function splitByYear(
  startDate: DateYYYYMMDD,
  endDate: DateYYYYMMDD
): Array<{ start: DateYYYYMMDD; end: DateYYYYMMDD }> {
  const startYear = parseInt(startDate.substring(0, 4), 10);
  const endYear = parseInt(endDate.substring(0, 4), 10);

  const ranges: Array<{ start: DateYYYYMMDD; end: DateYYYYMMDD }> = [];

  for (let year = startYear; year <= endYear; year++) {
    const rangeStart: DateYYYYMMDD =
      year === startYear ? startDate : (`${year}0101` as DateYYYYMMDD);
    const rangeEnd: DateYYYYMMDD =
      year === endYear ? endDate : (`${year}1231` as DateYYYYMMDD);
    ranges.push({ start: rangeStart, end: rangeEnd });
  }

  return ranges;
}

/**
 * Returns true when a date range spans more than one calendar year.
 *
 * @param startDate - Range start in YYYYMMDD format
 * @param endDate   - Range end in YYYYMMDD format
 */
export function spansMultipleYears(startDate: DateYYYYMMDD, endDate: DateYYYYMMDD): boolean {
  return startDate.substring(0, 4) !== endDate.substring(0, 4);
}
