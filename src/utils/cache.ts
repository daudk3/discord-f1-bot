/**
 * Simple in-memory TTL cache.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /**
   * Get a cached value, or null if expired/missing.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set a value with a TTL in milliseconds.
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Remove a specific key.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
  }
}

/** Shared cache instance used across the bot */
export const cache = new TTLCache();

/** Cache TTL constants */
export const CACHE_TTL = {
  NEXT_RACE: 60 * 60 * 1000,          // 1 hour
  LAST_RACE: 6 * 60 * 60 * 1000,      // 6 hours
  STANDINGS: 6 * 60 * 60 * 1000,      // 6 hours
  RACE_RESULTS: 30 * 60 * 1000,       // 30 minutes
  SESSION_RESULTS: 15 * 60 * 1000,    // 15 minutes
  ALL_RACES: 60 * 60 * 1000,          // 1 hour
};
