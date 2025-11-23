/**
 * Tests for Secure Error Handler
 * 
 * Verifies that error handling properly sanitizes messages,
 * logs securely, and provides user-friendly responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  handleApiError,
  ApiError,
  withErrorHandler,
  errors,
  type ErrorContext,
} from '../../../lib/security/error-handler';

describe('Error Handler', () => {
  // Mock console.error to capture logs
  const originalConsoleError = console.error;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.fn();
    console.error = consoleErrorSpy;
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  // =====================================================
  // API ERROR CLASS
  // =====================================================
  describe('ApiError', () => {
    it('should create ApiError with status and message', () => {
      const error = new ApiError(404, 'Resource not found');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
    });

    it('should include user message if provided', () => {
      const error = new ApiError(
        400,
        'Validation failed',
        'Please check your input'
      );

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Validation failed');
      expect(error.userMessage).toBe('Please check your input');
    });

    it('should include context if provided', () => {
      const error = new ApiError(500, 'Internal error', undefined, {
        operation: 'database_query',
      });

      expect(error.context).toEqual({ operation: 'database_query' });
    });
  });

  // =====================================================
  // HANDLE API ERROR
  // =====================================================
  describe('handleApiError', () => {
    const context: ErrorContext = {
      endpoint: '/api/test',
      method: 'GET',
      userId: 'user-123',
      tenantId: 'tenant-456',
    };

    it('should return 500 for generic errors', async () => {
      const error = new Error('Something went wrong');
      const response = handleApiError(error, context);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain('Something went wrong'); // Sanitized
      expect(body.errorId).toBeDefined();
    });

    it('should return correct status for ApiError', async () => {
      const error = new ApiError(404, 'Not found', 'Resource does not exist');
      const response = handleApiError(error, context);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Resource does not exist');
      expect(body.errorId).toBeDefined();
    });

    it('should detect duplicate key errors', async () => {
      const error = new Error('duplicate key value violates unique constraint');
      const response = handleApiError(error, context);

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toContain('already exists');
    });

    it('should detect not found errors', async () => {
      const error = new Error('Record not found');
      const response = handleApiError(error, context);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('should detect unauthorized errors', async () => {
      const error = new Error('unauthorized access');
      const response = handleApiError(error, context);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('permission');
    });

    it('should log errors with context', () => {
      const error = new Error('Test error');
      handleApiError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls[0][1];
      expect(logCall).toContain('[API_ERROR]');
      expect(logCall).toContain('/api/test');
    });

    it('should not expose internal details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal database connection failed');
      const response = handleApiError(error, context);
      const body = await response.json();

      // Should not expose internal message
      expect(body.error).not.toContain('database connection');
      expect(body.error).toContain('error occurred');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error ID for tracking', async () => {
      const error = new Error('Test error');
      const response = handleApiError(error, context);
      const body = await response.json();

      expect(body.errorId).toBeDefined();
      expect(body.errorId).toMatch(/^ERR_\d+_[a-z0-9]+$/);
    });
  });

  // =====================================================
  // WITH ERROR HANDLER WRAPPER
  // =====================================================
  describe('withErrorHandler', () => {
    it('should catch errors and return error response', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const wrappedHandler = withErrorHandler(handler, '/api/test');

      const request = new NextRequest('http://localhost/api/test');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.errorId).toBeDefined();
    });

    it('should pass through successful responses', async () => {
      const successResponse = new Response(JSON.stringify({ data: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      const handler = vi.fn().mockResolvedValue(successResponse);
      const wrappedHandler = withErrorHandler(handler, '/api/test');

      const request = new NextRequest('http://localhost/api/test');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toBe('success');
    });

    it('should handle ApiError correctly', async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new ApiError(404, 'Not found', 'Resource not found'));
      const wrappedHandler = withErrorHandler(handler, '/api/test');

      const request = new NextRequest('http://localhost/api/test');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Resource not found');
    });
  });

  // =====================================================
  // COMMON ERROR CONSTRUCTORS
  // =====================================================
  describe('Common Errors', () => {
    it('should create notFound error', () => {
      const error = errors.notFound('Account');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Account');
      expect(error.userMessage).toContain('account');
    });

    it('should create unauthorized error', () => {
      const error = errors.unauthorized();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.userMessage).toContain('sign in');
    });

    it('should create forbidden error', () => {
      const error = errors.forbidden();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.userMessage).toContain('permission');
    });

    it('should create badRequest error', () => {
      const error = errors.badRequest('Invalid input');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });

    it('should create conflict error', () => {
      const error = errors.conflict('Duplicate entry');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Duplicate entry');
    });

    it('should create tooManyRequests error', () => {
      const error = errors.tooManyRequests();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(429);
      expect(error.userMessage).toContain('Too many');
    });

    it('should create internal error', () => {
      const error = errors.internal();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(500);
      expect(error.userMessage).toContain('error occurred');
    });
  });

  // =====================================================
  // SENSITIVE DATA SANITIZATION
  // =====================================================
  describe('Sensitive Data Sanitization', () => {
    it('should sanitize password from logs', () => {
      const error = new ApiError(400, 'Invalid credentials', undefined, {
        email: 'user@example.com',
        password: 'secret123',
      });

      handleApiError(error, {
        endpoint: '/api/auth/login',
      });

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      // Password should be redacted
      expect(logData.context.password).toBe('***REDACTED***');
      // Email should remain
      expect(logData.context.email).toBe('user@example.com');
    });

    it('should sanitize tokens from logs', () => {
      const error = new Error('Token validation failed');
      const context: ErrorContext = {
        endpoint: '/api/validate',
        accessToken: 'secret-token-123',
      };

      handleApiError(error, context);

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.context.accessToken).toBe('***REDACTED***');
    });

    it('should sanitize API keys from logs', () => {
      const error = new Error('API key invalid');
      const context: ErrorContext = {
        endpoint: '/api/external',
        apiKey: 'sk_live_1234567890',
      };

      handleApiError(error, context);

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.context.apiKey).toBe('***REDACTED***');
    });

    it('should sanitize nested sensitive data', () => {
      const error = new Error('Payment failed');
      const context: ErrorContext = {
        endpoint: '/api/payments',
        paymentData: {
          amount: 100,
          creditCard: '4111111111111111',
        },
      };

      handleApiError(error, context);

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.context.paymentData.creditCard).toBe('***REDACTED***');
      expect(logData.context.paymentData.amount).toBe(100);
    });
  });

  // =====================================================
  // USER-FRIENDLY MESSAGES
  // =====================================================
  describe('User-Friendly Messages', () => {
    it('should provide friendly message for 400', async () => {
      const error = new ApiError(400, 'Bad request');
      const response = handleApiError(error, { endpoint: '/api/test' });
      const body = await response.json();

      expect(body.error).toContain('check your input');
    });

    it('should provide friendly message for 401', async () => {
      const error = new ApiError(401, 'Unauthorized');
      const response = handleApiError(error, { endpoint: '/api/test' });
      const body = await response.json();

      expect(body.error).toContain('sign in');
    });

    it('should provide friendly message for 403', async () => {
      const error = new ApiError(403, 'Forbidden');
      const response = handleApiError(error, { endpoint: '/api/test' });
      const body = await response.json();

      expect(body.error).toContain('permission');
    });

    it('should provide friendly message for 404', async () => {
      const error = new ApiError(404, 'Not found');
      const response = handleApiError(error, { endpoint: '/api/test' });
      const body = await response.json();

      expect(body.error).toContain('not found');
    });

    it('should provide friendly message for 500', async () => {
      const error = new Error('Database connection lost');
      const response = handleApiError(error, { endpoint: '/api/test' });
      const body = await response.json();

      expect(body.error).toContain('error occurred');
      expect(body.error).not.toContain('Database');
    });
  });

  // =====================================================
  // ENVIRONMENT-SPECIFIC BEHAVIOR
  // =====================================================
  describe('Environment-Specific Behavior', () => {
    it('should include details in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      const response = handleApiError(error, { endpoint: '/api/test' });
      const body = await response.json();

      expect(body.details).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      const response = handleApiError(error, { endpoint: '/api/test' });
      const body = await response.json();

      expect(body.details).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });
});

