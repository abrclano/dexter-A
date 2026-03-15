import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  getTodayBeijing,
  parseDate,
  formatDate,
  isHistoricalDate,
  getTodayBeijingFormatted,
} from './date';
import type { DateYYYYMMDD } from '../types/common';

describe('Date Utilities', () => {
  describe('getTodayBeijing', () => {
    test('returns date at midnight', () => {
      const today = getTodayBeijing();
      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(today.getSeconds()).toBe(0);
      expect(today.getMilliseconds()).toBe(0);
    });

    test('returns date in Beijing timezone', () => {
      const today = getTodayBeijing();
      const now = new Date();
      const beijingNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      
      // Should be same day as Beijing time
      expect(today.getFullYear()).toBe(beijingNow.getFullYear());
      expect(today.getMonth()).toBe(beijingNow.getMonth());
      expect(today.getDate()).toBe(beijingNow.getDate());
    });
  });

  describe('parseDate', () => {
    test('parses valid YYYYMMDD date', () => {
      const date = parseDate('20240115' as DateYYYYMMDD);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January (0-indexed)
      expect(date.getDate()).toBe(15);
    });

    test('parses date at midnight', () => {
      const date = parseDate('20240115' as DateYYYYMMDD);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
      expect(date.getMilliseconds()).toBe(0);
    });

    test('throws error for invalid format', () => {
      expect(() => parseDate('2024-01-15' as DateYYYYMMDD)).toThrow('Invalid date format');
      expect(() => parseDate('202401' as DateYYYYMMDD)).toThrow('Invalid date format');
    });

    test('throws error for invalid calendar date', () => {
      expect(() => parseDate('20240230' as DateYYYYMMDD)).toThrow('Invalid calendar date');
      expect(() => parseDate('20241332' as DateYYYYMMDD)).toThrow('Invalid calendar date');
    });

    test('handles leap year correctly', () => {
      const leapDate = parseDate('20240229' as DateYYYYMMDD);
      expect(leapDate.getFullYear()).toBe(2024);
      expect(leapDate.getMonth()).toBe(1); // February
      expect(leapDate.getDate()).toBe(29);

      expect(() => parseDate('20230229' as DateYYYYMMDD)).toThrow('Invalid calendar date');
    });
  });

  describe('formatDate', () => {
    test('formats date to YYYYMMDD', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      const formatted = formatDate(date);
      expect(String(formatted)).toBe('20240115');
    });

    test('pads single digit month and day', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024
      const formatted = formatDate(date);
      expect(String(formatted)).toBe('20240105');
    });

    test('handles December correctly', () => {
      const date = new Date(2024, 11, 31); // December 31, 2024
      const formatted = formatDate(date);
      expect(String(formatted)).toBe('20241231');
    });
  });

  describe('isHistoricalDate', () => {
    test('returns true for dates before today (Beijing time)', () => {
      const yesterday = new Date(getTodayBeijing());
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);
      
      expect(isHistoricalDate(yesterdayStr)).toBe(true);
    });

    test('returns false for today (Beijing time)', () => {
      const todayStr = getTodayBeijingFormatted();
      expect(isHistoricalDate(todayStr)).toBe(false);
    });

    test('returns false for future dates', () => {
      const tomorrow = new Date(getTodayBeijing());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow);
      
      expect(isHistoricalDate(tomorrowStr)).toBe(false);
    });

    test('returns true for dates far in the past', () => {
      expect(isHistoricalDate('20200101' as DateYYYYMMDD)).toBe(true);
      expect(isHistoricalDate('20100101' as DateYYYYMMDD)).toBe(true);
    });
  });

  describe('getTodayBeijingFormatted', () => {
    test('returns today in YYYYMMDD format', () => {
      const formatted = getTodayBeijingFormatted();
      expect(formatted).toMatch(/^\d{8}$/);
    });

    test('matches getTodayBeijing formatted', () => {
      const today = getTodayBeijing();
      const formatted = getTodayBeijingFormatted();
      expect(formatted).toBe(formatDate(today));
    });

    test('returns same value when called multiple times in same day', () => {
      const first = getTodayBeijingFormatted();
      const second = getTodayBeijingFormatted();
      expect(first).toBe(second);
    });
  });

  describe('round-trip conversion', () => {
    test('parseDate and formatDate are inverse operations', () => {
      const original = '20240115' as DateYYYYMMDD;
      const parsed = parseDate(original);
      const formatted = formatDate(parsed);
      expect(formatted).toBe(original);
    });

    test('formatDate and parseDate are inverse operations', () => {
      const original = new Date(2024, 0, 15);
      original.setHours(0, 0, 0, 0);
      const formatted = formatDate(original);
      const parsed = parseDate(formatted);
      expect(parsed.getTime()).toBe(original.getTime());
    });
  });
});
