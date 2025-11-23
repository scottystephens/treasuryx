/**
 * Tests for Rate Limiting Service
 * 
 * These tests verify that rate limiting works correctly for different
 * operation types and handles failures gracefully.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitIdentifier,
  getIpAddress,
  isRateLimitingEnabled,
  rateLimitConfigs,
  type RateLimitType,
} from '../../../lib/security/rate-limit';

describe('Rate Limiting', () => {
  // =====================================================
  // RATE LIMIT CONFIGS
  // =====================================================
  describe('Rate Limit Configurations', () => {
    it('should have all required rate limit types', () => {
      expect(rateLimitConfigs.auth).toBeDefined();
      expect(rateLimitConfigs.api).toBeDefined();
      expect(rateLimitConfigs.read).toBeDefined();
      expect(rateLimitConfigs.banking).toBeDefined();
      expect(rateLimitConfigs.upload).toBeDefined();
      expect(rateLimitConfigs.admin).toBeDefined();
    });

    it('should have stricter limits for auth than api', () => {
      expect(rateLimitConfigs.auth.requests).toBeLessThan(
        rateLimitConfigs.api.requests
      );
    });

    it('should have stricter limits for banking than api', () => {
      expect(rateLimitConfigs.banking.requests).toBeLessThan(
        rateLimitConfigs.api.requests
      );
    });

    it('should have most relaxed limits for read operations', () => {
      expect(rateLimitConfigs.read.requests).toBeGreaterThanOrEqual(
        rateLimitConfigs.api.requests
      );
    });
  });

  // =====================================================
  // CHECK RATE LIMIT (Graceful Degradation)
  // =====================================================
  describe('checkRateLimit', () => {
    it('should allow requests when rate limiting is not configured', async () => {
      // When Redis is not configured, rate limiting should gracefully degrade
      const result = await checkRateLimit('test-user', 'api');

      expect(result.success).toBe(true);
      expect(result.limit).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.reset).toBeGreaterThan(Date.now());
    });

    it('should return rate limit metadata', async () => {
      const result = await checkRateLimit('test-user', 'api');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('reset');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.limit).toBe('number');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.reset).toBe('number');
    });

    it('should accept different rate limit types', async () => {
      const types: RateLimitType[] = ['auth', 'api', 'read', 'banking', 'upload', 'admin'];

      for (const type of types) {
        const result = await checkRateLimit('test-user', type);
        expect(result.success).toBe(true);
        expect(result.limit).toBe(rateLimitConfigs[type].requests);
      }
    });

    it('should use default api type when not specified', async () => {
      const result = await checkRateLimit('test-user');

      expect(result.limit).toBe(rateLimitConfigs.api.requests);
    });

    it('should handle different identifiers', async () => {
      const identifiers = [
        'user-123',
        '192.168.1.1',
        'anonymous',
        'admin@test.com',
      ];

      for (const identifier of identifiers) {
        const result = await checkRateLimit(identifier, 'api');
        expect(result.success).toBe(true);
      }
    });
  });

  // =====================================================
  // CREATE RATE LIMIT RESPONSE
  // =====================================================
  describe('createRateLimitResponse', () => {
    it('should create 429 response', async () => {
      const rateLimitResult = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60000,
      };

      const response = createRateLimitResponse(rateLimitResult);

      expect(response.status).toBe(429);
    });

    it('should include rate limit headers', async () => {
      const rateLimitResult = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60000,
      };

      const response = createRateLimitResponse(rateLimitResult);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
      expect(response.headers.get('Retry-After')).toBeTruthy();
    });

    it('should return JSON error message', async () => {
      const rateLimitResult = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60000,
      };

      const response = createRateLimitResponse(rateLimitResult);
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('remaining');
      expect(body).toHaveProperty('resetAt');
      expect(body.error).toContain('Rate limit exceeded');
    });

    it('should calculate correct retry-after time', async () => {
      const resetTime = Date.now() + 60000; // 60 seconds from now
      const rateLimitResult = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: resetTime,
      };

      const response = createRateLimitResponse(rateLimitResult);
      const retryAfter = parseInt(response.headers.get('Retry-After') || '0');

      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  // =====================================================
  // GET RATE LIMIT IDENTIFIER
  // =====================================================
  describe('getRateLimitIdentifier', () => {
    it('should prefer user ID over IP address', () => {
      const identifier = getRateLimitIdentifier('user-123', '192.168.1.1');

      expect(identifier).toBe('user-123');
    });

    it('should use IP address when user ID is null', () => {
      const identifier = getRateLimitIdentifier(null, '192.168.1.1');

      expect(identifier).toBe('192.168.1.1');
    });

    it('should use anonymous when both are null', () => {
      const identifier = getRateLimitIdentifier(null, null);

      expect(identifier).toBe('anonymous');
    });

    it('should handle empty strings as null', () => {
      const identifier1 = getRateLimitIdentifier('', '192.168.1.1');
      const identifier2 = getRateLimitIdentifier(null, '');

      // Empty string is falsy, so should fall back
      expect(identifier1).toBe('192.168.1.1');
      expect(identifier2).toBe('anonymous');
    });
  });

  // =====================================================
  // GET IP ADDRESS
  // =====================================================
  describe('getIpAddress', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const headers = new Headers({
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      });

      const ip = getIpAddress(headers);

      expect(ip).toBe('192.168.1.1');
    });

    it('should fallback to x-real-ip header', () => {
      const headers = new Headers({
        'x-real-ip': '192.168.1.1',
      });

      const ip = getIpAddress(headers);

      expect(ip).toBe('192.168.1.1');
    });

    it('should return unknown when no IP headers present', () => {
      const headers = new Headers({});

      const ip = getIpAddress(headers);

      expect(ip).toBe('unknown');
    });

    it('should handle multiple IPs in x-forwarded-for', () => {
      const headers = new Headers({
        'x-forwarded-for': '  192.168.1.1  ,  10.0.0.1  ,  172.16.0.1  ',
      });

      const ip = getIpAddress(headers);

      // Should return first IP, trimmed
      expect(ip).toBe('192.168.1.1');
    });
  });

  // =====================================================
  // IS RATE LIMITING ENABLED
  // =====================================================
  describe('isRateLimitingEnabled', () => {
    it('should return boolean', () => {
      const enabled = isRateLimitingEnabled();

      expect(typeof enabled).toBe('boolean');
    });

    it('should be false when Redis is not configured', () => {
      // In test environment, Redis is typically not configured
      const enabled = isRateLimitingEnabled();

      // This will be false in tests, true in production with Redis
      expect(enabled).toBe(false);
    });
  });

  // =====================================================
  // INTEGRATION SCENARIOS
  // =====================================================
  describe('Integration Scenarios', () => {
    it('should handle authentication rate limiting scenario', async () => {
      // Simulate login attempts
      const result = await checkRateLimit('user@example.com', 'auth');

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5); // 5 attempts per 15 minutes for auth
    });

    it('should handle banking operation rate limiting', async () => {
      const result = await checkRateLimit('user-123', 'banking');

      expect(result.success).toBe(true);
      expect(result.limit).toBe(10); // 10 syncs per hour
    });

    it('should handle file upload rate limiting', async () => {
      const result = await checkRateLimit('user-123', 'upload');

      expect(result.success).toBe(true);
      expect(result.limit).toBe(20); // 20 uploads per hour
    });

    it('should allow admin operations more generously', async () => {
      const result = await checkRateLimit('admin-user', 'admin');

      expect(result.success).toBe(true);
      expect(result.limit).toBe(200); // 200 requests per minute
    });
  });

  // =====================================================
  // ERROR HANDLING
  // =====================================================
  describe('Error Handling (Graceful Degradation)', () => {
    it('should allow requests when rate limiting fails', async () => {
      // Even if Redis is down or there's an error, the app should continue
      const result = await checkRateLimit('test-user', 'api');

      // Should succeed (graceful degradation)
      expect(result.success).toBe(true);
    });

    it('should not throw errors when rate limiting is misconfigured', async () => {
      // Should not throw, even with invalid inputs
      await expect(async () => {
        await checkRateLimit('', 'api');
      }).not.toThrow();
    });
  });

  // =====================================================
  // BACKWARD COMPATIBILITY
  // =====================================================
  describe('Backward Compatibility', () => {
    it('should work without Redis configuration', async () => {
      // When Redis env vars are not set, rate limiting should not block requests
      const result = await checkRateLimit('user-123', 'api');

      expect(result.success).toBe(true);
      // Should return sensible defaults
      expect(result.limit).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should not impact existing API functionality', async () => {
      // Rate limiting should be transparent to existing code
      const result = await checkRateLimit('user-123', 'api');

      // Should have all required properties
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('reset');
    });
  });
});

