import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Initialize Redis Client
// In development, this won't crash immediately if keys are missing until an operation is called
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://dummy-url.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy-token',
});

// Create a new ratelimiter, that allows 10 requests per 1 minute
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(10, "60 s"),
  analytics: true, // Automatically logs analytics to Upstash dashboard
});

/**
 * Generates a SHA-256 hash of the user query to use as a cache key.
 * This uses Web Crypto API which is fully compatible with Edge runtimes.
 */
export async function generateCacheKey(query: string): Promise<string> {
  // Normalize the query: lowercase, trim whitespace, remove punctuation
  const normalizedQuery = query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]|_/g, "")
    .replace(/\s+/g, " ");
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedQuery);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Attempts to retrieve a cached response from Redis.
 */
export async function getCachedResponse(query: string): Promise<string | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null; // Gracefully bypass if Redis isn't configured
  
  const cacheKey = `rag_cache:${await generateCacheKey(query)}`;
  try {
    const cachedData = await redis.get<string>(cacheKey);
    return cachedData || null;
  } catch (error) {
    console.error('Redis Cache Read Error:', error);
    return null;
  }
}

/**
 * Saves a generated AI response to Redis with a TTL (Time-To-Live).
 */
export async function setCachedResponse(query: string, response: string, ttlSeconds: number = 3600) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return; // Gracefully bypass if Redis isn't configured
  
  const cacheKey = `rag_cache:${await generateCacheKey(query)}`;
  try {
    // Save to Redis with expiration
    await redis.set(cacheKey, response, { ex: ttlSeconds });
  } catch (error) {
    console.error('Redis Cache Write Error:', error);
  }
}
