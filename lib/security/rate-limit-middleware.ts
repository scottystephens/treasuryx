/**
 * Rate Limiting Middleware for API Routes
 * 
 * Provides easy-to-use middleware functions for applying rate limiting
 * to Next.js API routes.
 * 
 * Usage:
 * ```typescript
 * import { withRateLimit } from '@/lib/security/rate-limit-middleware';
 * 
 * export const POST = withRateLimit(async (req: NextRequest) => {
 *   // Your handler code
 * }, 'banking');
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitIdentifier,
  getIpAddress,
  type RateLimitType,
} from './rate-limit';

/**
 * Middleware to apply rate limiting to an API route
 * 
 * @param handler - The API route handler
 * @param rateLimitType - Type of rate limit to apply
 * @param options - Optional configuration
 * @returns Wrapped handler with rate limiting
 * 
 * @example
 * ```typescript
 * // Apply banking rate limit (10 requests/hour)
 * export const POST = withRateLimit(handler, 'banking');
 * 
 * // Apply auth rate limit (5 requests/15min)
 * export const POST = withRateLimit(handler, 'auth');
 * 
 * // Apply with custom identifier
 * export const POST = withRateLimit(handler, 'api', {
 *   getIdentifier: (req, user) => `custom:${user?.email}`
 * });
 * ```
 */
export function withRateLimit<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse> | NextResponse,
  rateLimitType: RateLimitType = 'api',
  options: {
    /**
     * Custom function to get rate limit identifier
     * Defaults to user ID or IP address
     */
    getIdentifier?: (req: NextRequest, userId: string | null) => string;
    
    /**
     * Whether to skip rate limiting for authenticated admin users
     * Defaults to false
     */
    skipForAdmins?: boolean;
    
    /**
     * Custom log prefix for debugging
     */
    logPrefix?: string;
  } = {}
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      // Get user if authenticated
      let userId: string | null = null;
      let isAdmin = false;

      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
        isAdmin = user?.user_metadata?.is_super_admin === true;
      } catch (error) {
        // If we can't get user, that's okay - use IP address
        console.warn('[RATE_LIMIT] Could not get user for rate limiting:', error);
      }

      // Skip rate limiting for admins if configured
      if (options.skipForAdmins && isAdmin) {
        return handler(req, context);
      }

      // Get rate limit identifier
      const ipAddress = getIpAddress(req.headers);
      const rateLimitId = options.getIdentifier
        ? options.getIdentifier(req, userId)
        : getRateLimitIdentifier(userId, ipAddress);

      // Check rate limit
      const rateLimitResult = await checkRateLimit(rateLimitId, rateLimitType);

      if (!rateLimitResult.success) {
        const logPrefix = options.logPrefix || '[RATE_LIMIT]';
        console.log(`${logPrefix} Request blocked:`, {
          userId,
          rateLimitType,
          identifier: rateLimitId,
          remaining: rateLimitResult.remaining,
          reset: new Date(rateLimitResult.reset).toISOString(),
          path: req.nextUrl.pathname,
        });
        const response = createRateLimitResponse(rateLimitResult);
        return new NextResponse(await response.text(), {
          status: response.status,
          headers: response.headers,
        });
      }

      // Add rate limit headers to response
      const response = await handler(req, context);
      
      // Add rate limit info headers to successful responses
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString());

      return response;
    } catch (error) {
      // If rate limiting fails, log and continue (graceful degradation)
      console.error('[RATE_LIMIT] Error in rate limit middleware:', error);
      return handler(req, context);
    }
  };
}

/**
 * Apply auth rate limiting (5 requests per 15 minutes)
 * Use for login, signup, password reset endpoints
 */
export function withAuthRateLimit<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, 'auth', {
    logPrefix: '[RATE_LIMIT:AUTH]',
  });
}

/**
 * Apply banking rate limiting (10 requests per hour)
 * Use for expensive banking API calls
 */
export function withBankingRateLimit<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, 'banking', {
    logPrefix: '[RATE_LIMIT:BANKING]',
  });
}

/**
 * Apply upload rate limiting (20 requests per hour)
 * Use for file upload endpoints
 */
export function withUploadRateLimit<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, 'upload', {
    logPrefix: '[RATE_LIMIT:UPLOAD]',
  });
}

/**
 * Apply API rate limiting (100 requests per minute)
 * Use for general API endpoints
 */
export function withApiRateLimit<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, 'api', {
    logPrefix: '[RATE_LIMIT:API]',
  });
}

/**
 * Apply read rate limiting (300 requests per minute)
 * Use for read-only endpoints
 */
export function withReadRateLimit<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, 'read', {
    logPrefix: '[RATE_LIMIT:READ]',
    skipForAdmins: true, // Admins can read freely
  });
}

/**
 * Apply admin rate limiting (200 requests per minute)
 * Use for admin endpoints
 */
export function withAdminRateLimit<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, 'admin', {
    logPrefix: '[RATE_LIMIT:ADMIN]',
  });
}

