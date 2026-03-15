/**
 * Cache-related types for Tushare module
 */

// ============================================================================
// Cache Interfaces
// ============================================================================

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Expiration timestamp (milliseconds since epoch) */
  expiresAt: number;
  /** Last access timestamp for LRU tracking */
  lastAccessed: number;
  /** Estimated size in bytes */
  size: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Current cache size in bytes (estimated) */
  size: number;
  /** Number of entries evicted */
  evictions: number;
  /** Total number of entries */
  entryCount: number;
}

/**
 * Cache manager interface
 */
export interface CacheManager {
  /**
   * Get value from cache
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null;

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in milliseconds
   */
  set<T>(key: string, value: T, ttl: number): void;

  /**
   * Invalidate cache entries matching pattern
   * @param pattern Regex pattern to match keys
   */
  invalidate(pattern: string): void;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;

  /**
   * Clear all cache entries
   */
  clear(): void;
}
