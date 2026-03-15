/**
 * Cache manager with LRU eviction and strategy-based TTL
 */

import type { CacheEntry, CacheStats, CacheManager as ICacheManager } from '../types/cache.js';
import type { DateYYYYMMDD } from '../types/common.js';
import { CacheStrategy } from '../types/api.js';
import { getTodayBeijing, parseDate } from '../utils/date.js';
import { compress, decompress } from '../utils/compression.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_CACHE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const COMPRESSION_THRESHOLD = 10 * 1024; // Compress values larger than 10KB

// TTL values in milliseconds
const TTL_5_MINUTES = 5 * 60 * 1000;
const TTL_24_HOURS = 24 * 60 * 60 * 1000;
const TTL_7_DAYS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// Cache Manager Implementation
// ============================================================================

/**
 * In-memory cache manager with LRU eviction
 * 
 * Features:
 * - Strategy-based TTL (historical, current day, financial, reference)
 * - LRU eviction when size exceeds 100MB
 * - Compression for large values (>10KB)
 * - Pattern-based invalidation
 * - Hit/miss tracking
 */
export class CacheManager implements ICacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (entry.expiresAt !== Infinity && entry.expiresAt < now) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = now;
    this.stats.hits++;

    // Decompress if needed
    if (entry.value && typeof entry.value === 'object' && entry.value.__compressed) {
      return decompress(entry.value.data) as T;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache with TTL
   * Automatically compresses large values and evicts LRU entries if needed
   */
  set<T>(key: string, value: T, ttl: number): void {
    const now = Date.now();
    
    // Estimate size (UTF-16 approximation)
    const serialized = JSON.stringify(value);
    let size = serialized.length * 2;
    let storedValue: any = value;

    // Compress large values
    if (size > COMPRESSION_THRESHOLD) {
      storedValue = {
        __compressed: true,
        data: compress(value),
      };
      // Re-estimate size after compression
      size = JSON.stringify(storedValue).length * 2;
    }

    const entry: CacheEntry<T> = {
      value: storedValue,
      expiresAt: ttl === Infinity ? Infinity : now + ttl,
      lastAccessed: now,
      size,
    };

    // Check if we need to evict entries
    const currentSize = this.getCurrentSize();
    if (currentSize + size > MAX_CACHE_SIZE_BYTES) {
      this.evictLRU(size);
    }

    this.cache.set(key, entry);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.getCurrentSize(),
      evictions: this.stats.evictions,
      entryCount: this.cache.size,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get current cache size in bytes (estimated)
   */
  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Evict least recently used entries until we have enough space
   */
  private evictLRU(requiredSpace: number): void {
    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed
    );

    let freedSpace = 0;
    let evictedCount = 0;

    for (const [key, entry] of entries) {
      if (this.getCurrentSize() - freedSpace + requiredSpace <= MAX_CACHE_SIZE_BYTES) {
        break;
      }

      this.cache.delete(key);
      freedSpace += entry.size;
      evictedCount++;
    }

    this.stats.evictions += evictedCount;
  }
}

// ============================================================================
// TTL Determination
// ============================================================================

/**
 * Determine TTL based on cache strategy and request parameters
 * 
 * @param strategy Cache strategy to use
 * @param params Request parameters (may contain date fields)
 * @returns TTL in milliseconds (Infinity for indefinite caching)
 */
export function determineTTL(
  strategy: CacheStrategy,
  params: Record<string, any>
): number {
  switch (strategy) {
    case CacheStrategy.HISTORICAL:
      return determineHistoricalTTL(params);

    case CacheStrategy.CURRENT_DAY:
      return TTL_5_MINUTES;

    case CacheStrategy.FINANCIAL:
      return TTL_24_HOURS;

    case CacheStrategy.REFERENCE:
      return TTL_7_DAYS;

    case CacheStrategy.NO_CACHE:
      return 0;

    default:
      return TTL_5_MINUTES;
  }
}

/**
 * Determine TTL for historical data strategy
 * Returns Infinity if all dates are before today (Beijing time), otherwise 5 minutes
 */
function determineHistoricalTTL(params: Record<string, any>): number {
  const todayBeijing = getTodayBeijing();

  // Check various date fields that might be present
  const dateFields = ['end_date', 'trade_date', 'period', 'ann_date'];

  for (const field of dateFields) {
    const dateValue = params[field];
    if (dateValue && typeof dateValue === 'string') {
      try {
        const date = parseDate(dateValue as DateYYYYMMDD);
        // If any date is today or in the future, use short TTL
        if (date >= todayBeijing) {
          return TTL_5_MINUTES;
        }
      } catch {
        // Invalid date format, skip
        continue;
      }
    }
  }

  // All dates are historical, cache indefinitely
  return Infinity;
}

