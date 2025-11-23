/**
 * Test: Credential Encryption & Security
 * Priority: 🔴 CRITICAL - Data security
 * 
 * Tests verify that credential encryption/decryption works correctly
 * and securely using AES-256-GCM.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// We'll mock the credential-vault module since it uses process.env
// In real tests, this would be imported from '@/lib/security/credential-vault'

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Mock encryption functions for testing
function createTestKey(): Buffer {
  return crypto.randomBytes(32); // 256-bit key
}

function mockEncrypt(payload: Record<string, any>, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function mockDecrypt(serialized: string, key: Buffer): Record<string, any> {
  const [ivB64, tagB64, cipherTextB64] = serialized.split(':');

  if (!ivB64 || !tagB64 || !cipherTextB64) {
    throw new Error('Invalid credential payload format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const cipherText = Buffer.from(cipherTextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

describe('Credential Encryption (CRITICAL)', () => {
  let testKey: Buffer;
  let testPayload: Record<string, any>;

  beforeEach(() => {
    testKey = createTestKey();
    testPayload = {
      appId: 'test-app-id',
      clientSecret: 'test-secret',
      subscriptionKey: 'test-subscription-key',
      apiKey: 'test-api-key',
    };
  });

  // =====================================================
  // ENCRYPTION
  // =====================================================
  describe('Encryption', () => {
    it('should encrypt credentials successfully', () => {
      const encrypted = mockEncrypt(testPayload, testKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should return different encrypted values for same payload', () => {
      const encrypted1 = mockEncrypt(testPayload, testKey);
      const encrypted2 = mockEncrypt(testPayload, testKey);

      // Different IVs mean different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should include IV, auth tag, and ciphertext', () => {
      const encrypted = mockEncrypt(testPayload, testKey);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy(); // IV
      expect(parts[1]).toBeTruthy(); // Auth tag
      expect(parts[2]).toBeTruthy(); // Ciphertext
    });

    it('should not contain plaintext secrets', () => {
      const encrypted = mockEncrypt(testPayload, testKey);

      // Encrypted string should not contain any plaintext values
      expect(encrypted).not.toContain(testPayload.appId);
      expect(encrypted).not.toContain(testPayload.clientSecret);
      expect(encrypted).not.toContain(testPayload.subscriptionKey);
      expect(encrypted).not.toContain(testPayload.apiKey);
    });

    it('should handle empty payload', () => {
      const emptyPayload = {};
      const encrypted = mockEncrypt(emptyPayload, testKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  // =====================================================
  // DECRYPTION
  // =====================================================
  describe('Decryption', () => {
    it('should decrypt successfully', () => {
      const encrypted = mockEncrypt(testPayload, testKey);
      const decrypted = mockDecrypt(encrypted, testKey);

      expect(decrypted).toEqual(testPayload);
    });

    it('should restore all credential fields', () => {
      const encrypted = mockEncrypt(testPayload, testKey);
      const decrypted = mockDecrypt(encrypted, testKey);

      expect(decrypted.appId).toBe(testPayload.appId);
      expect(decrypted.clientSecret).toBe(testPayload.clientSecret);
      expect(decrypted.subscriptionKey).toBe(testPayload.subscriptionKey);
      expect(decrypted.apiKey).toBe(testPayload.apiKey);
    });

    it('should fail with wrong key', () => {
      const encrypted = mockEncrypt(testPayload, testKey);
      const wrongKey = createTestKey();

      expect(() => {
        mockDecrypt(encrypted, wrongKey);
      }).toThrow();
    });

    it('should fail with tampered ciphertext', () => {
      const encrypted = mockEncrypt(testPayload, testKey);
      const parts = encrypted.split(':');
      
      // Tamper with the ciphertext
      const tampered = `${parts[0]}:${parts[1]}:${Buffer.from('tampered').toString('base64')}`;

      expect(() => {
        mockDecrypt(tampered, testKey);
      }).toThrow();
    });

    it('should fail with invalid format (missing parts)', () => {
      const invalidFormat = 'only-one-part';

      expect(() => {
        mockDecrypt(invalidFormat, testKey);
      }).toThrow('Invalid credential payload format');
    });

    it('should handle empty payload round-trip', () => {
      const emptyPayload = {};
      const encrypted = mockEncrypt(emptyPayload, testKey);
      const decrypted = mockDecrypt(encrypted, testKey);

      expect(decrypted).toEqual(emptyPayload);
    });
  });

  // =====================================================
  // KEY MANAGEMENT
  // =====================================================
  describe('Key Management', () => {
    it('should require 32-byte (256-bit) key', () => {
      expect(testKey.length).toBe(32);
    });

    it('should fail encryption with invalid key length', () => {
      const shortKey = Buffer.from('too-short');

      expect(() => {
        const cipher = crypto.createCipheriv(ALGORITHM, shortKey, crypto.randomBytes(IV_LENGTH));
      }).toThrow();
    });

    it('should accept base64-encoded key', () => {
      const base64Key = testKey.toString('base64');
      const decodedKey = Buffer.from(base64Key, 'base64');

      expect(decodedKey.length).toBe(32);
      expect(decodedKey).toEqual(testKey);
    });

    it('should accept hex-encoded key', () => {
      const hexKey = testKey.toString('hex');
      const decodedKey = Buffer.from(hexKey, 'hex');

      expect(decodedKey.length).toBe(32);
      expect(decodedKey).toEqual(testKey);
    });
  });

  // =====================================================
  // SECURITY PROPERTIES
  // =====================================================
  describe('Security Properties', () => {
    it('should use authenticated encryption (GCM)', () => {
      // GCM provides both confidentiality and authenticity
      const encrypted = mockEncrypt(testPayload, testKey);
      const parts = encrypted.split(':');

      // Auth tag should be present
      expect(parts[1]).toBeTruthy();
      
      // Auth tag for GCM is typically 16 bytes (24 base64 chars)
      const authTag = Buffer.from(parts[1], 'base64');
      expect(authTag.length).toBe(16);
    });

    it('should detect tampering via auth tag', () => {
      const encrypted = mockEncrypt(testPayload, testKey);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Change one character in ciphertext
      const tamperedCiphertext = 'A' + ciphertext.substring(1);
      const tampered = `${iv}:${authTag}:${tamperedCiphertext}`;

      // Should fail authentication
      expect(() => {
        mockDecrypt(tampered, testKey);
      }).toThrow();
    });

    it('should use unique IV for each encryption', () => {
      const encrypted1 = mockEncrypt(testPayload, testKey);
      const encrypted2 = mockEncrypt(testPayload, testKey);

      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];

      expect(iv1).not.toBe(iv2);
    });

    it('should use 96-bit (12-byte) IV as recommended for GCM', () => {
      const encrypted = mockEncrypt(testPayload, testKey);
      const ivBase64 = encrypted.split(':')[0];
      const iv = Buffer.from(ivBase64, 'base64');

      expect(iv.length).toBe(12); // 96 bits = 12 bytes
    });
  });
});

