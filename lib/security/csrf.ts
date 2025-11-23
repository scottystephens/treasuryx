/**
 * CSRF (Cross-Site Request Forgery) Protection
 * 
 * Provides token-based CSRF protection for state-changing operations.
 * Implements double-submit cookie pattern with additional security.
 * 
 * Usage:
 * ```typescript
 * // Generate token (in API route or middleware)
 * const token = await generateCsrfToken(sessionId);
 * 
 * // Validate token (in protected API route)
 * const isValid = await validateCsrfToken(token, sessionId);
 * if (!isValid) throw errors.forbidden('Invalid CSRF token');
 * 
 * // Or use middleware
 * export const POST = withCsrfProtection(handler);
 * ```
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ApiError } from './error-handler';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * CSRF Token with metadata
 */
interface CsrfToken {
  token: string;
  expiresAt: number;
  sessionId: string;
}

/**
 * In-memory token store (use Redis in production for distributed systems)
 * For now, this works well for single-instance deployments
 */
const tokenStore = new Map<string, CsrfToken>();

/**
 * Clean up expired tokens periodically
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [sessionId, token] of tokenStore.entries()) {
    if (now > token.expiresAt) {
      tokenStore.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredTokens, 5 * 60 * 1000);
}

/**
 * Generate a CSRF token for a session
 * 
 * @param sessionId - Unique session identifier (user ID or session ID)
 * @returns The generated CSRF token
 * 
 * @example
 * ```typescript
 * const token = await generateCsrfToken(user.id);
 * // Return token to client in header or response
 * ```
 */
export async function generateCsrfToken(sessionId: string): Promise<string> {
  // Generate cryptographically secure random token
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  
  // Store token with expiry
  tokenStore.set(sessionId, {
    token,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY,
    sessionId,
  });
  
  // Clean up old tokens
  cleanupExpiredTokens();
  
  return token;
}

/**
 * Validate a CSRF token
 * 
 * @param token - The token to validate
 * @param sessionId - The session ID to validate against
 * @returns True if token is valid, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = await validateCsrfToken(token, user.id);
 * if (!isValid) {
 *   throw new ApiError(403, 'Invalid CSRF token');
 * }
 * ```
 */
export async function validateCsrfToken(
  token: string | null,
  sessionId: string
): Promise<boolean> {
  if (!token) return false;
  
  const stored = tokenStore.get(sessionId);
  if (!stored) return false;
  
  // Check expiry
  if (Date.now() > stored.expiresAt) {
    tokenStore.delete(sessionId);
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(stored.token)
    );
  } catch {
    // Tokens are different lengths, definitely invalid
    return false;
  }
}

/**
 * Invalidate a CSRF token (e.g., on logout)
 * 
 * @param sessionId - The session ID to invalidate
 */
export async function invalidateCsrfToken(sessionId: string): Promise<void> {
  tokenStore.delete(sessionId);
}

/**
 * Get CSRF token from request headers
 * 
 * @param req - The Next.js request
 * @returns The CSRF token or null
 */
export function getCsrfTokenFromRequest(req: NextRequest): string | null {
  return req.headers.get(CSRF_HEADER_NAME);
}

/**
 * Get session ID from request (user ID from auth)
 * 
 * @param req - The Next.js request
 * @returns Session ID or null
 */
export async function getSessionId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Check if request method requires CSRF protection
 * 
 * @param method - HTTP method
 * @returns True if method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  return protectedMethods.includes(method.toUpperCase());
}

/**
 * Middleware to protect API routes with CSRF tokens
 * 
 * @param handler - The API route handler
 * @param options - Optional configuration
 * @returns Wrapped handler with CSRF protection
 * 
 * @example
 * ```typescript
 * // Protect a POST endpoint
 * export const POST = withCsrfProtection(async (req: NextRequest) => {
 *   // Handler is only called if CSRF token is valid
 *   return NextResponse.json({ success: true });
 * });
 * 
 * // Skip for specific conditions
 * export const POST = withCsrfProtection(handler, {
 *   skipForPaths: ['/api/webhooks'],
 * });
 * ```
 */
export function withCsrfProtection<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>,
  options: {
    /**
     * Skip CSRF check for specific paths
     */
    skipForPaths?: string[];
    
    /**
     * Skip CSRF check for unauthenticated requests
     * Useful for public endpoints that don't need CSRF
     */
    skipForUnauthenticated?: boolean;
  } = {}
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    // Check if this method requires CSRF protection
    if (!requiresCsrfProtection(req.method)) {
      return handler(req, context);
    }
    
    // Check if path should skip CSRF
    if (options.skipForPaths) {
      const shouldSkip = options.skipForPaths.some(path =>
        req.nextUrl.pathname.includes(path)
      );
      if (shouldSkip) {
        return handler(req, context);
      }
    }
    
    // Get session ID
    const sessionId = await getSessionId(req);
    
    // Skip for unauthenticated if configured
    if (!sessionId && options.skipForUnauthenticated) {
      return handler(req, context);
    }
    
    // If no session, CSRF doesn't apply (user not authenticated)
    if (!sessionId) {
      return handler(req, context);
    }
    
    // Get CSRF token from request
    const token = getCsrfTokenFromRequest(req);
    
    // Validate token
    const isValid = await validateCsrfToken(token, sessionId);
    
    if (!isValid) {
      console.warn('[CSRF] Invalid or missing CSRF token:', {
        path: req.nextUrl.pathname,
        method: req.method,
        hasToken: !!token,
        sessionId,
      });
      
      return NextResponse.json(
        {
          error: 'Invalid or missing CSRF token',
          message: 'This request requires a valid CSRF token. Please refresh the page and try again.',
        },
        { status: 403 }
      );
    }
    
    // Token is valid, proceed with request
    return handler(req, context);
  };
}

/**
 * API endpoint to get a CSRF token
 * Can be called from client to obtain a token
 * 
 * @example
 * ```typescript
 * // In your API route: app/api/csrf-token/route.ts
 * import { getCsrfTokenHandler } from '@/lib/security/csrf';
 * export const GET = getCsrfTokenHandler;
 * ```
 */
export async function getCsrfTokenHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionId = await getSessionId(req);
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const token = await generateCsrfToken(sessionId);
    
    const response = NextResponse.json({ token });
    
    // Also set as HttpOnly cookie for double-submit pattern
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_EXPIRY / 1000, // Convert to seconds
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('[CSRF] Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

/**
 * Client-side helper to fetch and cache CSRF token
 * Use this in your frontend code
 * 
 * @example
 * ```typescript
 * // In your API client
 * const token = await getCsrfToken();
 * await fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'X-CSRF-Token': token,
 *   },
 * });
 * ```
 */
let cachedCsrfToken: string | null = null;
let tokenExpiry: number = 0;

export async function getCsrfToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedCsrfToken && Date.now() < tokenExpiry) {
    return cachedCsrfToken;
  }
  
  // Fetch new token
  const response = await fetch('/api/csrf-token');
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  
  const { token } = await response.json();
  
  // Cache token (expires in 50 minutes to have buffer)
  cachedCsrfToken = token;
  tokenExpiry = Date.now() + (50 * 60 * 1000);
  
  return token;
}

/**
 * Clear cached CSRF token (e.g., on logout)
 */
export function clearCsrfToken(): void {
  cachedCsrfToken = null;
  tokenExpiry = 0;
}

/**
 * Constants for external use
 */
export const CSRF_CONSTANTS = {
  HEADER_NAME: CSRF_HEADER_NAME,
  COOKIE_NAME: CSRF_COOKIE_NAME,
  TOKEN_EXPIRY: CSRF_TOKEN_EXPIRY,
};

