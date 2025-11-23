/**
 * Secure Error Handler for API Routes
 * 
 * Provides production-ready error handling that:
 * - Sanitizes error messages (no internal details exposed)
 * - Logs errors securely (no PII in production)
 * - Returns user-friendly messages
 * - Includes error tracking metadata
 * 
 * Usage:
 * ```typescript
 * import { handleApiError, ApiError } from '@/lib/security/error-handler';
 * 
 * try {
 *   // Your code
 * } catch (error) {
 *   return handleApiError(error, {
 *     endpoint: '/api/accounts',
 *     userId: user?.id,
 *     tenantId,
 *   });
 * }
 * ```
 */

import { NextResponse } from 'next/server';

/**
 * Context for error logging
 */
export interface ErrorContext {
  endpoint: string;
  userId?: string;
  tenantId?: string;
  method?: string;
  [key: string]: any;
}

/**
 * Custom API Error class for controlled error responses
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public userMessage?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Map of status codes to user-friendly messages
 */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input and try again.',
  401: 'Authentication required. Please sign in.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This operation conflicts with existing data.',
  429: 'Too many requests. Please try again later.',
  500: 'An error occurred. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
};

/**
 * Get user-friendly message for status code
 */
function getUserFriendlyMessage(statusCode: number): string {
  return STATUS_MESSAGES[statusCode] || STATUS_MESSAGES[500];
}

/**
 * Sanitize error for logging (remove sensitive data)
 */
function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const SENSITIVE_KEYS = [
    'password',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'secret',
    'apiKey',
    'api_key',
    'clientSecret',
    'client_secret',
    'authorization',
    'cookie',
    'session',
    'creditCard',
    'credit_card',
    'ssn',
    'social_security',
  ];
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive data
    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '***REDACTED***';
    }
    
    // Recursively sanitize nested objects
    if (sanitized[key] && typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Check if error should expose details (development only)
 */
function shouldExposeDetails(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Log error securely
 */
function logError(
  error: unknown,
  context: ErrorContext
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  // Sanitize the full context first
  const sanitizedContext = sanitizeForLogging(context);
  
  // If error is ApiError with context, sanitize that too
  let errorContext = {};
  if (error instanceof ApiError && error.context) {
    errorContext = sanitizeForLogging(error.context);
  }
  
  const logData = {
    timestamp: new Date().toISOString(),
    level: 'error',
    endpoint: context.endpoint,
    method: context.method,
    errorType: errorObj.constructor.name,
    errorMessage: errorObj.message,
    // Only include user/tenant IDs in development or for tracking
    ...(shouldExposeDetails() && {
      userId: context.userId,
      tenantId: context.tenantId,
    }),
    // Only include stack trace in development
    ...(shouldExposeDetails() && {
      stack: errorObj.stack,
    }),
    // Include sanitized context (without userId/tenantId as they're logged separately)
    context: {
      ...sanitizedContext,
      ...errorContext,
      userId: undefined,
      tenantId: undefined,
    },
  };
  
  console.error('[API_ERROR]', JSON.stringify(logData));
}

/**
 * Handle API errors with secure error messages
 * 
 * @param error - The error to handle
 * @param context - Context for logging
 * @returns NextResponse with appropriate error message
 * 
 * @example
 * ```typescript
 * try {
 *   const account = await getAccount(id);
 *   if (!account) {
 *     throw new ApiError(404, 'Account not found', 'The requested account does not exist.');
 *   }
 * } catch (error) {
 *   return handleApiError(error, {
 *     endpoint: '/api/accounts/[id]',
 *     userId: user?.id,
 *     tenantId,
 *     method: 'GET',
 *   });
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  context: ErrorContext
): NextResponse {
  // Log error with full details (securely)
  logError(error, context);
  
  // Determine status code and message
  let statusCode = 500;
  let userMessage = getUserFriendlyMessage(500);
  let details: any = undefined;
  
  if (error instanceof ApiError) {
    // Controlled error with explicit status and message
    statusCode = error.statusCode;
    userMessage = error.userMessage || getUserFriendlyMessage(statusCode);
    
    // In development, include additional context
    if (shouldExposeDetails() && error.context) {
      details = sanitizeForLogging(error.context);
    }
  } else if (error instanceof Error) {
    // Check for specific error patterns
    const message = error.message.toLowerCase();
    
    // Supabase/Database errors
    if (message.includes('duplicate key') || message.includes('unique constraint')) {
      statusCode = 409;
      userMessage = 'This record already exists.';
    } else if (message.includes('foreign key') || message.includes('violates')) {
      statusCode = 400;
      userMessage = 'Invalid data. Please check your input.';
    } else if (message.includes('not found')) {
      statusCode = 404;
      userMessage = getUserFriendlyMessage(404);
    } else if (message.includes('unauthorized') || message.includes('permission')) {
      statusCode = 403;
      userMessage = getUserFriendlyMessage(403);
    }
    
    // In development, include error message
    if (shouldExposeDetails()) {
      details = {
        errorType: error.constructor.name,
        errorMessage: error.message,
      };
    }
  }
  
  // Build response
  const response: any = {
    error: userMessage,
  };
  
  // Include details in development only
  if (details) {
    response.details = details;
  }
  
  // Include error ID for tracking (can be used for support)
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  response.errorId = errorId;
  
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Wrap an async handler with error handling
 * 
 * @param handler - The async handler function
 * @param endpoint - The API endpoint path
 * @returns Wrapped handler with error handling
 * 
 * @example
 * ```typescript
 * export const GET = withErrorHandler(async (req: NextRequest) => {
 *   const data = await fetchData();
 *   return NextResponse.json({ data });
 * }, '/api/accounts');
 * ```
 */
export function withErrorHandler<T = any>(
  handler: (req: Request, context?: T) => Promise<NextResponse>,
  endpoint: string
) {
  return async (req: Request, context?: T): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleApiError(error, {
        endpoint,
        method: req.method,
      });
    }
  };
}

/**
 * Common API error constructors
 */
export const errors = {
  notFound: (resource: string = 'Resource') =>
    new ApiError(404, `${resource} not found`, `The requested ${resource.toLowerCase()} does not exist.`),
  
  unauthorized: (message: string = 'Authentication required') =>
    new ApiError(401, message, 'Please sign in to continue.'),
  
  forbidden: (message: string = 'Access denied') =>
    new ApiError(403, message, 'You do not have permission to perform this action.'),
  
  badRequest: (message: string, userMessage?: string) =>
    new ApiError(400, message, userMessage || 'Invalid request. Please check your input.'),
  
  conflict: (message: string, userMessage?: string) =>
    new ApiError(409, message, userMessage || 'This operation conflicts with existing data.'),
  
  tooManyRequests: (message: string = 'Rate limit exceeded') =>
    new ApiError(429, message, 'Too many requests. Please try again later.'),
  
  internal: (message: string = 'Internal server error') =>
    new ApiError(500, message, 'An error occurred. Please try again later.'),
};

