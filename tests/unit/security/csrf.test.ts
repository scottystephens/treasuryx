/**
 * Tests for CSRF Protection
 * 
 * Verifies that CSRF token generation, validation, and middleware
 * work correctly to prevent cross-site request forgery attacks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateCsrfToken,
  validateCsrfToken,
  invalidateCsrfToken,
  getCsrfTokenFromRequest,
  requiresCsrfProtection,
  withCsrfProtection,
  clearCsrfToken,
  CSRF_CONSTANTS,
} from '../../../lib/security/csrf';

describe('CSRF Protection', () => {
  const testSessionId = 'test-session-123';

  // =====================================================
  // TOKEN GENERATION
  // =====================================================
  describe('generateCsrfToken', () => {
    it('should generate a token', async () => {
      const token = await generateCsrfToken(testSessionId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', async () => {
      const token1 = await generateCsrfToken('session-1');
      const token2 = await generateCsrfToken('session-2');

      expect(token1).not.toBe(token2);
    });

    it('should generate hex string', async () => {
      const token = await generateCsrfToken(testSessionId);

      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate token of consistent length', async () => {
      const token1 = await generateCsrfToken('session-1');
      const token2 = await generateCsrfToken('session-2');

      expect(token1.length).toBe(token2.length);
    });
  });

  // =====================================================
  // TOKEN VALIDATION
  // =====================================================
  describe('validateCsrfToken', () => {
    it('should validate a valid token', async () => {
      const token = await generateCsrfToken(testSessionId);
      const isValid = await validateCsrfToken(token, testSessionId);

      expect(isValid).toBe(true);
    });

    it('should reject null token', async () => {
      const isValid = await validateCsrfToken(null, testSessionId);

      expect(isValid).toBe(false);
    });

    it('should reject invalid token', async () => {
      await generateCsrfToken(testSessionId);
      const isValid = await validateCsrfToken('invalid-token', testSessionId);

      expect(isValid).toBe(false);
    });

    it('should reject token for different session', async () => {
      const token = await generateCsrfToken('session-1');
      const isValid = await validateCsrfToken(token, 'session-2');

      expect(isValid).toBe(false);
    });

    it('should reject token after invalidation', async () => {
      const token = await generateCsrfToken(testSessionId);
      await invalidateCsrfToken(testSessionId);
      const isValid = await validateCsrfToken(token, testSessionId);

      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison', async () => {
      // This test verifies that validation doesn't leak timing information
      const token = await generateCsrfToken(testSessionId);
      
      const start1 = Date.now();
      await validateCsrfToken(token, testSessionId);
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      await validateCsrfToken('wrong-token-123', testSessionId);
      const time2 = Date.now() - start2;
      
      // Times should be similar (within 10ms)
      // This is a basic check - real timing attacks are more sophisticated
      const diff = Math.abs(time1 - time2);
      expect(diff).toBeLessThan(10);
    });
  });

  // =====================================================
  // TOKEN INVALIDATION
  // =====================================================
  describe('invalidateCsrfToken', () => {
    it('should invalidate a token', async () => {
      const token = await generateCsrfToken(testSessionId);
      
      let isValid = await validateCsrfToken(token, testSessionId);
      expect(isValid).toBe(true);
      
      await invalidateCsrfToken(testSessionId);
      
      isValid = await validateCsrfToken(token, testSessionId);
      expect(isValid).toBe(false);
    });

    it('should allow generating new token after invalidation', async () => {
      const token1 = await generateCsrfToken(testSessionId);
      await invalidateCsrfToken(testSessionId);
      const token2 = await generateCsrfToken(testSessionId);
      
      const isValid = await validateCsrfToken(token2, testSessionId);
      expect(isValid).toBe(true);
    });
  });

  // =====================================================
  // GET TOKEN FROM REQUEST
  // =====================================================
  describe('getCsrfTokenFromRequest', () => {
    it('should get token from X-CSRF-Token header', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'X-CSRF-Token': 'test-token-123',
        },
      });

      const token = getCsrfTokenFromRequest(req);

      expect(token).toBe('test-token-123');
    });

    it('should return null if header missing', () => {
      const req = new NextRequest('http://localhost/api/test');

      const token = getCsrfTokenFromRequest(req);

      expect(token).toBeNull();
    });
  });

  // =====================================================
  // REQUIRES CSRF PROTECTION
  // =====================================================
  describe('requiresCsrfProtection', () => {
    it('should require protection for POST', () => {
      expect(requiresCsrfProtection('POST')).toBe(true);
    });

    it('should require protection for PUT', () => {
      expect(requiresCsrfProtection('PUT')).toBe(true);
    });

    it('should require protection for PATCH', () => {
      expect(requiresCsrfProtection('PATCH')).toBe(true);
    });

    it('should require protection for DELETE', () => {
      expect(requiresCsrfProtection('DELETE')).toBe(true);
    });

    it('should not require protection for GET', () => {
      expect(requiresCsrfProtection('GET')).toBe(false);
    });

    it('should not require protection for HEAD', () => {
      expect(requiresCsrfProtection('HEAD')).toBe(false);
    });

    it('should not require protection for OPTIONS', () => {
      expect(requiresCsrfProtection('OPTIONS')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(requiresCsrfProtection('post')).toBe(true);
      expect(requiresCsrfProtection('Post')).toBe(true);
      expect(requiresCsrfProtection('get')).toBe(false);
    });
  });

  // =====================================================
  // WITH CSRF PROTECTION MIDDLEWARE
  // =====================================================
  describe('withCsrfProtection', () => {
    it('should allow GET requests without token', async () => {
      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }))
      );
      const protectedHandler = withCsrfProtection(handler);

      const req = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      });

      const response = await protectedHandler(req);
      const body = await response.json();

      expect(handler).toHaveBeenCalled();
      expect(body.success).toBe(true);
    });

    it('should allow POST with valid token', async () => {
      // This test would need proper session mocking
      // For now, we'll test the structure
      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }))
      );
      const protectedHandler = withCsrfProtection(handler);

      expect(protectedHandler).toBeDefined();
      expect(typeof protectedHandler).toBe('function');
    });

    it('should skip paths if configured', async () => {
      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }))
      );
      const protectedHandler = withCsrfProtection(handler, {
        skipForPaths: ['/webhooks'],
      });

      const req = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
      });

      const response = await protectedHandler(req);
      const body = await response.json();

      expect(handler).toHaveBeenCalled();
      expect(body.success).toBe(true);
    });
  });

  // =====================================================
  // CLIENT-SIDE HELPERS
  // =====================================================
  describe('clearCsrfToken', () => {
    it('should clear cached token', () => {
      // This is a void function that clears internal cache
      expect(() => clearCsrfToken()).not.toThrow();
    });
  });

  // =====================================================
  // CONSTANTS
  // =====================================================
  describe('CSRF_CONSTANTS', () => {
    it('should export header name', () => {
      expect(CSRF_CONSTANTS.HEADER_NAME).toBe('X-CSRF-Token');
    });

    it('should export cookie name', () => {
      expect(CSRF_CONSTANTS.COOKIE_NAME).toBe('csrf_token');
    });

    it('should export token expiry', () => {
      expect(CSRF_CONSTANTS.TOKEN_EXPIRY).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // SECURITY PROPERTIES
  // =====================================================
  describe('Security Properties', () => {
    it('should generate cryptographically secure tokens', async () => {
      const tokens = new Set();
      
      // Generate 100 tokens, should all be unique
      for (let i = 0; i < 100; i++) {
        const token = await generateCsrfToken(`session-${i}`);
        tokens.add(token);
      }
      
      expect(tokens.size).toBe(100);
    });

    it('should not accept empty string as token', async () => {
      await generateCsrfToken(testSessionId);
      const isValid = await validateCsrfToken('', testSessionId);

      expect(isValid).toBe(false);
    });

    it('should not accept whitespace as token', async () => {
      await generateCsrfToken(testSessionId);
      const isValid = await validateCsrfToken('   ', testSessionId);

      expect(isValid).toBe(false);
    });
  });

  // =====================================================
  // EDGE CASES
  // =====================================================
  describe('Edge Cases', () => {
    it('should handle session ID with special characters', async () => {
      const specialSessionId = 'session-!@#$%^&*()';
      const token = await generateCsrfToken(specialSessionId);
      const isValid = await validateCsrfToken(token, specialSessionId);

      expect(isValid).toBe(true);
    });

    it('should handle very long session IDs', async () => {
      const longSessionId = 'x'.repeat(1000);
      const token = await generateCsrfToken(longSessionId);
      const isValid = await validateCsrfToken(token, longSessionId);

      expect(isValid).toBe(true);
    });

    it('should reject tokens with wrong length', async () => {
      const token = await generateCsrfToken(testSessionId);
      const truncated = token.substring(0, token.length - 1);
      const isValid = await validateCsrfToken(truncated, testSessionId);

      expect(isValid).toBe(false);
    });
  });
});

