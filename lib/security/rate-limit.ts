/**
 * Rate Limiting Service
 * 
 * Provides rate limiting functionality using Upstash Redis.
 * Implements different rate limits for different operation types.
 * 
 * Usage:
 *   const { success } = await checkRateLimit('user-id', 'api');
 *   if (!success) return rateLimitExceeded();
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if rate limiting is configured
const isConfigured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

// Create Redis instance only if configured
const redis = isConfigured ? Redis.fromEnv() : null;

/**
 * Rate limit configurations for different operation types
 */
export const rateLimitConfigs = {
  // Authentication endpoints - very strict to prevent brute force
  auth: {
    requests: 5,
    window: "15 m", // 5 attempts per 15 minutes
  },
  
  // General API calls - moderate
  api: {
    requests: 100,
    window: "1 m", // 100 requests per minute
  },
  
  // Read-only operations - more relaxed
  read: {
    requests: 300,
    window: "1 m", // 300 requests per minute
  },
  
  // Banking operations - strict (expensive API calls)
  banking: {
    requests: 10,
    window: "1 h", // 10 banking syncs per hour
  },
  
  // File uploads - moderate
  upload: {
    requests: 20,
    window: "1 h", // 20 uploads per hour
  },
  
  // Admin operations - relaxed
  admin: {
    requests: 200,
    window: "1 m", // 200 requests per minute
  },
} as const;

export type RateLimitType = keyof typeof rateLimitConfigs;

/**
 * Rate limiters for different scenarios
 * Only created if Redis is configured
 */
export const rateLimiters = isConfigured && redis ? {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.auth.requests,
      rateLimitConfigs.auth.window
    ),
    analytics: true,
    prefix: "ratelimit:auth",
  }),
  
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.api.requests,
      rateLimitConfigs.api.window
    ),
    analytics: true,
    prefix: "ratelimit:api",
  }),
  
  read: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.read.requests,
      rateLimitConfigs.read.window
    ),
    analytics: true,
    prefix: "ratelimit:read",
  }),
  
  banking: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.banking.requests,
      rateLimitConfigs.banking.window
    ),
    analytics: true,
    prefix: "ratelimit:banking",
  }),
  
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.upload.requests,
      rateLimitConfigs.upload.window
    ),
    analytics: true,
    prefix: "ratelimit:upload",
  }),
  
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.admin.requests,
      rateLimitConfigs.admin.window
    ),
    analytics: true,
    prefix: "ratelimit:admin",
  }),
} : null;

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending?: Promise<unknown>;
}

/**
 * Check rate limit for a given identifier
 * 
 * @param identifier - Unique identifier (user ID, IP address, etc.)
 * @param type - Type of rate limit to apply
 * @returns Rate limit result with success status and metadata
 * 
 * @example
 * ```typescript
 * const result = await checkRateLimit(user.id, 'api');
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: 'Rate limit exceeded' },
 *     { 
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': result.limit.toString(),
 *         'X-RateLimit-Remaining': result.remaining.toString(),
 *         'X-RateLimit-Reset': result.reset.toString(),
 *       }
 *     }
 *   );
 * }
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<RateLimitResult> {
  // If rate limiting is not configured, allow all requests
  // This ensures backward compatibility when Redis is not set up
  if (!isConfigured || !rateLimiters) {
    console.warn('[RATE_LIMIT] Not configured - allowing request');
    return {
      success: true,
      limit: rateLimitConfigs[type].requests,
      remaining: rateLimitConfigs[type].requests,
      reset: Date.now() + 60000, // 1 minute from now
    };
  }
  
  try {
    const limiter = rateLimiters[type];
    const result = await limiter.limit(identifier);
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      pending: result.pending,
    };
  } catch (error) {
    // If rate limiting fails (e.g., Redis is down), log error and allow request
    // This ensures the application remains available even if rate limiting fails
    console.error('[RATE_LIMIT] Error checking rate limit:', error);
    return {
      success: true,
      limit: rateLimitConfigs[type].requests,
      remaining: rateLimitConfigs[type].requests,
      reset: Date.now() + 60000,
    };
  }
}

/**
 * Helper to create rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again later.`,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: new Date(result.reset).toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
        'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
      },
    }
  );
}

/**
 * Get rate limit identifier from request
 * Uses user ID if authenticated, otherwise falls back to IP address
 */
export function getRateLimitIdentifier(
  userId: string | null,
  ipAddress: string | null
): string {
  return userId || ipAddress || 'anonymous';
}

/**
 * Get IP address from request headers
 */
export function getIpAddress(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitingEnabled(): boolean {
  return Boolean(isConfigured && rateLimiters !== null);
}

