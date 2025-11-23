/**
 * Test: Currency utility functions
 * Priority: HIGH - Multi-currency support is core feature
 */

import { describe, it, expect } from 'vitest';
import { formatCurrency, getCurrencySymbol, convertCurrency } from '@/lib/currency';

describe('Currency Utilities', () => {
  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toBe('$1,234.56');
    });

    it('should format EUR correctly', () => {
      const result = formatCurrency(1234.56, 'EUR');
      expect(result).toBe('€1,234.56');
    });

    it('should format GBP correctly', () => {
      const result = formatCurrency(1234.56, 'GBP');
      expect(result).toBe('£1,234.56');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-500.25, 'USD');
      expect(result).toBe('-$500.25');
    });

    it('should handle zero', () => {
      const result = formatCurrency(0, 'USD');
      expect(result).toBe('$0.00');
    });

    it('should default to USD for unknown currency', () => {
      const result = formatCurrency(100, 'UNKNOWN' as any);
      expect(result).toContain('100');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return correct symbol for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return correct symbol for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return correct symbol for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('should return correct symbol for ZAR', () => {
      expect(getCurrencySymbol('ZAR')).toBe('R');
    });

    it('should return currency code for unknown currency', () => {
      expect(getCurrencySymbol('XXX' as any)).toBe('XXX');
    });
  });

  describe('convertCurrency', () => {
    it('should convert USD to EUR correctly', () => {
      const result = convertCurrency(100, 'USD', 'EUR', 0.85);
      expect(result).toBe(85);
    });

    it('should convert EUR to USD correctly', () => {
      const result = convertCurrency(100, 'EUR', 'USD', 1.18);
      expect(result).toBe(118);
    });

    it('should return same amount for same currency', () => {
      const result = convertCurrency(100, 'USD', 'USD', 1);
      expect(result).toBe(100);
    });

    it('should handle decimal exchange rates', () => {
      const result = convertCurrency(100, 'USD', 'JPY', 110.25);
      expect(result).toBeCloseTo(11025, 2);
    });

    it('should handle fractional results', () => {
      const result = convertCurrency(100, 'USD', 'EUR', 0.8567);
      expect(result).toBeCloseTo(85.67, 2);
    });
  });
});

